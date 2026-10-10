"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import BottomSheet from "@/components/arc/bottom-sheet/bottom-sheet";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { useLightAvailabilityContext } from "@/components/light/light-availability-context";

import { AssistantAvatar } from "./assistant-avatar";
import styles from "./chat.module.css";
import home from "./chat-home.module.css";
import { LiteWelcome } from "./lite-welcome";
import { LiteTour } from "./tour/lite-tour";
import { ThreadList } from "./thread-row";
import type { ThreadSummary } from "./types";

type Tab = "assistentes" | "leads";

function initialsOf(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("pt-BR")).join("") || "?";
}

function greeting(now: Date) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(now));
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}

function matches(thread: ThreadSummary, query: string) {
  const needle = query.trim().toLocaleLowerCase("pt-BR");
  return !needle || `${thread.name} ${thread.preview}`.toLocaleLowerCase("pt-BR").includes(needle);
}

function SearchIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}
function PlusIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}

/**
 * Broker home as a chat app: the assistants (each one cares for a part of
 * the work) and the leads, as conversations. Phones: one list with tabs and
 * the floating action; computers: the list on the side and the team at the
 * center.
 */
export function ChatHome({
  viewerName,
  assistants,
  leads,
  nowIso,
  canQuote,
}: {
  viewerName: string;
  assistants: ThreadSummary[];
  leads: ThreadSummary[];
  nowIso: string;
  canQuote: boolean;
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const reduce = useReducedMotion();
  const shell = useLightAvailabilityContext();
  const [tab, setTab] = useState<Tab>("assistentes");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const firstName = viewerName.split(/\s+/)[0] || viewerName;
  const waitingLeads = leads.filter((lead) => lead.waitingYou).length;
  const visible = (tab === "assistentes" ? assistants : leads).filter((thread) => matches(thread, query));
  const nextLead = leads.find((lead) => lead.waitingYou) ?? null;

  const list = (
    <>
      <div className={home.tabs} data-tour="home-tabs">
        <SegmentedControl
          label="Conversas"
          value={tab}
          onValueChange={(value) => setTab(value as Tab)}
          options={[
            { value: "assistentes", label: "Assistentes" },
            { value: "leads", label: "Leads", accessory: waitingLeads ? <span className={home.count}>{waitingLeads}</span> : undefined },
          ]}
        />
      </div>
      {searching ? (
        <div className={home.search}>
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === "leads" ? "Buscar lead" : "Buscar conversa"} aria-label="Buscar" className={home.searchInput} />
        </div>
      ) : null}
      {tab === "leads" ? (
        <div className={home.listShortcut}>
          <Link href="/minha-fila" className={styles.headerPill}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4h10M3 8h10M3 12h6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            Lista completa com filtros
          </Link>
        </div>
      ) : null}
      <ThreadList threads={visible} now={now} emptyText={tab === "leads" ? (query ? "Nenhum lead com esse nome." : "Nenhum lead com você agora.") : "Nada por aqui."} />
    </>
  );

  return (
    <div className={`${styles.root} ${home.page}`}>
      <aside className={home.sidebar}>
        <header className={home.header} data-tour="home-header">
          <button type="button" className={home.me} data-tour="home-me" aria-label="Abrir menu e disponibilidade" onClick={() => shell?.openMore?.()}>{initialsOf(viewerName)}</button>
          <h1 className={home.hello}>Olá, {firstName}</h1>
          <div className={home.headerTools} data-tour="home-tools">
            <button type="button" className={styles.iconButton} aria-label={searching ? "Fechar busca" : "Buscar"} aria-pressed={searching} onClick={() => { setSearching((value) => !value); setQuery(""); }}><SearchIcon /></button>
            <button type="button" className={styles.iconButton} aria-label="Novo" onClick={() => setNewOpen(true)}><PlusIcon /></button>
          </div>
        </header>
        {list}
      </aside>

      <section className={home.center} aria-label="Sua equipe">
        <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }} className={home.centerInner}>
          <h2 className={home.centerTitle}>{greeting(now)}, {firstName}</h2>
          <p className={home.centerSubtitle}>Seus assistentes</p>
          <ul className={home.cards}>
            {assistants.map((thread, index) => (
              <motion.li key={thread.id} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: reduce ? 0 : 0.06 + index * 0.04 }}>
                <Link href={thread.href} className={home.card}>
                  <AssistantAvatar shape={thread.shape} hue={thread.hue} size={52} state={thread.waitingYou ? "waiting" : "idle"} />
                  <span className={home.cardName}>{thread.name}</span>
                  <span className={home.cardPreview}>{thread.preview}</span>
                  {thread.waitingYou ? <span className={home.cardWaiting}><span className={styles.unreadDot} aria-hidden="true" /> Esperando você</span> : null}
                </Link>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </section>

      <div className={styles.pillWrap} data-mobile-only>
        {nextLead ? (
          <Link href={nextLead.href} className={styles.pill} data-tour="home-pill">Atender {nextLead.name.split(" ")[0]}</Link>
        ) : (
          <button type="button" className={styles.pill} data-tour="home-pill" onClick={() => setNewOpen(true)}><PlusIcon /> Novo atendimento</button>
        )}
      </div>

      <LiteWelcome />
      <LiteTour />

      <BottomSheet open={newOpen} onOpenChange={setNewOpen} title="O que você quer fazer?" className="arc-venancor">
        <ul className={home.newList}>
          {nextLead ? <li><Link href={nextLead.href} className={home.newItem} onClick={() => setNewOpen(false)}><strong>Atender {nextLead.name}</strong><span>{nextLead.preview}</span></Link></li> : null}
          {canQuote ? <li><Link href="/cotacao" className={home.newItem} onClick={() => setNewOpen(false)}><strong>Fazer uma cotação</strong><span>Simular planos para um cliente</span></Link></li> : null}
          <li><button type="button" className={home.newItem} onClick={() => { setNewOpen(false); setTab("leads"); setSearching(true); }}><strong>Buscar um lead</strong><span>Pelo nome ou telefone</span></button></li>
          <li><Link href="/dashboard/c/plantao" className={home.newItem} onClick={() => setNewOpen(false)}><strong>Ver meu plantão</strong><span>Agora e próximos</span></Link></li>
        </ul>
      </BottomSheet>
    </div>
  );
}
