"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import styles from "./chat.module.css";
import type { ChatProgress } from "./types";
import { AssistantAvatar } from "./assistant-avatar";
import type { MascotShape } from "./types";

export type Mention = { handle: string; label: string; note: string };

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
}) {
  const reduce = useReducedMotion();
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const query = /(^|\s)@(\w*)$/.exec(text)?.[2] ?? null;
  const matches = useMemo(() => (query === null ? [] : mentions.filter((item) => item.handle.startsWith(query.toLowerCase()))), [mentions, query]);
  const menuOpen = matches.length > 0;

  function pick(mention: Mention) {
    setText((current) => current.replace(/@\w*$/, ""));
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
    <div className={styles.composerWrap}>
      <div className={styles.composerInner}>
        <AnimatePresence>
          {menuOpen ? (
            <motion.ul
              className={styles.mentionMenu}
              role="listbox"
              aria-label="Comandos"
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: 4, transition: { duration: 0.12 } }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              {matches.map((item, index) => (
                <li key={item.handle}>
                  <button type="button" role="option" aria-selected={index === active} data-active={index === active} className={styles.mentionItem} onMouseDown={(event) => { event.preventDefault(); pick(item); }}>
                    <span className={styles.mentionHandle}>{item.label}</span>
                    <span className={styles.mentionNote}>{item.note}</span>
                  </button>
                </li>
              ))}
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
            aria-label={placeholder}
            disabled={disabled}
            onChange={(event) => {
              setText(event.target.value);
              setActive(0);
              event.target.style.height = "auto";
              event.target.style.height = `${Math.min(140, event.target.scrollHeight)}px`;
            }}
            onKeyDown={(event) => {
              if (menuOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
                event.preventDefault();
                setActive((current) => (current + (event.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length);
              } else if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (menuOpen) pick(matches[active]);
                else submit();
              } else if (event.key === "Escape" && menuOpen) {
                setText((current) => current.replace(/@\w*$/, ""));
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
