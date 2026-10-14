"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";

import type { TeamConversationSummary } from "./types";
import styles from "./team-conversations.module.css";

type Filter = "todas" | "aguardando" | "ia";

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("pt-BR") ?? "").join("") || "L";
const hueOf = (text: string) => [...text].reduce((total, char) => total + char.charCodeAt(0), 0) % 360;

export function formatWhen(iso: string, now = new Date()) {
  const date = new Date(iso);
  const sameDay = date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) === now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return sameDay
    ? date.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
}

/** The conversations of the brokers the viewer manages: who is talking to whom, and who is waiting for an answer. */
export function TeamConversationsList({ conversations, scopeLabel }: { conversations: TeamConversationSummary[]; scopeLabel: "unidade" | "equipe" }) {
  const [filter, setFilter] = useState<Filter>("todas");
  const [query, setQuery] = useState("");
  const waiting = conversations.filter((item) => item.lastFromClient).length;
  const brokers = new Set(conversations.map((item) => item.brokerId).filter(Boolean)).size;

  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return conversations.filter((item) => {
      if (filter === "aguardando" && !item.lastFromClient) return false;
      if (filter === "ia" && !item.lastByAi) return false;
      if (!term) return true;
      return item.leadName.toLocaleLowerCase("pt-BR").includes(term) || (item.brokerName ?? "").toLocaleLowerCase("pt-BR").includes(term);
    });
  }, [conversations, filter, query]);

  const filters: Array<{ id: Filter; label: string }> = [
    { id: "todas", label: `Todas ${conversations.length}` },
    { id: "aguardando", label: `Cliente esperando ${waiting}` },
    { id: "ia", label: "Com IA" },
  ];

  return (
    <div className={`arc-venancor ${styles.page}`}>
      <div className={styles.inner}>
        <header className={styles.enter}>
          <h1 className={styles.title}>Mensagens da {scopeLabel}</h1>
          <p className={styles.subtitle}>As conversas de WhatsApp dos corretores da sua {scopeLabel}. Somente leitura.</p>
        </header>

        <section className={`${styles.stats} ${styles.enter}`} style={{ "--i": 1 } as CSSProperties} aria-label="Resumo das conversas">
          <div className={styles.stat}><strong>{conversations.length}</strong><span>Conversas</span></div>
          <div className={styles.stat} data-alert={waiting > 0}><strong>{waiting}</strong><span>Cliente esperando resposta</span></div>
          <div className={styles.stat}><strong>{brokers}</strong><span>Corretores conversando</span></div>
        </section>

        <div className={`${styles.filters} ${styles.enter}`} style={{ "--i": 2 } as CSSProperties}>
          <div className={styles.segment} role="group" aria-label="Filtrar conversas">
            {filters.map((item) => (
              <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>
            ))}
          </div>
          <input className={styles.search} type="search" placeholder="Buscar por cliente ou corretor" aria-label="Buscar por cliente ou corretor" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>

        {visible.length ? (
          <ul className={styles.list}>
            {visible.map((item, index) => (
              <li key={item.leadId} className={styles.enter} style={{ "--i": Math.min(index + 3, 12) } as CSSProperties}>
                <Link href={`/mensagens/${encodeURIComponent(item.leadId)}`} className={styles.row}>
                  <span className={styles.avatar} style={{ "--hue": hueOf(item.leadName) } as CSSProperties} aria-hidden="true">{initials(item.leadName)}</span>
                  <span className={styles.rowMain}>
                    <span className={styles.rowTop}>
                      <span className={styles.leadName}>{item.leadName}</span>
                      <span className={styles.broker}>{item.brokerName ?? "Sem corretor"}</span>
                    </span>
                    <span className={styles.preview} data-waiting={item.lastFromClient}>
                      {item.lastFromClient ? "Cliente: " : item.lastByAi ? "IA: " : "Corretor: "}{item.lastBody || "Mídia"}
                    </span>
                  </span>
                  <span className={styles.meta}>
                    <span>{formatWhen(item.lastAt)}</span>
                    {item.lastFromClient ? <span className={styles.dot} aria-label="Cliente esperando resposta" /> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className={`${styles.empty} ${styles.enter}`}>
            <strong>{conversations.length ? "Nenhuma conversa neste filtro" : "Ainda não há conversas"}</strong>
            <p>{conversations.length ? "Troque o filtro ou a busca para ver outras conversas." : `Quando os corretores da sua ${scopeLabel} conversarem pelo WhatsApp conectado, as mensagens aparecem aqui.`}</p>
          </div>
        )}
      </div>
    </div>
  );
}
