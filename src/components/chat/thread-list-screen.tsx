"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { goBackInApp } from "@/components/light/light-navigation";

import styles from "./chat.module.css";
import home from "./chat-home.module.css";
import { ThreadList } from "./thread-row";
import type { ThreadSummary } from "./types";

/**
 * A full-screen list of conversations in the chat look (header with back,
 * optional search, rows like the Início). Used where an old list screen
 * remained (all Insights conversations).
 */
export function ThreadListScreen({
  title,
  subtitle,
  backHref,
  threads,
  nowIso,
  emptyText,
  searchPlaceholder = "Buscar pelo nome",
}: {
  title: string;
  subtitle?: string;
  backHref: string;
  threads: ThreadSummary[];
  nowIso: string;
  emptyText: string;
  searchPlaceholder?: string;
}) {
  const router = useRouter();
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase("pt-BR");
  const visible = needle ? threads.filter((thread) => `${thread.name} ${thread.preview}`.toLocaleLowerCase("pt-BR").includes(needle)) : threads;

  return (
    <div className={`${styles.root} ${styles.screen}`}>
      <header className={styles.header}>
        <button type="button" className={styles.iconButton} aria-label="Voltar" onClick={() => goBackInApp(router, backHref)}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 5.5 8 10 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div className={styles.headerIdentity}>
          <div style={{ minWidth: 0 }}>
            <h1 className={styles.headerName} style={{ margin: 0 }}>{title}</h1>
            {subtitle ? <div className={styles.headerStatus}>{subtitle}</div> : null}
          </div>
        </div>
        <div />
      </header>
      <div className={styles.scroll}>
        <div className={home.search} style={{ paddingTop: 8 }}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} className={home.searchInput} />
        </div>
        <ThreadList threads={visible} now={now} emptyText={needle ? "Ninguém com esse nome." : emptyText} />
      </div>
    </div>
  );
}
