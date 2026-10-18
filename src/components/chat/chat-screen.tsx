"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { goBackInApp } from "@/components/light/light-navigation";
import { useRouter } from "next/navigation";
import { AnimatePresence, useReducedMotion } from "motion/react";

import { AssistantAvatar } from "./assistant-avatar";
import { ChatBlockView, ChoiceList, MessageEnter, TypingIndicator } from "./chat-blocks";
import { Composer, type Mention } from "./composer";
import styles from "./chat.module.css";
import type { ChatAction, ChatBlock, ChatChoice, ChatLeadRow, ChatProgress, ChatScript, MascotShape, ChatListItem } from "./types";
import { fetchMentionBlocks, isDataMention } from "./mention-client";

/** Result of a server action run from a reply. A message is shown as the assistant's answer. */
export type ChatActionResult = { ok: boolean; message?: string; followUp?: ChatBlock[]; warning?: boolean };
export type ChatActionRunner = (action: Extract<ChatAction, { kind: "server" }>, choice: ChatChoice) => Promise<ChatActionResult>;

type Identity = { name: string; shape: MascotShape; hue: number | null; initials?: string; temperature?: "hot" | "warm" | "cold" | null };

/** Blocks opened by a "next" action (questions, buttons) stay hidden until that reply is chosen. */
function hiddenQuestionIds(blocks: ChatBlock[]) {
  const ids = new Set<string>();
  for (const block of blocks) {
    if (block.type !== "question") continue;
    for (const choice of block.choices) if (choice.action.kind === "next") ids.add(choice.action.questionId);
  }
  return ids;
}

/** How long the assistant "types" before a message: by its length, 400 to 900ms. */
function typingDelay(block: ChatBlock) {
  if (block.type !== "assistant") return 0;
  return Math.min(900, 400 + block.text.length * 6);
}

function nowLabel() {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date());
}

/**
 * A full chat screen: header (back, mascot, status), the conversation that
 * plays its script message by message, suggested replies and the composer.
 */
export function ChatScreen({
  identity,
  backHref,
  script,
  runAction,
  onFreeText,
  onMention,
  headerAction,
  topNotice,
  composerDisabled = false,
  onLocalChoice,
  progress: progressOverride,
  placeholder: placeholderOverride,
  composerInput,
  onButtonOpen,
  instant = false,
  tourTargets,
  fill = false,
  embedded = false,
  emptyText,
}: {
  identity: Identity;
  /**
   * Inside the lead screen (2026-10-18): the columns already show who it is and what to do, so the
   * conversation is only the history (no header, no composer), already scrolled to the newest message.
   */
  embedded?: boolean;
  /** Shown when the conversation has nothing yet (embedded history). */
  emptyText?: string;
  /** Fills the column that holds it (lead page, computer and phone) instead of the whole viewport. */
  fill?: boolean;
  backHref: string;
  script: ChatScript;
  runAction?: ChatActionRunner;
  /** Free text from the composer (a note, a question). Returns the assistant's answer blocks. */
  onFreeText?: (text: string) => Promise<ChatBlock[]>;
  onMention?: (mention: Mention) => Promise<ChatBlock[]> | ChatBlock[];
  headerAction?: ReactNode;
  /** Fixed context notice displayed between the conversation header and thread. */
  topNotice?: ReactNode;
  composerDisabled?: boolean;
  /** Replies with a "local" action: returns the blocks that answer it (next question, result...). */
  onLocalChoice?: (choice: ChatChoice, value: string) => Promise<ChatBlock[]> | ChatBlock[];
  /** Guided flows control their own progress instead of counting answered questions. */
  progress?: ChatProgress | null;
  /** Composer placeholder chosen by the flow (wins over the default). */
  placeholder?: string;
  /** Keyboard and accessible name of the composer when it answers a question. */
  composerInput?: { inputMode?: "text" | "numeric"; label?: string };
  /** A button block was tapped (e.g. record that WhatsApp was opened). */
  /** A button block was tapped; preventDefault on the event keeps the link from opening (e.g. a dialog instead). */
  onButtonOpen?: (block: Extract<ChatBlock, { type: "button" }>, event: React.MouseEvent<HTMLAnchorElement>) => void;
  /** History-like threads (Âncora): show everything at once, already scrolled to the newest. */
  instant?: boolean;
  tourTargets?: { conversation?: string; composer?: string };
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const hidden = useMemo(() => hiddenQuestionIds(script.blocks), [script.blocks]);
  const initial = useMemo(() => script.blocks.filter((block) => !hidden.has(block.id)), [hidden, script.blocks]);

  // Blocks already on screen, and the queue still to be "typed".
  const [shown, setShown] = useState<ChatBlock[]>(() => (reduce || instant || embedded ? initial : initial.slice(0, 1)));
  const [queue, setQueue] = useState<ChatBlock[]>(() => (reduce || instant || embedded ? [] : initial.slice(1)));
  const firstScroll = useRef(true);
  const [typing, setTyping] = useState(false);
  const [working, setWorking] = useState(false);
  const [workingLabel, setWorkingLabel] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [status, setStatus] = useState(script.status ?? null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Plays the queue: typing indicator for assistant messages, then the block.
  useEffect(() => {
    if (!queue.length) return;
    const [next, ...rest] = queue;
    const wait = reduce ? 0 : typingDelay(next);
    const showTyping = wait > 0 ? setTimeout(() => setTyping(true), 0) : null;
    const timer = setTimeout(() => {
      setTyping(false);
      setShown((current) => [...current, next]);
      setQueue(rest);
    }, wait || (reduce ? 0 : 90));
    return () => { if (showTyping) clearTimeout(showTyping); clearTimeout(timer); };
  }, [queue, reduce]);

  // Sticks to the newest message.
  useEffect(() => {
    const node = scrollRef.current;
    // The first jump is instant (opening at the newest message); later ones glide.
    node?.scrollTo?.({ top: node.scrollHeight, behavior: reduce || firstScroll.current ? "auto" : "smooth" });
    firstScroll.current = false;
  }, [shown.length, typing, reduce]);

  const enqueue = useCallback((blocks: ChatBlock[]) => setQueue((current) => [...current, ...blocks]), []);

  // After an action the page refreshes (router.refresh): cards and lists on screen take the
  // fresh data (a cancelled return leaves the Agenda), and scripts that ask for it offer
  // their first question again, now about the next item.
  const replayPending = useRef(false);
  // A question asked again gets a new id; this remembers which script question it copies.
  const copySource = useRef(new Map<string, string>());
  const copyQuestion = useCallback(<T extends ChatBlock>(block: T): T => {
    const id = `${block.id}-${Date.now()}`;
    copySource.current.set(id, copySource.current.get(block.id) ?? block.id);
    return { ...block, id };
  }, []);
  const answersRef = useRef<Record<string, string>>({});
  const shownRef = useRef<ChatBlock[]>([]);
  useEffect(() => {
    answersRef.current = answers;
    shownRef.current = shown;
  });
  useEffect(() => {
    const fresh = new Map(script.blocks.map((block) => [block.id, block]));
    const sourceOf = (id: string) => copySource.current.get(id) ?? id;
    // Realtime refreshes the page every few seconds: blocks that did not change keep their
    // object (their rows skip rendering) and an unchanged conversation keeps its array, so
    // scrolling never stutters on a refresh.
    setShown((current) => {
      let changed = false;
      const next = current.flatMap((block) => {
        if (block.type === "user") return [block];
        let fresher: ChatBlock | undefined;
        // Questions not answered yet follow the data too (never offer a return that is gone).
        if (block.type === "question") {
          const source = answersRef.current[block.id] ? undefined : fresh.get(sourceOf(block.id));
          fresher = source ? { ...source, id: block.id } : undefined;
        } else {
          fresher = fresh.get(block.id);
          if (!fresher && block.type === "list") { changed = true; return []; }
        }
        if (!fresher || sameBlock(fresher, block)) return [block];
        changed = true;
        return [fresher];
      });
      return changed ? next : current;
    });
    if (!replayPending.current) return;
    replayPending.current = false;
    const first = initial.find((block) => block.type === "question");
    // Only when the first question is not already waiting on screen.
    const waiting = shownRef.current.some((block) => block.type === "question" && !answersRef.current[block.id] && sourceOf(block.id) === first?.id);
    if (first && !waiting) enqueue([copyQuestion(first)]);
  }, [script.blocks, initial, enqueue, copyQuestion]);

  const choose = useCallback(async (question: Extract<ChatBlock, { type: "question" }>, choice: ChatChoice) => {
    if (answers[question.id]) return;
    setAnswers((current) => ({ ...current, [question.id]: choice.id }));
    const reply: ChatBlock = { type: "user", id: `reply-${question.id}`, text: choice.reply ?? choice.label, at: nowLabel() };
    setShown((current) => [...current, reply]);
    const action = choice.action;
    if (action.kind === "href") {
      // WhatsApp and other external links open beside the app; the conversation stays.
      if (/^https?:/.test(action.href)) window.open(action.href, "_blank", "noopener");
      else router.push(action.href);
      return;
    }
    if (action.kind === "next") {
      const target = script.blocks.find((block) => block.id === action.questionId);
      if (target) enqueue([answers[target.id] ? copyQuestion(target) : target]);
      return;
    }
    if (action.kind === "local") {
      if (onLocalChoice) enqueue(await onLocalChoice(choice, action.value));
      return;
    }
    if (!runAction) return;
    setWorking(true);
    setStatus({ label: "Trabalhando...", tone: "working" });
    try {
      const result = await runAction(action, choice);
      enqueue([
        ...(result.message ? [{ type: "assistant" as const, id: `result-${question.id}`, text: result.message, at: nowLabel() }] : []),
        ...(result.followUp ?? []),
      ]);
      setStatus(result.ok && !result.warning ? { label: "Pronto", tone: "idle" } : { label: result.ok ? "Precisa de atenção" : "Esperando você", tone: "waiting" });
      if (result.ok) {
        if (script.replayAfterAction) replayPending.current = true;
        router.refresh();
      }
      return result.ok;
    } catch {
      enqueue([{ type: "assistant", id: `error-${question.id}`, text: "Sua ação não foi concluída. Toque de novo em alguns segundos. Se continuar, fale com o suporte." }]);
      setStatus({ label: "Esperando você", tone: "waiting" });
      setAnswers((current) => { const next = { ...current }; delete next[question.id]; return next; });
      return false;
    } finally {
      setWorking(false);
    }
  }, [answers, copyQuestion, enqueue, onLocalChoice, router, runAction, script.blocks, script.replayAfterAction]);

  // A list row swiped away (Agenda: cancel a return): it leaves at once, the action runs as a reply.
  const swipeItem = useCallback((item: ChatListItem) => {
    if (!item.swipe || working) return;
    const swipe = item.swipe;
    setShown((current) => current.map((block) => block.type === "list" ? { ...block, items: block.items.filter((row) => row.id !== item.id) } : block));
    void choose({ type: "question", id: `swipe-${item.id}-${Date.now()}`, prompt: "", choices: [] }, { id: "swipe", label: swipe.reply, action: swipe.action }).then((ok) => {
      // Failed: the row comes back from the data the screen already had.
      if (ok === false) setShown((current) => current.map((block) => block.type === "list" ? (script.blocks.find((fresh) => fresh.id === block.id) ?? block) : block));
    });
  }, [choose, script.blocks, working]);

  // "@": shortcuts and leads come back as live blocks in this conversation; the rest is up to the screen.
  const mention = useCallback(async (picked: Mention) => {
    if (!isDataMention(picked.handle)) {
      if (onMention) enqueue(await onMention(picked));
      return;
    }
    if (working) return;
    setShown((current) => [...current, { type: "user", id: `mention-${Date.now()}`, text: picked.label.startsWith("@") ? picked.label : `@${picked.label}`, at: nowLabel() }]);
    setWorking(true);
    setWorkingLabel(picked.handle.startsWith("lead:") ? "Buscando a ficha…" : "Buscando…");
    setStatus({ label: "Trabalhando...", tone: "working" });
    try {
      enqueue(await fetchMentionBlocks(picked.handle));
      setStatus({ label: "Pronto", tone: "idle" });
    } finally {
      setWorking(false);
      setWorkingLabel(null);
    }
  }, [enqueue, onMention, working]);

  // LGPD card: one tap records the decision; "Permitir" then answers the question that was waiting.
  const consent = useCallback(async (block: Extract<ChatBlock, { type: "consent" }>, allow: boolean) => {
    if (working) return false;
    setWorking(true);
    setStatus({ label: "Trabalhando...", tone: "working" });
    try {
      // Loaded on demand: only screens that show the card pull the server action.
      const saved = await import("@/features/ai-gateway/consent-actions")
        .then(({ decideAiConsentAction }) => decideAiConsentAction(allow ? "granted" : "declined"))
        .catch(() => ({ ok: false }));
      if (!saved.ok) {
        enqueue([{ type: "assistant", id: `consent-error-${Date.now()}`, text: "Não consegui salvar sua escolha. Toque de novo em alguns segundos." }]);
        setStatus({ label: "Esperando você", tone: "waiting" });
        return false;
      }
      if (!allow) {
        enqueue([{ type: "assistant", id: `consent-no-${Date.now()}`, text: "Tudo bem, sem IA. Continue pelas opções e pelo @. Se mudar de ideia, é só me perguntar de novo." }]);
        setStatus({ label: "Pronto", tone: "idle" });
        return true;
      }
      enqueue([{ type: "system", id: `consent-yes-${Date.now()}`, strong: "IA ligada.", text: "Você pode desligar em Notificações." }]);
      if (onFreeText) enqueue(await onFreeText(block.question));
      setStatus({ label: "Pronto", tone: "idle" });
      return true;
    } finally {
      setWorking(false);
    }
  }, [enqueue, onFreeText, working]);

  // Rows are memoized: they get stable handlers that always call the latest ones.
  const latest = useRef({ choose, swipeItem, onButtonOpen, mention, consent });
  useEffect(() => { latest.current = { choose, swipeItem, onButtonOpen, mention, consent }; });
  const rowHandlers = useMemo<RowHandlers>(() => ({
    choose: (question, choice) => { void latest.current.choose(question, choice); },
    swipe: (item) => latest.current.swipeItem(item),
    buttonOpen: (block, event) => latest.current.onButtonOpen?.(block, event),
    lead: (row) => { void latest.current.mention({ handle: `lead:${row.leadId}`, label: `@${row.name}`, note: "", group: "leads" }); },
    consent: (block, allow) => latest.current.consent(block, allow),
  }), []);

  const answeredCount = Object.keys(answers).length;
  const progress = progressOverride !== undefined
    ? progressOverride
    : script.progress ? { ...script.progress, done: Math.min(script.progress.total, script.progress.done + answeredCount) } : null;
  const lastQuestion = [...shown].reverse().find((block) => block.type === "question");
  const placeholder = placeholderOverride
    ?? (lastQuestion && !answers[lastQuestion.id] ? "Responda aqui ou escolha uma opção acima" : script.composerPlaceholder ?? `Escreva para ${identity.name}`);

  return (
    <div className={`${styles.root} ${embedded ? styles.screenEmbedded : fill ? styles.screenFill : styles.screen}`}>
      {embedded ? null : <header className={styles.header}>
        {/* History first (never stacks a new entry, so back never loops between two screens); parent when opened from outside. */}
        {fill ? null : <button type="button" className={styles.iconButton} aria-label="Voltar" onClick={() => goBackInApp(router, backHref)}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 5.5 8 10 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>}
        <div className={styles.headerIdentity}>
          <AssistantAvatar shape={identity.shape} hue={identity.hue} size={32} state={working ? "working" : "idle"} initials={identity.initials} temperature={identity.temperature} />
          <div style={{ minWidth: 0 }}>
            <div className={styles.headerName}>{identity.name}</div>
            {status ? (
              <div className={`${styles.headerStatus} ${status.tone === "waiting" ? styles.statusWaiting : ""}`} aria-live="polite">
                {status.tone === "working" ? <span className={styles.statusDot} aria-hidden="true" /> : null}
                {status.label}
              </div>
            ) : null}
          </div>
        </div>
        <div>{headerAction}</div>
      </header>}

      <div ref={scrollRef} className={styles.scroll} aria-live="polite" aria-relevant="additions">
        {topNotice ? <div className={styles.topNotice}>{topNotice}</div> : null}
        <div data-tour={tourTargets?.conversation} className={styles.thread_}>
          {embedded && emptyText && !shown.length ? <p className={styles.emptyThread}>{emptyText}</p> : null}
          {shown.map((block) => (
            <BlockRow key={block.id} block={block} chosenId={block.type === "question" ? answers[block.id] ?? null : null} working={working} handlers={rowHandlers} />
          ))}
          <AnimatePresence>{typing ? <MessageEnter key="typing"><TypingIndicator /></MessageEnter> : null}</AnimatePresence>
          {working ? (
            <MessageEnter key="working">
              <div className={styles.workingRow}>
                <AssistantAvatar shape={identity.shape} hue={identity.hue} size={40} state="working" />
                {workingLabel ? <span className={styles.shimmerText} role="status">{workingLabel}</span> : null}
              </div>
            </MessageEnter>
          ) : null}
        </div>
      </div>

      {embedded ? null : <Composer
        placeholder={placeholder}
        progress={progress}
        progressMascot={{ shape: identity.shape, hue: identity.hue }}
        working={working}
        disabled={composerDisabled}
        inputMode={composerInput?.inputMode}
        inputLabel={composerInput?.label}
        dataTour={tourTargets?.composer}
        onSend={async (text) => {
          setShown((current) => [...current, { type: "user", id: `free-${Date.now()}`, text, at: nowLabel() }]);
          if (!onFreeText) return;
          setWorking(true);
          try { enqueue(await onFreeText(text)); } finally { setWorking(false); }
        }}
        onMention={mention}
      />}
    </div>
  );
}

type RowHandlers = {
  choose: (question: Extract<ChatBlock, { type: "question" }>, choice: ChatChoice) => void;
  swipe: (item: ChatListItem) => void;
  buttonOpen: (block: Extract<ChatBlock, { type: "button" }>, event: React.MouseEvent<HTMLAnchorElement>) => void;
  lead: (row: ChatLeadRow) => void;
  consent: (block: Extract<ChatBlock, { type: "consent" }>, allow: boolean) => Promise<boolean>;
};

/** Blocks from the server are plain data: equal JSON means nothing to redraw. */
function sameBlock(a: ChatBlock, b: ChatBlock) {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/** One message of the conversation. Memoized: a refresh redraws only what changed. */
const BlockRow = memo(function BlockRow({ block, chosenId, working, handlers }: { block: ChatBlock; chosenId: string | null; working: boolean; handlers: RowHandlers }) {
  return (
    <MessageEnter>
      {block.type === "question"
        ? <ChoiceList block={block} chosenId={chosenId} disabled={working} onChoose={(choice) => handlers.choose(block, choice)} />
        : <ChatBlockView block={block} onButtonOpen={handlers.buttonOpen} onItemSwipe={handlers.swipe} swipeDisabled={working} onLeadOpen={handlers.lead} onConsent={handlers.consent} onSystemAction={(system) => { if (system.action) handlers.choose({ type: "question", id: `sys-${system.id}`, prompt: "", choices: [] }, { id: system.id, label: system.action.label, action: system.action.choiceAction }); }} />}
    </MessageEnter>
  );
});
