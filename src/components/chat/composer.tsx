"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import styles from "./chat.module.css";
import { fetchMentionMenu } from "./mention-client";
import type { ChatProgress } from "./types";
import { AssistantAvatar } from "./assistant-avatar";
import type { MascotShape } from "./types";

export type Mention = {
  handle: string; label: string; note: string;
  /** Section of the @ menu: shortcuts bring live blocks, leads open the quick card, assistants open the conversation. */
  group?: "atalhos" | "leads" | "assistentes";
  /** Live count shown at the end of a shortcut (e.g. 3 waiting). */
  count?: number;
  tone?: "info" | "success" | "warning" | "danger" | "neutral";
  /** Leads: initials instead of the @ mark. */
  initials?: string;
};

/** The @ commands of the broker chat; each opens a card with that data. */
export const BROKER_MENTIONS: Mention[] = [
  { handle: "leads", label: "@leads", note: "Seus leads e o que espera você" },
  { handle: "plantao", label: "@plantao", note: "Plantão agora e próximos" },
  { handle: "agenda", label: "@agenda", note: "Retornos e tarefas de hoje" },
  { handle: "cotacao", label: "@cotacao", note: "Começar uma cotação" },
  { handle: "desempenho", label: "@desempenho", note: "Seus números do dia e do mês" },
];

function Icon({ d }: { d: string }) {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d={d} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

const SECTION_LABEL = { atalhos: "Atalhos", leads: "Leads", assistentes: "Assistentes" } as const;

/** Accent- and case-insensitive match for the @ search. */
function fold(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

const SHORTCUT_ICON: Record<string, string> = {
  "block:precisa": "M8 2.5a4 4 0 0 0-4 4v2.2L2.8 11h10.4L12 8.7V6.5a4 4 0 0 0-4-4ZM6.5 13a1.5 1.5 0 0 0 3 0",
  "block:responderam": "M3 4.5h10v6H8l-3 2.5v-2.5H3z",
  "block:retornos": "M4 2.5v2M12 2.5v2M2.8 6.5h10.4M3.5 4h9a.7.7 0 0 1 .7.7v8.1a.7.7 0 0 1-.7.7h-9a.7.7 0 0 1-.7-.7V4.7a.7.7 0 0 1 .7-.7Z",
  "block:meu-dia": "M3 13V9M6.3 13V6M9.6 13V8M13 13V3.5",
};

function ShortcutIcon({ handle }: { handle: string }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d={SHORTCUT_ICON[handle] ?? SHORTCUT_ICON["block:precisa"]} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The chat's input: grows with the text, sends on Enter, "@" opens the
 * commands. While the assistant works the send button becomes "parar".
 */
export function Composer({
  placeholder = "Escreva aqui",
  progress,
  progressMascot,
  working = false,
  disabled = false,
  mentions = BROKER_MENTIONS,
  onSend,
  onMention,
  onStop,
  inputMode,
  inputLabel,
  dataTour,
}: {
  placeholder?: string;
  progress?: ChatProgress | null;
  progressMascot?: { shape: MascotShape; hue: number | null };
  working?: boolean;
  disabled?: boolean;
  mentions?: Mention[];
  onSend: (text: string) => void | Promise<void>;
  onMention?: (mention: Mention) => void;
  onStop?: () => void;
  /** Keyboard for the current answer (e.g. "numeric" for ages). */
  inputMode?: "text" | "numeric";
  /** Accessible name when the field answers a question ("Idades de quem vai entrar no plano"). */
  inputLabel?: string;
  dataTour?: string;
}) {
  const reduce = useReducedMotion();
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const menuId = useId();
  const query = /(^|\s)@([\p{L}\w]*)$/u.exec(text)?.[2] ?? null;
  // Live shortcuts and leads, loaded the first time the @ menu opens (assistants stay local).
  const [live, setLive] = useState<Mention[] | null>(null);
  const menuWanted = query !== null;
  useEffect(() => {
    if (!menuWanted) return;
    // Refreshes on every open (the client caches for 30s); the last menu stays on screen meanwhile.
    let alive = true;
    void fetchMentionMenu().then((menu) => { if (alive) setLive(menu); });
    return () => { alive = false; };
  }, [menuWanted]);
  const matches = useMemo(() => {
    if (query === null) return [];
    const q = fold(query);
    const all = [...(live ?? []), ...mentions.map((item) => ({ ...item, group: item.group ?? ("assistentes" as const) }))];
    const found = all.filter((item) => !q || fold(`${item.handle} ${item.label} ${item.note}`).includes(q));
    // With nothing typed: every shortcut, the first leads and the assistants.
    if (!q) return [...found.filter((i) => i.group === "atalhos"), ...found.filter((i) => i.group === "leads").slice(0, 4), ...found.filter((i) => i.group === "assistentes")];
    return found.slice(0, 10);
  }, [live, mentions, query]);
  const loadingLive = query !== null && live === null;
  const menuOpen = matches.length > 0 || loadingLive;

  function pick(mention: Mention | undefined) {
    if (!mention) return;
    setText((current) => current.replace(/@[\p{L}\w]*$/u, ""));
    onMention?.(mention);
    inputRef.current?.focus();
  }

  function submit() {
    const value = text.trim();
    if (!value || disabled) return;
    setText("");
    void onSend(value);
  }

  return (
    <div data-tour={dataTour} className={styles.composerWrap}>
      <div className={styles.composerInner}>
        <AnimatePresence>
          {menuOpen ? (
            <motion.ul
              className={styles.mentionMenu}
              id={menuId}
              role="listbox"
              aria-label="Comandos"
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: 4, transition: { duration: 0.12 } }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              {loadingLive ? <li role="presentation" className={styles.mentionLoading} aria-live="polite"><span className={styles.shimmerText}>Buscando seus leads…</span></li> : null}
              {matches.map((item, index) => {
                const section = item.group ?? "assistentes";
                const first = index === 0 || (matches[index - 1].group ?? "assistentes") !== section;
                return (
                  <li key={item.handle} role="presentation">
                    {first ? <span className={styles.mentionSection} aria-hidden="true">{SECTION_LABEL[section]}</span> : null}
                    <motion.button
                      type="button"
                      id={`${menuId}-${index}`}
                      role="option"
                      aria-selected={index === active}
                      data-active={index === active}
                      data-group={section}
                      className={styles.mentionItem}
                      initial={reduce ? false : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, delay: reduce ? 0 : Math.min(index, 8) * 0.025, ease: [0.165, 0.84, 0.44, 1] }}
                      onMouseDown={(event) => { event.preventDefault(); pick(item); }}
                    >
                      <span className={styles.mentionMark} data-group={section} aria-hidden="true">
                        {section === "leads" ? (item.initials ?? "?") : section === "atalhos" ? <ShortcutIcon handle={item.handle} /> : "@"}
                      </span>
                      <span className={styles.mentionText}>
                        <span className={styles.mentionHandle}>{section === "assistentes" ? item.label : item.label.replace(/^@/, "")}</span>
                        <span className={styles.mentionNote}>{item.note}</span>
                      </span>
                      {typeof item.count === "number" ? <span className={styles.mentionCount} data-tone={item.count > 0 ? item.tone ?? "info" : "neutral"}>{item.count}</span> : null}
                    </motion.button>
                  </li>
                );
              })}
            </motion.ul>
          ) : null}
        </AnimatePresence>
        {progress ? (
          <div className={styles.progress} aria-live="polite">
            <span className={styles.progressTitle}>
              {progressMascot ? <AssistantAvatar shape={progressMascot.shape} hue={progressMascot.hue} size={20} /> : null}
              {progress.title}
            </span>
            <span className={styles.progressCount}>{progress.done} de {progress.total}</span>
          </div>
        ) : null}
        <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); if (menuOpen) pick(matches[active]); else submit(); }}>
          <textarea
            ref={inputRef}
            className={styles.composerInput}
            rows={1}
            value={text}
            placeholder={placeholder}
            aria-label={inputLabel ?? placeholder}
            role="combobox"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? menuId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={menuOpen && matches[active] ? `${menuId}-${active}` : undefined}
            inputMode={inputMode}
            disabled={disabled}
            onChange={(event) => {
              setText(event.target.value);
              setActive(0);
              event.target.style.height = "auto";
              event.target.style.height = `${Math.min(140, event.target.scrollHeight)}px`;
            }}
            onKeyDown={(event) => {
              if (matches.length > 0 && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
                event.preventDefault();
                setActive((current) => (current + (event.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length);
              } else if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (menuOpen) pick(matches[active]);
                else submit();
              } else if (event.key === "Escape" && menuOpen) {
                setText((current) => current.replace(/@[\p{L}\w]*$/u, ""));
              }
            }}
          />
          <div className={styles.composerTools}>
            <div className={styles.toolGroup}>
              <button type="button" className={styles.tool} aria-label="Comandos com @" onClick={() => { setText((current) => `${current}${current && !current.endsWith(" ") ? " " : ""}@`); inputRef.current?.focus(); }}>
                <Icon d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm0 0v1a1.75 1.75 0 0 0 3.5 0V8a6 6 0 1 0-2.4 4.8" />
              </button>
            </div>
            {working ? (
              <button type="button" className={styles.send} aria-label="Parar" onClick={onStop}>
                <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4.5" y="4.5" width="7" height="7" rx="1.5" fill="currentColor" /></svg>
              </button>
            ) : (
              <button type="submit" className={styles.send} aria-label="Enviar" disabled={!text.trim() || disabled}>
                <Icon d="M8 13V3m0 0L3.5 7.5M8 3l4.5 4.5" />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
