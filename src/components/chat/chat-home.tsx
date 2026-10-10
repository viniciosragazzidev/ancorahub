"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
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

/** The day at a glance, for the center of the Início on computers. */
export type HomeSummary = {
  receivedToday: number;
  acceptedToday: number;
  inServiceNow: number;
  slaAtRiskNow: number;
  duty: { title: string; detail: string; href: string } | null;
  goal: { name: string; percentage: number; currentValue: string; targetValue: string } | null;
};

/** The thread whose screen is open (computers keep the list beside it). */
function isActive(thread: ThreadSummary, pathname: string) {
  const path = thread.href.split("?")[0];
  return path === pathname || (thread.leadId ? pathname === `/leads/${thread.leadId}` : false);
}

/**
 * Broker home as a chat app: the assistants (each one cares for a part of
 * the work) and the leads, as conversations.
 * - mode "page" (route /dashboard): phones get the list with tabs and the
 *   floating action; computers get the day at a glance at the center (the
 *   list lives in the rail).
 * - mode "rail": the same list, fixed on the left of every Lite screen on
 *   computers, with the open conversation highlighted.
 */
export function ChatHome({
  viewerName,
  assistants,
  leads,
  nowIso,
  canQuote,
  mode = "page",
  summary = null,
}: {
  viewerName: string;
  assistants: ThreadSummary[];
  leads: ThreadSummary[];
  nowIso: string;
  canQuote: boolean;
  mode?: "page" | "rail";
  summary?: HomeSummary | null;
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const reduce = useReducedMotion();
  const shell = useLightAvailabilityContext();
  const pathname = usePathname() ?? "";
  const [tab, setTab] = useState<Tab>("assistentes");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const firstName = viewerName.split(/\s+/)[0] || viewerName;
  const waitingLeads = leads.filter((lead) => lead.waitingYou).length;
  const visible = (tab === "assistentes" ? assistants : leads).filter((thread) => matches(thread, query));
  const nextLead = leads.find((lead) => lead.waitingYou) ?? null;
  const activeId = mode === "rail" ? [...assistants, ...leads].find((thread) => isActive(thread, pathname))?.id ?? null : null;
  const waitingAssistants = assistants.filter((thread) => thread.waitingYou);

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
      <ThreadList threads={visible} now={now} activeId={activeId} emptyText={tab === "leads" ? (query ? "Nenhum lead com esse nome." : "Nenhum lead com você agora.") : "Nada por aqui."} />
    </>
  );

  const aside = (
    <aside className={home.sidebar}>
      <header className={home.header} data-tour="home-header">
        <button type="button" className={home.me} data-tour="home-me" aria-label="Abrir menu e disponibilidade" onClick={() => shell?.openMore?.()}>{initialsOf(viewerName)}</button>
        <Link href="/dashboard" className={home.helloLink}><h1 className={home.hello}>Olá, {firstName}</h1></Link>
        <div className={home.headerTools} data-tour="home-tools">
          <button type="button" className={styles.iconButton} aria-label={searching ? "Fechar busca" : "Buscar"} aria-pressed={searching} onClick={() => { setSearching((value) => !value); setQuery(""); }}><SearchIcon /></button>
          <button type="button" className={styles.iconButton} aria-label="Novo" onClick={() => setNewOpen(true)}><PlusIcon /></button>
        </div>
      </header>
      {list}
    </aside>
  );

  const sheet = (
    <BottomSheet open={newOpen} onOpenChange={setNewOpen} title="O que você quer fazer?" className="arc-venancor">
      <ul className={home.newList}>
        {nextLead ? <li><Link href={nextLead.href} className={home.newItem} onClick={() => setNewOpen(false)}><strong>Atender {nextLead.name}</strong><span>{nextLead.preview}</span></Link></li> : null}
        {canQuote ? <li><Link href="/cotacao" className={home.newItem} onClick={() => setNewOpen(false)}><strong>Fazer uma cotação</strong><span>Simular planos para um cliente</span></Link></li> : null}
        <li><button type="button" className={home.newItem} onClick={() => { setNewOpen(false); setTab("leads"); setSearching(true); }}><strong>Buscar um lead</strong><span>Pelo nome ou telefone</span></button></li>
        <li><Link href="/dashboard/c/plantao" className={home.newItem} onClick={() => setNewOpen(false)}><strong>Ver meu plantão</strong><span>Agora e próximos</span></Link></li>
      </ul>
    </BottomSheet>
  );

  if (mode === "rail") {
    return (
      <div className={`${styles.root} ${home.rail}`}>
        {aside}
        {sheet}
      </div>
    );
  }

  const stats = summary
    ? [
      { label: "Recebidos hoje", value: summary.receivedToday },
      { label: "Aceitos hoje", value: summary.acceptedToday },
      { label: "Em atendimento", value: summary.inServiceNow },
      { label: "Primeiro contato atrasando", value: summary.slaAtRiskNow, alert: summary.slaAtRiskNow > 0 },
    ]
    : [];

  return (
    <div className={`${styles.root} ${home.page}`}>
      {aside}

      <section className={home.center} aria-label="Seu dia">
        <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }} className={home.centerInner}>
          <AssistantAvatar shape="logo" hue={null} size={56} />
          <h2 className={home.centerTitle}>{greeting(now)}, {firstName}</h2>
          <p className={home.centerSubtitle}>
            {nextLead
              ? `${nextLead.name.split(" ")[0]} está esperando você. Escolha uma conversa à esquerda ou comece por ela.`
              : waitingAssistants.length
                ? `${waitingAssistants.map((thread) => thread.name).join(", ")} ${waitingAssistants.length === 1 ? "tem algo" : "têm algo"} para você. Escolha uma conversa à esquerda.`
                : "Tudo em dia. Escolha uma conversa à esquerda para começar."}
          </p>
          {nextLead ? (
            <Link href={nextLead.href} className={styles.pill} style={{ marginTop: 6 }}>Atender {nextLead.name.split(" ")[0]}</Link>
          ) : null}

          {stats.length ? (
            <ul className={home.stats}>
              {stats.map((stat, index) => (
                <motion.li
                  key={stat.label}
                  className={`${home.stat} ${stat.alert ? home.statAlert : ""}`}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: reduce ? 0 : 0.08 + index * 0.04 }}
                >
                  <span className={home.statValue}>{stat.value}</span>
                  <span className={home.statLabel}>{stat.label}</span>
                </motion.li>
              ))}
            </ul>
          ) : null}

          {summary?.duty || summary?.goal ? (
            <div className={home.cards}>
              {summary.duty ? (
                <Link href={summary.duty.href} className={home.card}>
                  <AssistantAvatar shape="onigiri" hue={28} size={40} />
                  <span className={home.cardName}>{summary.duty.title}</span>
                  <span className={home.cardPreview}>{summary.duty.detail}</span>
                </Link>
              ) : null}
              {summary.goal ? (
                <Link href="/dashboard/c/desempenho" className={home.card}>
                  <AssistantAvatar shape="nuvem" hue={330} size={40} />
                  <span className={home.cardName}>{summary.goal.name}</span>
                  <span className={home.goalTrack} aria-hidden="true"><motion.span className={home.goalFill} initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: Math.min(1, summary.goal.percentage / 100) }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: reduce ? 0 : 0.2 }} /></span>
                  <span className={home.cardPreview}>{summary.goal.currentValue} de {summary.goal.targetValue} · {summary.goal.percentage}%</span>
                </Link>
              ) : null}
            </div>
          ) : null}
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
      {sheet}
    </div>
  );
}
