"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import BottomSheet from "@/components/arc/bottom-sheet/bottom-sheet";
import { motionTokens } from "@/components/arc/motion-tokens";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { SearchField } from "@/components/arc/search-field/search-field";
import { Button as ArcButton } from "@/components/arc/button/button";
import { Badge as ArcBadge } from "@/components/arc/badge/badge";
import { Avatar } from "@/components/arc/avatar/avatar";
import { Button } from "@/components/ui/button";
import { Activity, AlarmClock, ArrowUpRight, Bell, CheckCircle2, Headset, House, Inbox, ListTodo } from "lucide-react";
import { LightAvailabilityPill } from "@/components/light-top-nav";
import sharedPage from "@/components/lite/page/lite-page.module.css";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useLightAvailabilityContext } from "@/components/light/light-availability-context";

// Loaded on the client only: it reads the broker's WhatsApp session (server actions).
// Server action inside: loaded on demand so the screen (and its tests) stay client-only.
const AcceptLeadButton = dynamic(() => import("@/features/broker-workspace/components/accept-lead-button").then((mod) => mod.AcceptLeadButton), { ssr: false });
const WhatsAppStatusButton = dynamic(() => import("@/components/whatsapp/whatsapp-status-button").then((mod) => mod.WhatsAppStatusButton), { ssr: false });
import { AssistantAvatar } from "./assistant-avatar";
import { PresenceCalloutList } from "./presence-callout";
import styles from "./chat.module.css";
import { FirstStepsCard } from "@/features/assist/components/first-steps-card";
import type { FirstStep } from "@/features/assist/first-steps";
import home from "./chat-home.module.css";
import { GoalReached } from "./goal-reached";
import { LiteWelcome } from "./lite-welcome";
import { LiteTour } from "./tour/lite-tour";
import { ThreadList } from "./thread-row";
import { WeekRanking, type HomeHighlights } from "./week-ranking";
import type { HomeNowItem, PresenceAskView, ThreadSummary } from "./types";
import type { WhatsAppActivitySummary } from "@/features/dashboard/whatsapp-activity";
import { WhatsAppActivityCard } from "@/features/dashboard/components/whatsapp-activity-card";
import { ContextualIllustration } from "@/components/illustrations/contextual-illustration";
import { BrokerHomeOverview } from "./broker-home-overview";
import { AnnouncementBanner, HomeBanner, HomeWelcomeBanner } from "./home-banner";
import type { HomeAnnouncementView } from "@/features/home-announcement/announcement";
import { HomeQuickActions, homeQuickActions } from "./home-quick-actions";
import { QuickRegisterSaleSheet } from "@/features/broker-workspace/components/quick-register-sale";
import { RisePulse, useRisePulseKey } from "@/components/light/rise-pulse";
import { LitePress } from "@/components/lite/motion";
import { useInterfaceMotionEnabled } from "@/components/motion/interface-motion-provider";
import { useFirstTimeToday } from "@/components/motion/first-time-today/use-first-time-today";
import { offerHaloClass, useOfferPendingAttributes } from "@/features/broker-workspace/components/accept-lead-style";

type Tab = "assistentes" | "leads";

function formatCountdown(expiresAt: string, now: number) {
  const seconds = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
  if (seconds <= 0) return "Prazo encerrado";
  const minutes = Math.ceil(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `Aceite em até ${hours} h ${minutes % 60} min` : `Aceite em até ${minutes} min`;
}

/** Short status shown on each Agora card, so the tone never depends on color alone. */
const NOW_TONE_LABEL: Partial<Record<NonNullable<HomeNowItem["tone"]>, string>> = {
  urgent: "Urgente",
  waiting: "Esperando você",
  warning: "Atenção",
};

function NowSection({ data, mobile = false, floating = false, onNavigate }: { data: NonNullable<HomeSummary["now"]>; mobile?: boolean; floating?: boolean; onNavigate?: () => void }) {
  const reduce = useReducedMotion();
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <motion.section
      className={floating ? home.nowPanel : `${home.nowSection} ${mobile ? home.nowMobile : home.nowDesktop}`}
      aria-label={data.title}
      initial={reduce || floating ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: motionTokens.duration.standard, ease: motionTokens.ease.enter }}
    >
      {!floating ? <header className={home.nowHeader}>
        <h2 className={home.nowTitle}>{data.title}</h2>
        {data.items.length ? <span className={home.nowCount}>{data.items.length}</span> : null}
      </header> : null}
      {data.items.length ? (
        <ul className={home.nowList}>
          {data.items.map((item, index) => (
            <motion.li
              key={item.id}
              className={home.nowItem}
              data-tone={item.tone ?? "normal"}
              data-offer={item.acceptLeadId && !floating ? "" : undefined}
              layout={!reduce}
              initial={reduce || floating ? false : { opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: motionTokens.duration.fast, delay: reduce ? 0 : index * motionTokens.stagger.item, ease: motionTokens.ease.enter }}
            >
              {floating ? <span className={home.nowItemAvatar} aria-hidden="true"><Avatar name={item.title} size="sm" /></span> : null}
              <div className={home.nowItemCopy}>
                {floating && item.tone && NOW_TONE_LABEL[item.tone] ? <span className={home.nowItemTone} data-tone={item.tone}>{NOW_TONE_LABEL[item.tone]}</span> : null}
                <strong className={home.nowItemTitle}>{item.title}</strong>
                <span className={home.nowItemDetail}>{item.detail}</span>
                {item.expiresAt ? <span className={home.nowCountdown}>{formatCountdown(item.expiresAt, clock)}</span> : null}
              </div>
              <div className={floating ? home.nowItemActions : item.acceptLeadId ? home.nowItemOffer : undefined}>{item.acceptLeadId ? (
                <AcceptLeadButton appearance="shared" leadId={item.acceptLeadId} className={index === 0 ? undefined : home.secondaryAction} offerPending={index === 0 && !floating} disabled={Boolean(item.expiresAt && Date.parse(item.expiresAt) <= clock)}>{item.expiresAt && Date.parse(item.expiresAt) <= clock ? "Oferta encerrada" : item.actionLabel}</AcceptLeadButton>
              ) : (
                <Button asChild variant="secondary" className={floating && index === 0 ? sharedPage.primaryButton : sharedPage.button}><Link href={item.href} onClick={onNavigate}>{item.actionLabel}<ArrowUpRight size={16} aria-hidden="true" /></Link></Button>
              )}</div>
            </motion.li>
          ))}
        </ul>
      ) : <div className="flex items-center gap-3"><ContextualIllustration name="checklist" size="sm" /><p className={home.nowEmpty}>{data.emptyText}</p></div>}
    </motion.section>
  );
}

function initialsOf(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("pt-BR")).join("") || "?";
}

/** Ícone de cada número do Início no computador (14/11/2026), no quadrado de cor dos cartões do Lite. */
const STAT_ICON: Record<string, ReactNode> = {
  "Recebidos hoje": <Inbox size={16} />,
  "Aceitos hoje": <CheckCircle2 size={16} />,
  "Em atendimento": <Headset size={16} />,
  "Contato atrasando": <AlarmClock size={16} />,
};

function greeting(now: Date) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(now));
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}

function matches(thread: ThreadSummary, query: string) {
  const needle = query.trim().toLocaleLowerCase("pt-BR");
  return !needle || `${thread.name} ${thread.preview}`.toLocaleLowerCase("pt-BR").includes(needle);
}

function PlusIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}

/** The day at a glance, for the center of the Início on computers. */
export type HomeSummary = {
  receivedToday: number;
  acceptedToday: number;
  inServiceNow: number;
  slaAtRiskNow: number;
  duty: { title: string; detail: string; href: string } | null;
  goal: { name: string; percentage: number; currentValue: string; targetValue: string } | null;
  /** Replaces the four broker numbers (supervisor: the team's day). */
  stats?: { label: string; value: number; alert?: boolean }[];
  /** "A próxima coisa é": the one most important thing now (offer > SLA > reply > return > mission). */
  next?: { label: string; detail: string; href: string; urgent: boolean; acceptLeadId?: string } | null;
  now?: { title: string; emptyText: string; items: HomeNowItem[] } | null;
};

export type { HomeHighlights } from "./week-ranking";

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
/**
 * "Primeiros passos" (missões do corretor novo) saiu do Início em 19/11/2026:
 * a entrada fica limpa e as missões vão ganhar outro lugar. Os dados continuam
 * chegando por `firstSteps`; basta ligar aqui para voltar a mostrar o cartão.
 */
const SHOW_FIRST_STEPS = false;

export function ChatHome({
  viewerName,
  assistants,
  leads,
  nowIso,
  canQuote,
  leadsBadgeCount,
  mode = "page",
  summary = null,
  highlights = null,
  firstSteps: firstStepsInput = null,
  presence = null,
  presenceAsks = null,
  whatsappActivity = null,
  showWhatsAppStatus = true,
  nowFloatingEnabled = false,
  homeActions = false,
  financeCard = null,
  quickSaleEnabled = false,
  announcement = null,
  unreadNotifications,
}: {
  viewerName: string;
  assistants: ThreadSummary[];
  leads: ThreadSummary[];
  nowIso: string;
  canQuote: boolean;
  leadsBadgeCount?: number;
  mode?: "page" | "rail";
  summary?: HomeSummary | null;
  highlights?: HomeHighlights | null;
  /** New broker: what is left to set up (null once done). */
  firstSteps?: FirstStep[] | null;
  /** Plantão to confirm now: highlighted at the top of the Início until confirmed. */
  presence?: PresenceAskView | null;
  /** All active and imminent occurrences. `presence` remains as a compatibility fallback. */
  presenceAsks?: PresenceAskView[] | null;
  /** Scoped team metric, passed only to manager and supervisor homes. */
  whatsappActivity?: WhatsAppActivitySummary | null;
  /** Anonymous component previews omit this authenticated, server-backed widget. */
  showWhatsAppStatus?: boolean;
  /** Server-controlled presentation switch; disabling restores the inline block. */
  nowFloatingEnabled?: boolean;
  /** Início organizado (BROKER_HOME_ACTIONS): Ações rápidas, Meu mês e Sua semana no fim. */
  homeActions?: boolean;
  /** Cartão Meu mês (financeiro do próprio corretor), só quando o módulo financeiro está liberado. */
  financeCard?: ReactNode;
  /** Registrar venda em dois toques (BROKER_QUICK_SALE): escolher o lead e abrir o registro dele. */
  quickSaleEnabled?: boolean;
  /** Aviso da diretoria no ar: ocupa o banner do capitão no lugar do padrão. */
  announcement?: HomeAnnouncementView | null;
  /** Avisos não lidos no sino do topo (corretor e supervisor). Ausente: sem sino (gestor tem a linha Notificações). */
  unreadNotifications?: number;
}) {
  const firstSteps = SHOW_FIRST_STEPS ? firstStepsInput : null;
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const reduce = useReducedMotion();
  const shell = useLightAvailabilityContext();
  const isSupervisor = shell?.audience === "supervisor";
  const isManager = shell?.audience === "manager";
  const redesigned = Boolean(shell?.homeRedesign && !isSupervisor && !isManager);
  const floatingNow = nowFloatingEnabled && !isSupervisor && !isManager && Boolean(summary?.now);
  const [nowOpen, setNowOpen] = useState(false);
  // Small phones stack the action under the text (chat-home.module.css), so each card is taller.
  const compactNow = useMediaQuery("(max-width: 359px), (max-height: 720px)");
  const pathname = usePathname() ?? "";
  const [tab, setTab] = useState<Tab>("assistentes");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [newOpen, setNewOpen] = useState(false);
  const firstName = viewerName.split(/\s+/)[0] || viewerName;
  const waitingLeads = leadsBadgeCount ?? leads.filter((lead) => lead.waitingYou).length;
  // A contagem da aba Leads (a fila no Lite) pulsa uma vez quando sobe; nunca ao descer.
  const leadsPulse = useRisePulseKey(waitingLeads);
  const visible = (tab === "assistentes" ? assistants : leads).filter((thread) => matches(thread, query));
  const nextLead = leads.find((lead) => lead.waitingYou) ?? null;
  const next = summary?.next ?? null;
  const hasNowItems = Boolean(summary?.now?.items.length);
  const showNext = Boolean(next && !hasNowItems);
  // Oferta esperando o corretor (item do Agora com aceite e ainda no prazo): o "Agora" flutuante avisa e pulsa.
  // O `now` vem do servidor e não anda: um timer acorda no fim da oferta mais próxima para o anel parar quando ela expira.
  const [offerClock, setOfferClock] = useState(() => now.getTime());
  const offerNow = Math.max(now.getTime(), offerClock);
  const offerWaiting = Boolean(summary?.now?.items.some((item) => item.acceptLeadId && (!item.expiresAt || Date.parse(item.expiresAt) > offerNow)));
  const nextOfferExpiry = summary?.now?.items.reduce<number | null>((soonest, item) => {
    const at = item.acceptLeadId && item.expiresAt ? Date.parse(item.expiresAt) : NaN;
    return Number.isFinite(at) && at > offerNow && (soonest === null || at < soonest) ? at : soonest;
  }, null) ?? null;
  useEffect(() => {
    if (nextOfferExpiry === null) return;
    const timer = window.setTimeout(() => setOfferClock(Date.now()), Math.max(0, nextOfferExpiry - Date.now()) + 50);
    return () => window.clearTimeout(timer);
  }, [nextOfferExpiry]);
  const offerAttributes = useOfferPendingAttributes(floatingNow && offerWaiting);
  const activeId = mode === "rail" ? [...assistants, ...leads].find((thread) => isActive(thread, pathname))?.id ?? null : null;
  const waitingAssistants = assistants.filter((thread) => thread.waitingYou);
  const currentPresenceAsks = presenceAsks ?? (presence ? [presence] : []);
  const hasPriority = hasNowItems || Boolean(next?.urgent) || currentPresenceAsks.some((ask) => ask.status !== "confirmed");
  // Início organizado: só para o corretor, nunca para supervisor ou gestor.
  const organized = homeActions && !isSupervisor && !isManager;
  const quickSale = quickSaleEnabled && !isSupervisor && !isManager;
  const [quickSaleOpen, setQuickSaleOpen] = useState(false);
  const quickActions = organized ? homeQuickActions({ onQuickSale: quickSale ? () => setQuickSaleOpen(true) : undefined }) : [];

  const list = (
    <>
      <div className={home.tabs} data-tour="home-tabs">
        <SegmentedControl
          label="Conversas"
          value={tab}
          onValueChange={(value) => setTab(value as Tab)}
          options={[
            { value: "assistentes", label: "Assistentes" },
            { value: "leads", label: "Leads", accessory: waitingLeads ? <RisePulse pulseKey={leadsPulse} className={home.countPulse}><span className={home.count} data-lite-arc-target="leads">{waitingLeads}</span></RisePulse> : undefined },
          ]}
        />
      </div>
      {searching ? (
        <div className={home.search}>
          {redesigned ? <SearchField ref={searchRef} autoFocus label={tab === "leads" ? "Buscar nos leads carregados" : "Buscar nas conversas carregadas"} value={query} onValueChange={setQuery} clearLabel="Limpar busca" placeholder="Nome ou trecho da conversa" /> : <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === "leads" ? "Buscar lead" : "Buscar conversa"} aria-label="Buscar" className={home.searchInput} />}
        </div>
      ) : null}
      {tab === "leads" ? (
        <div className={home.listShortcut}>
          <Link href={redesigned ? "/leads?tab=minha-fila" : "/minha-fila"} className={redesigned ? sharedPage.button : styles.headerPill}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4h10M3 8h10M3 12h6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            Lista completa com filtros
          </Link>
        </div>
      ) : null}
      <ThreadList threads={visible} now={now} activeId={activeId} groupByDay={tab === "leads" && !isSupervisor && !isManager} emptyText={redesigned && query ? "Nenhuma conversa encontrada. Limpe a busca ou tente outro nome." : tab === "leads" ? (query ? `Não encontramos nenhum lead com "${query}". Confira a grafia ou limpe a busca.` : "Você não tem lead no momento. Assim que uma oferta chegar, ela aparece aqui.") : "Nada por aqui ainda."} />
      {!visible.length && !(redesigned && query) ? (
        <div className={home.emptyAction}>
          {query ? <button type="button" className={styles.headerPill} onClick={() => setQuery("")}>Limpar busca</button>
            : tab === "leads" ? <Link href={isManager ? "/leads" : "/plantoes"} className={styles.headerPill}>{isManager ? "Ver leads da unidade" : "Ver plantões"}</Link>
            : <Link href="/notificacoes" className={styles.headerPill}>Ver avisos da Âncora</Link>}
        </div>
      ) : null}
    </>
  );

  const aside = (
    <aside className={home.sidebar}>
      <header className={home.header} data-tour="home-header">
        {redesigned ? <ArcButton variant="ghost" className={sharedPage.iconButton} data-tour="home-me" aria-label="Abrir menu e disponibilidade" onClick={() => shell?.openMore?.()}>{initialsOf(viewerName)}</ArcButton> : <button type="button" className={home.me} data-tour="home-me" aria-label="Abrir menu e disponibilidade" onClick={() => shell?.openMore?.()}>{initialsOf(viewerName)}</button>}
        {/* No computador (15/11/2026) o "Olá" dá lugar a um botão de casa: é o caminho de volta ao Início em qualquer tela. */}
        <Link href="/dashboard" className={home.helloLink} title="Voltar ao Início">
          {redesigned ? <p className={home.hello}>Olá, {firstName}</p> : <h1 className={home.hello}>Olá, {firstName}</h1>}
          <span className={home.homeButton}><House size={18} strokeWidth={1.9} aria-hidden="true" /><span className={home.srOnly}>Início</span></span>
        </Link>
        <div className={home.headerTools} data-tour="home-tools">
          {!showWhatsAppStatus || isSupervisor || (isManager && mode !== "rail") ? null : <WhatsAppStatusButton />}
          {/* Sino (19/11): os avisos saíram da conversa do Sasá e moram em Notificações. */}
          {unreadNotifications === undefined || isManager ? null : (
            <Link href="/notificacoes" className={`${redesigned ? sharedPage.iconButton : styles.iconButton} ${home.bell}`} aria-label={unreadNotifications ? `Notificações, ${unreadNotifications} ${unreadNotifications === 1 ? "nova" : "novas"}` : "Notificações"}>
              <Bell size={18} strokeWidth={1.9} aria-hidden="true" />
              {unreadNotifications ? <span className={home.bellCount} aria-hidden="true">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span> : null}
            </Link>
          )}
          {redesigned ? <ArcButton variant="ghost" className={sharedPage.iconButton} aria-label="Nova ação" onClick={() => setNewOpen(true)}><PlusIcon /></ArcButton> : <button type="button" className={styles.iconButton} aria-label="Novo" onClick={() => setNewOpen(true)}><PlusIcon /></button>}
        </div>
      </header>
      {mode === "page" && !redesigned ? <PresenceCalloutList asks={currentPresenceAsks} /> : null}
      {mode === "page" && !redesigned && !floatingNow && summary?.now ? <NowSection data={summary.now} mobile /> : null}
      {mode === "page" && whatsappActivity ? <div className="px-4 pb-4"><WhatsAppActivityCard activity={whatsappActivity} /></div> : null}
      {mode === "page" && !redesigned && organized ? <HomeQuickActions actions={quickActions} after={financeCard} /> : null}
      {mode === "page" && !redesigned && firstSteps ? <FirstStepsCard steps={firstSteps} className={home.firstSteps} /> : null}
      {mode === "page" && !redesigned && highlights && !organized ? <WeekRanking data={highlights} /> : null}
      {list}
      {/* Organizado: Sua semana desce para o fim, depois do trabalho. */}
      {mode === "page" && !redesigned && highlights && organized ? <WeekRanking data={highlights} className={home.weekAtEnd} /> : null}
      {/* Banner do fim (14/11/2026): no celular fecha a lista; no computador fica no fim do centro. */}
      {mode === "page" && !redesigned && !isSupervisor && !isManager ? <HomeBanner highlights={highlights} announcement={announcement} className={home.bannerMobile} /> : null}
    </aside>
  );

  const sheet = (
    <BottomSheet open={newOpen} onOpenChange={setNewOpen} title="O que você quer fazer?" className="arc-venancor" followThrough>
      <ul className={home.newList}>
        {nextLead ? <li><Link href={nextLead.href} className={home.newItem} onClick={() => setNewOpen(false)}><strong>{isSupervisor ? "Ver" : "Atender"} {nextLead.name}</strong><span>{nextLead.preview}</span></Link></li> : null}
        {isSupervisor ? <li><Link href="/equipe" className={home.newItem} onClick={() => setNewOpen(false)}><strong>Ver minha equipe</strong><span>Corretores, status e números</span></Link></li> : null}
        {isSupervisor ? <li><Link href="/relacionamento" className={home.newItem} onClick={() => setNewOpen(false)}><strong>Mandar recado para a equipe</strong><span>Aviso, reconhecimento ou pedido de ciente</span></Link></li> : null}
        {quickSale ? <li><button type="button" className={home.newItem} onClick={() => { setNewOpen(false); setQuickSaleOpen(true); }}><strong>Registrar venda</strong><span>Escolher o lead e registrar a venda dele</span></button></li> : null}
        {canQuote ? <li><Link href="/cotacao" className={home.newItem} onClick={() => setNewOpen(false)}><strong>Fazer uma cotação</strong><span>Simular planos para um cliente</span></Link></li> : null}
        <li><button type="button" className={home.newItem} onClick={() => { setNewOpen(false); setTab("leads"); setSearching(true); if (redesigned) { setQuery(""); requestAnimationFrame(() => searchRef.current?.focus()); } }}><strong>Buscar um lead</strong><span>{redesigned ? "Pelo nome, nas conversas carregadas" : "Pelo nome ou telefone"}</span></button></li>
        {isManager ? <><li><Link href="/leads" className={home.newItem} onClick={() => setNewOpen(false)}><strong>Leads da unidade</strong><span>Acompanhar e repassar leads</span></Link></li><li><Link href="/equipe" className={home.newItem} onClick={() => setNewOpen(false)}><strong>Minha unidade</strong><span>Ver corretores e operação</span></Link></li></> : isSupervisor ? null : <li><Link href="/plantoes/agora" className={home.newItem} onClick={() => setNewOpen(false)}><strong>Ver meu plantão</strong><span>Agora e próximos</span></Link></li>}
      </ul>
    </BottomSheet>
  );
  const quickSaleSheet = quickSale ? <QuickRegisterSaleSheet open={quickSaleOpen} onOpenChange={setQuickSaleOpen} /> : null;

  if (mode === "rail") {
    return (
      <div className={`${styles.root} ${home.rail}`}>
        {aside}
        {sheet}
        {quickSaleSheet}
      </div>
    );
  }

  const stats = summary?.stats ? summary.stats : summary
    ? [
      { label: "Recebidos hoje", value: summary.receivedToday },
      { label: "Aceitos hoje", value: summary.acceptedToday },
      { label: "Em atendimento", value: summary.inServiceNow },
      { label: "Contato atrasando", value: summary.slaAtRiskNow, alert: summary.slaAtRiskNow > 0 },
    ]
    : [];

  if (redesigned) {
    return <div className={styles.root}>
      <BrokerHomeOverview viewerName={viewerName} nowIso={nowIso} summary={summary} nextLead={nextLead} rail={aside} conversations={list} presenceAsks={currentPresenceAsks}
        onSearch={() => { setQuery(""); setSearching(true); requestAnimationFrame(() => searchRef.current?.focus()); }} onNew={() => setNewOpen(true)}
        learning={firstSteps || highlights ? <>{firstSteps ? <FirstStepsCard steps={firstSteps} /> : null}{highlights ? <WeekRanking data={highlights} /> : null}</> : null}
        banner={<HomeBanner highlights={highlights} announcement={announcement} />} />
      {!hasPriority ? <><LiteWelcome variant="broker" /><LiteTour variant="broker" /></> : null}
      {sheet}
    </div>;
  }

  const centerSubtitle = hasNowItems ? "Veja o que precisa da sua atenção agora." : next ? (
    <>A próxima coisa é <strong className={home.nextLabel} data-urgent={next.urgent}>{next.label}</strong>. {next.detail}</>
  ) : nextLead
    ? isSupervisor ? `O lead de ${nextLead.name.split(" ")[0]} está com o contato atrasado. Comece por ele.` : `${nextLead.name.split(" ")[0]} está esperando você. Escolha uma conversa à esquerda ou comece por ela.`
    : waitingAssistants.length
      ? `${waitingAssistants.map((thread) => thread.name).join(", ")} ${waitingAssistants.length === 1 ? "tem algo" : "têm algo"} para você. Escolha uma conversa à esquerda.`
      : "Tudo em dia. Escolha uma conversa à esquerda para começar.";

  return (
    <div className={`${styles.root} ${home.page}`}>
      {aside}

      <section className={home.center} aria-label="Seu dia">
        <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }} className={home.centerInner}>
          {/* Computador (14/11/2026): o banner de boas-vindas abre a tela no lugar do título; supervisor e gestor seguem com o título. */}
          {/* Faixa acima do banner (15/11/2026): a data de hoje e a disponibilidade, que no computador só ficava no menu. */}
          {!isSupervisor && !isManager ? (
            <div className={home.centerTop}>
              <p className={home.centerDate}>{new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" }).format(now)}</p>
              {shell ? <LightAvailabilityPill availability={shell.availability} isPending={shell.isPending}
                onToggle={() => shell.setStatus(shell.availability === "available" ? "paused" : "available")} className={home.centerAvailability} /> : null}
            </div>
          ) : null}
          {/* Corretor (15/11/2026): o próximo passo e os fatos do dia entram no banner; supervisor e gestor seguem com título e frase. */}
          {!isSupervisor && !isManager && announcement ? (
            <>
              <AnnouncementBanner announcement={announcement} className={`${home.welcomeBanner} ${home.announcementBanner}`} />
              <p className={home.centerSubtitle}>{centerSubtitle}</p>
            </>
          ) : !isSupervisor && !isManager ? (
            <HomeWelcomeBanner className={home.welcomeBanner} greeting={greeting(now)} firstName={firstName} highlights={highlights}
              subtitle={centerSubtitle} duty={summary?.duty ?? null} goal={summary?.goal ?? null}
              nextAction={showNext && next ? { label: next.label, href: next.href } : !summary?.now && nextLead ? { label: `Atender ${nextLead.name.split(" ")[0]}`, href: nextLead.href } : null}
              nextActionSlot={showNext && next?.acceptLeadId ? (className) => <AcceptLeadButton leadId={next.acceptLeadId!} className={className} offerPending>{next.label}</AcceptLeadButton> : undefined} />
          ) : <><h2 className={home.centerTitle}>{greeting(now)}, {firstName}</h2><p className={home.centerSubtitle}>{centerSubtitle}</p></>}
          {/* Sem o bloco Agora no topo do computador (pedido 14/11/2026): as pendências ficam na aba Leads da lista ao lado. */}
          {summary?.now && !floatingNow ? <NowSection data={summary.now} /> : null}
          {/* Corretor: o próximo passo é o botão branco do banner; o botão azul embaixo fica só para supervisor e gestor. */}
          {!(isSupervisor || isManager) ? null : showNext && next?.acceptLeadId ? (
            <AcceptLeadButton leadId={next.acceptLeadId} className={styles.pill} style={{ marginTop: 6 }} offerPending>{next.label}</AcceptLeadButton>
          ) : showNext && next ? (
            <LitePress><Link href={next.href} className={styles.pill} style={{ marginTop: 6 }}>{next.label}</Link></LitePress>
          ) : !summary?.now && nextLead ? (
            <LitePress><Link href={nextLead.href} className={styles.pill} style={{ marginTop: 6 }}>{isSupervisor ? "Ver" : "Atender"} {nextLead.name.split(" ")[0]}</Link></LitePress>
          ) : null}

          {organized ? <HomeQuickActions actions={quickActions} className={home.centerActions} after={financeCard} /> : null}

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
                  <span className={home.statTop}>
                    <span className={home.statIcon} aria-hidden="true">{STAT_ICON[stat.label] ?? <Activity size={16} />}</span>
                    <span className={home.statLabel}>{stat.label}</span>
                  </span>
                  <span className={home.statValue}>{stat.value}</span>
                </motion.li>
              ))}
            </ul>
          ) : null}

          {firstSteps ? <FirstStepsCard steps={firstSteps} className={home.centerHighlights} /> : null}
          {highlights ? <WeekRanking data={highlights} className={home.centerHighlights} /> : null}

          {summary?.duty || summary?.goal ? (
            <div className={home.cards}>
              {summary.duty ? (
                <LitePress kind="card"><Link href={summary.duty.href} className={home.card}>
                  <ContextualIllustration name="calendar" size="sm" fallback={<AssistantAvatar shape="onigiri" hue={28} size={40} />} />
                  <span className={home.cardName}>{summary.duty.title}</span>
                  <span className={home.cardPreview}>{summary.duty.detail}</span>
                </Link></LitePress>
              ) : null}
              {summary.goal ? (
                <LitePress kind="card"><Link href={isSupervisor ? "/equipe/desempenho" : "/desempenho"} className={home.card}>
                  <AssistantAvatar shape="nuvem" hue={330} size={40} />
                  <span className={home.cardName}>{summary.goal.name}</span>
                  <GoalReached reached={summary.goal.percentage >= 100} kind="goal" className={home.goalRing}>
                    <span className={home.goalTrack} aria-hidden="true"><GoalFill percentage={summary.goal.percentage} /></span>
                  </GoalReached>
                  <span className={home.cardPreview}>{summary.goal.currentValue} de {summary.goal.targetValue} · {summary.goal.percentage}%</span>
                </Link></LitePress>
              ) : null}
            </div>
          ) : null}
        </motion.div>
      </section>

      {floatingNow && summary?.now ? (
        <div className={`${styles.pillWrap} ${home.nowLauncher}`} data-sasa-lift="">
          <BottomSheet open={nowOpen} onOpenChange={setNowOpen} title="Agora" description={summary.now.items.length ? `${summary.now.items.length} ${summary.now.items.length === 1 ? "pendência na sua fila" : "pendências na sua fila"}.` : "Você está em dia."} detents={[summary.now.items.length <= 1 ? (compactNow ? 0.44 : 0.36) : summary.now.items.length === 2 ? (compactNow ? 0.66 : 0.5) : 0.8]} closeLabel="Fechar Agora" icon={<ListTodo strokeWidth={1.9} />} className="arc-venancor"
            trigger={<ArcButton type="button" variant="secondary" data-tour="home-pill" className={offerWaiting ? offerHaloClass : undefined} {...offerAttributes} aria-label={`${offerWaiting ? "Oferta pendente. " : ""}Abrir Agora: ${summary.now.items.length} ${summary.now.items.length === 1 ? "pendência" : "pendências"}`}><ListTodo size={18} aria-hidden="true" /><span>{offerWaiting ? "Oferta pendente" : "Agora"}</span><ArcBadge size="sm" tone="neutral">{summary.now.items.length || "Em dia"}</ArcBadge></ArcButton>}>
            <NowSection data={summary.now} floating onNavigate={() => setNowOpen(false)} />
          </BottomSheet>
        </div>
      ) : <div className={styles.pillWrap} data-mobile-only data-sasa-lift="">
        {next?.acceptLeadId ? (
          <AcceptLeadButton leadId={next.acceptLeadId} className={styles.pill} data-tour="home-pill" offerPending>{next.label}</AcceptLeadButton>
        ) : next ? (
          <LitePress><Link href={next.href} className={styles.pill} data-tour="home-pill" aria-label={`A próxima coisa é: ${next.label}. ${next.detail}`}>{next.urgent ? <span className={home.urgentDot} aria-hidden="true" /> : null}{next.label}</Link></LitePress>
        ) : nextLead ? (
          <LitePress><Link href={nextLead.href} className={styles.pill} data-tour="home-pill">{isSupervisor ? "Ver" : "Atender"} {nextLead.name.split(" ")[0]}</Link></LitePress>
        ) : organized ? null : (
          <LitePress><button type="button" className={styles.pill} data-tour="home-pill" onClick={() => setNewOpen(true)}><PlusIcon /> {isSupervisor ? "Ações da equipe" : "Novo atendimento"}</button></LitePress>
        )}
      </div>}

      {/* Welcome and tour of the audience: broker or supervisor (each with its own steps). */}
      {isManager ? null : <LiteWelcome variant={isSupervisor ? "supervisor" : "broker"} />}
      {isManager ? null : <LiteTour variant={isSupervisor ? "supervisor" : "broker"} />}
      {sheet}
      {quickSaleSheet}
    </div>
  );
}

/**
 * Meta do dia: o corretor abre o Início dezenas de vezes por dia, então a barra
 * só se preenche na primeira abertura do dia (docs/ux/motion-frequencia.md).
 * Nas outras já aparece cheia até o valor, sem animação. Quando bate 100%, o `GoalReached` em volta
 * marca o nível 2 uma vez por dia (anel, som de marco e texto curto).
 */
export function GoalFill({ percentage }: { percentage: number }) {
  const animate = useFirstTimeToday("meta-do-dia", useInterfaceMotionEnabled());
  return (
    <motion.span
      key={animate ? "primeira-vez" : "estatico"}
      className={home.goalFill}
      data-animate={animate ? "primeira-vez" : undefined}
      initial={animate ? { scaleX: 0 } : false}
      animate={{ scaleX: Math.min(1, percentage / 100) }}
      transition={animate ? { duration: motionTokens.duration.considered, ease: motionTokens.ease.enter, delay: motionTokens.duration.instant } : { duration: 0 }}
    />
  );
}
