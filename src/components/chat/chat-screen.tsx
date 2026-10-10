"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { goBackInApp } from "@/components/light/light-navigation";
import { useRouter } from "next/navigation";
import { AnimatePresence, useReducedMotion } from "motion/react";

import { AssistantAvatar } from "./assistant-avatar";
import { ChatBlockView, ChoiceList, MessageEnter, TypingIndicator } from "./chat-blocks";
import { Composer, type Mention } from "./composer";
import styles from "./chat.module.css";
import type { ChatAction, ChatBlock, ChatChoice, ChatProgress, ChatScript, MascotShape } from "./types";

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
  composerDisabled = false,
  onLocalChoice,
  progress: progressOverride,
  placeholder: placeholderOverride,
  composerInput,
  onButtonOpen,
  instant = false,
}: {
  identity: Identity;
  backHref: string;
  script: ChatScript;
  runAction?: ChatActionRunner;
  /** Free text from the composer (a note, a question). Returns the assistant's answer blocks. */
  onFreeText?: (text: string) => Promise<ChatBlock[]>;
  onMention?: (mention: Mention) => Promise<ChatBlock[]> | ChatBlock[];
  headerAction?: ReactNode;
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
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const hidden = useMemo(() => hiddenQuestionIds(script.blocks), [script.blocks]);
  const initial = useMemo(() => script.blocks.filter((block) => !hidden.has(block.id)), [hidden, script.blocks]);

  // Blocks already on screen, and the queue still to be "typed".
  const [shown, setShown] = useState<ChatBlock[]>(() => (reduce || instant ? initial : initial.slice(0, 1)));
  const [queue, setQueue] = useState<ChatBlock[]>(() => (reduce || instant ? [] : initial.slice(1)));
  const firstScroll = useRef(true);
  const [typing, setTyping] = useState(false);
  const [working, setWorking] = useState(false);
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
      if (target) enqueue([target]);
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
      if (result.ok) router.refresh();
    } catch {
      enqueue([{ type: "assistant", id: `error-${question.id}`, text: "Não consegui concluir agora. Tente de novo em instantes." }]);
      setStatus({ label: "Esperando você", tone: "waiting" });
      setAnswers((current) => { const next = { ...current }; delete next[question.id]; return next; });
    } finally {
      setWorking(false);
    }
  }, [answers, enqueue, onLocalChoice, router, runAction, script.blocks]);

  const answeredCount = Object.keys(answers).length;
  const progress = progressOverride !== undefined
    ? progressOverride
    : script.progress ? { ...script.progress, done: Math.min(script.progress.total, script.progress.done + answeredCount) } : null;
  const lastQuestion = [...shown].reverse().find((block) => block.type === "question");
  const placeholder = placeholderOverride
    ?? (lastQuestion && !answers[lastQuestion.id] ? "Responda aqui ou escolha uma opção acima" : script.composerPlaceholder ?? `Escreva para ${identity.name}`);

  return (
    <div className={`${styles.root} ${styles.screen}`}>
      <header className={styles.header}>
        {/* History first (never stacks a new entry, so back never loops between two screens); parent when opened from outside. */}
        <button type="button" className={styles.iconButton} aria-label="Voltar" onClick={() => goBackInApp(router, backHref)}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 5.5 8 10 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
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
      </header>

      <div ref={scrollRef} className={styles.scroll} aria-live="polite" aria-relevant="additions">
        <div className={styles.thread_}>
          {shown.map((block) => (
            <MessageEnter key={block.id}>
              {block.type === "question"
                ? <ChoiceList block={block} chosenId={answers[block.id] ?? null} disabled={working} onChoose={(choice) => { void choose(block, choice); }} />
                : <ChatBlockView block={block} onButtonOpen={onButtonOpen} onSystemAction={(system) => { if (system.action) void choose({ type: "question", id: `sys-${system.id}`, prompt: "", choices: [] }, { id: system.id, label: system.action.label, action: system.action.choiceAction }); }} />}
            </MessageEnter>
          ))}
          <AnimatePresence>{typing ? <MessageEnter key="typing"><TypingIndicator /></MessageEnter> : null}</AnimatePresence>
          {working ? <MessageEnter key="working"><AssistantAvatar shape={identity.shape} hue={identity.hue} size={40} state="working" /></MessageEnter> : null}
        </div>
      </div>

      <Composer
        placeholder={placeholder}
        progress={progress}
        progressMascot={{ shape: identity.shape, hue: identity.hue }}
        working={working}
        disabled={composerDisabled}
        inputMode={composerInput?.inputMode}
        inputLabel={composerInput?.label}
        onSend={async (text) => {
          setShown((current) => [...current, { type: "user", id: `free-${Date.now()}`, text, at: nowLabel() }]);
          if (!onFreeText) return;
          setWorking(true);
          try { enqueue(await onFreeText(text)); } finally { setWorking(false); }
        }}
        onMention={onMention ? async (mention) => { enqueue(await onMention(mention)); } : undefined}
      />
    </div>
  );
}
