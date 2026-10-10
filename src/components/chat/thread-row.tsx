"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import { AssistantAvatar } from "./assistant-avatar";
import styles from "./chat.module.css";
import type { ThreadSummary } from "./types";

/** "09:41" today, "ontem", or "29 set". Pure: `now` comes from the server snapshot. */
export function threadTime(iso: string | null, now: Date) {
  if (!iso) return "";
  const date = new Date(iso);
  const day = (value: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(value);
  if (day(date) === day(now)) return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(date);
  if (day(date) === day(new Date(now.getTime() - 86_400_000))) return "ontem";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "short" }).format(date).replace(".", "");
}

function VerifiedBadge() {
  return (
    <svg viewBox="0 0 16 16" className={styles.verified} role="img" aria-label="Verificado">
      <path fill="currentColor" d="M8 .8l1.7 1.3 2.1-.2.7 2 1.9 1-.5 2.1 1.2 1.8-1.4 1.6.1 2.1-2 .6-1 1.9-2.1-.4L8 15.2l-1.7-1.3-2.1.2-.7-2-1.9-1 .5-2.1L.9 7.2l1.4-1.6-.1-2.1 2-.6 1-1.9 2.1.4L8 .8Z" />
      <path fill="white" d="M7.1 10.6 4.8 8.3l1-1 1.3 1.3 3.1-3.1 1 1-4.1 4.1Z" />
    </svg>
  );
}

export function ThreadRow({ thread, now, index = 0 }: { thread: ThreadSummary; now: Date; index?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1], delay: reduce ? 0 : Math.min(index, 8) * 0.035 }}
    >
      <Link href={thread.href} className={styles.thread} data-tour={thread.assistant ? `thread-${thread.assistant}` : undefined} aria-label={`${thread.name}: ${thread.preview}${thread.waitingYou ? " (esperando você)" : ""}`}>
        <AssistantAvatar shape={thread.shape} hue={thread.hue} initials={thread.initials} temperature={thread.temperature} />
        <span className={styles.threadMain}>
          <span className={styles.threadTop}>
            <span className={styles.threadName}>{thread.name}</span>
            {thread.verified ? <VerifiedBadge /> : null}
          </span>
          <span className={`${styles.threadPreview} ${thread.waitingYou ? styles.threadPreviewWaiting : ""}`}>{thread.preview}</span>
        </span>
        <span className={styles.threadMeta}>
          <span className={styles.threadTime}>{threadTime(thread.at, now)}</span>
          {thread.unread || thread.waitingYou ? (
            <motion.span
              className={styles.unreadDot}
              aria-hidden="true"
              initial={reduce ? false : { scale: 0.4 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", visualDuration: 0.26, bounce: 0.3 }}
            />
          ) : <span style={{ height: 8 }} aria-hidden="true" />}
        </span>
      </Link>
    </motion.li>
  );
}

export function ThreadList({ threads, now, emptyText }: { threads: ThreadSummary[]; now: Date; emptyText: string }) {
  if (!threads.length) return <p style={{ padding: "32px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>{emptyText}</p>;
  return (
    <ul className={styles.threadList}>
      {threads.map((thread, index) => <ThreadRow key={thread.id} thread={thread} now={now} index={index} />)}
    </ul>
  );
}
