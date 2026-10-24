"use client";

/**
 * Director dashboard in the Lite look, with example data. Same tabs as /dashboard (Visão da operação,
 * Qualidade dos leads, Funil de qualificação) and the drills, now in a side panel.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Building2, FlaskConical } from "lucide-react";

import type { DrilldownId } from "@/features/reports/metrics/metrics-service";
import type { CommandCenterData } from "@/features/dashboard/today";
import type { FunnelPeriod } from "@/features/qualification-turbo/funnel";

import styles from "../preview.module.css";
import { LiteDrawer, LiteHeader, LiteSidebar } from "./chrome";
import {
  buildCommandCenter, buildDrill, buildFunnel, buildQualityReport, buildSimpleQuality, emptyCommandCenter, focusLeads, FUNNEL_PERIOD_OPTIONS, nextLeadName,
  NOW_ISO, OVERVIEW_PERIODS, QUALITY_PERIODS, QUEUES, UNITS, unitOf, type OverviewPeriod, type QualityPeriod, type UnitId,
} from "./data";
import { dateTitle } from "./format";
import { enterT, fadeT, LitePills, LiteSwap, useMedia, useReduce } from "./motion";
import { LiteLayer, LitePick } from "./overlay";
import { DrillContent, ExportContent, FocusContent, FullPageLink, RangeContent } from "./panels";
import { FunnelTab } from "./funnel-tab";
import { OverviewTab } from "@/features/dashboard/components/director-lite/overview-tab";
import { QualityDisabled, QualityTab, type FocusTarget } from "./quality-tab";
import { ErrorState, SkeletonToContent, TabSkeleton } from "./states";

export type Tab = "overview" | "quality" | "funnel";
export type PreviewState = "ready" | "loading" | "empty" | "error" | "off";

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "overview", label: "Visão da operação" },
  { value: "quality", label: "Qualidade dos leads" },
  { value: "funnel", label: "Funil de qualificação" },
];
const STATES: Array<{ value: PreviewState; label: string }> = [
  { value: "ready", label: "Normal" },
  { value: "loading", label: "Carregando" },
  { value: "empty", label: "Vazio" },
  { value: "error", label: "Erro" },
  { value: "off", label: "Central desligada" },
];
const LIVE_EVERY_MS = 8000;
const FIRST_VISIT_MS = 600;

type Layer =
  | { kind: "drill"; id: DrilldownId; total: number }
  | { kind: "focus"; target: FocusTarget }
  | { kind: "range" }
  | { kind: "export" };

type Live = { key: string; ticks: number; leads: CommandCenterData["recentLeads"]; distributed: number; queueHits: number[] };

export function DirectorDashboardPreview({ initialTab, initialState, initialVista, initialDrill }: { initialTab: Tab; initialState: PreviewState; initialVista: "simples" | "detalhada"; initialDrill: DrilldownId | null }) {
  const reduce = useReduce();
  const wide = useMedia("(min-width: 1280px)");
  const [tab, setTab] = useState<Tab>(initialTab);
  const [state, setState] = useState<PreviewState>(initialState);
  const [unit, setUnit] = useState<UnitId>("all");
  const [overviewPeriod, setOverviewPeriod] = useState<OverviewPeriod>("today");
  const [funnelPeriod, setFunnelPeriod] = useState<FunnelPeriod>(7);
  const [qualityPeriod, setQualityPeriod] = useState<QualityPeriod>(7);
  const [queueId, setQueueId] = useState<string | null>(null);
  const [vista, setVista] = useState<"simples" | "detalhada">(initialVista);
  const [booting, setBooting] = useState(true);
  const [visited, setVisited] = useState<Tab[]>([initialTab]);
  const [pending, setPending] = useState<Tab | null>(null);
  const [layer, setLayer] = useState<Layer | null>(null);
  const [layerOpen, setLayerOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [collapsedPref, setCollapsedPref] = useState<boolean | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [dock, setDock] = useState(false);
  const [live, setLive] = useState<Live>({ key: "", ticks: 0, leads: [], distributed: 0, queueHits: [] });
  const [notifications, setNotifications] = useState(3);
  const initialDrillDone = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const baseNow = useMemo(() => new Date(NOW_ISO), []);
  const liveKey = `${overviewPeriod}|${unit}`;
  const liveNow = useMemo<Live>(() => (live.key === liveKey ? live : { key: liveKey, ticks: 0, leads: [], distributed: 0, queueHits: [] }), [live, liveKey]);
  const now = useMemo(() => new Date(baseNow.getTime() + liveNow.ticks * LIVE_EVERY_MS), [baseNow, liveNow.ticks]);
  const collapsed = collapsedPref ?? !wide;
  const unitInfo = unitOf(unit);
  const empty = state === "empty";

  /* ---------------------------------------------------------------- data */
  const overview = useMemo<CommandCenterData>(() => {
    if (empty) return emptyCommandCenter(baseNow);
    const data = buildCommandCenter(overviewPeriod, unit, baseNow);
    if (!liveNow.ticks) return data;
    const waiting = Math.max(0, data.today.waiting + liveNow.leads.length - liveNow.distributed);
    const queues = data.today.queues.map((queue, index) => ({ ...queue, today: queue.today + (liveNow.queueHits[index] ?? 0) }));
    return {
      ...data,
      today: { ...data.today, received: data.today.received + liveNow.leads.length, distributed: data.today.distributed + liveNow.distributed, waiting, queues },
      recentLeads: [...liveNow.leads, ...data.recentLeads].slice(0, 6),
      generatedAt: now.toISOString(),
    };
  }, [empty, baseNow, overviewPeriod, unit, liveNow, now]);
  const funnel = useMemo(() => {
    const data = buildFunnel(funnelPeriod, unit, baseNow);
    if (!empty) return data;
    return { ...data, stages: data.stages.map((stage) => ({ ...stage, count: 0 })), now: data.now.map((row) => ({ ...row, count: 0 })), variants: [], lossReasons: [], touches: data.touches.map((row) => ({ ...row, sent: 0, repliesAfter: 0 })), medianMinutesToReply: null, cost: null };
  }, [funnelPeriod, unit, baseNow, empty]);
  const quality = useMemo(() => {
    const report = buildQualityReport(qualityPeriod, unit, queueId, baseNow);
    return empty ? { ...report, summary: { ...report.summary, total: 0 } } : report;
  }, [qualityPeriod, unit, queueId, baseNow, empty]);
  const simple = useMemo(() => {
    const report = buildSimpleQuality(qualityPeriod, unit, queueId, baseNow);
    return empty ? { ...report, arrived: { ...report.arrived, total: 0 } } : report;
  }, [qualityPeriod, unit, queueId, baseNow, empty]);

  /* ---------------------------------------------------------------- effects */
  useEffect(() => {
    const timer = window.setTimeout(() => setBooting(false), 700);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const scroller = rootRef.current;
    const onScroll = () => setScrolled((scroller?.scrollTop ?? 0) > 4);
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setCollapsedPref((was) => !(was ?? !window.matchMedia("(min-width: 1280px)").matches));
      }
    };
    scroller?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => { scroller?.removeEventListener("scroll", onScroll); window.removeEventListener("keydown", onKey); };
  }, []);

  // Real time: a new lead every ~8s on the overview (every third tick, a waiting lead goes to a broker).
  const liveRunning = tab === "overview" && state === "ready" && !booting && !layerOpen;
  useEffect(() => {
    if (!liveRunning) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setLive((previous) => {
        const current = previous.key === liveKey ? previous : { key: liveKey, ticks: 0, leads: [], distributed: 0, queueHits: [] };
        const tick = current.ticks + 1;
        const queueIndex = tick % 3;
        const name = nextLeadName(tick + 5);
        const branch = unit === "all" ? UNITS[(tick % 3) + 1].name : unitOf(unit).name;
        const lead = { id: `live-${liveKey}-${tick}`, name, status: "new" as const, branchName: branch, createdAt: new Date(new Date(NOW_ISO).getTime() + tick * LIVE_EVERY_MS).toISOString() };
        const queueHits = [...current.queueHits];
        queueHits[queueIndex] = (queueHits[queueIndex] ?? 0) + 1;
        return { key: liveKey, ticks: tick, leads: [lead, ...current.leads].slice(0, 6), distributed: current.distributed + (tick % 3 === 0 ? 1 : 0), queueHits };
      });
      setNotifications((count) => count + 1);
    }, LIVE_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [liveRunning, liveKey, unit]);

  /* ---------------------------------------------------------------- actions */
  const openLayer = useCallback((next: Layer) => { setLayer(next); setLayerOpen(true); }, []);
  const closeLayer = useCallback(() => setLayerOpen(false), []);

  useEffect(() => {
    if (booting || !initialDrill || initialDrillDone.current) return;
    initialDrillDone.current = true;
    const item = overview.attention.find((entry) => entry.id === initialDrill);
    const timer = window.setTimeout(() => openLayer({ kind: "drill", id: initialDrill, total: item?.count ?? 7 }), 300);
    return () => window.clearTimeout(timer);
  }, [booting, initialDrill, overview.attention, openLayer]);

  const goTab = (next: Tab) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "overview") url.searchParams.delete("tab"); else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
    rootRef.current?.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    if (!visited.includes(next)) {
      setPending(next);
      window.setTimeout(() => { setVisited((list) => [...list, next]); setPending((current) => (current === next ? null : current)); }, FIRST_VISIT_MS);
    }
  };

  const loading = state === "loading" || booting || pending === tab;
  const showTabs = state !== "off";
  const effectiveTab: Tab = showTabs ? tab : tab === "quality" ? "quality" : "overview";
  const qualityPeriodLabel = QUALITY_PERIODS.find((option) => option.value === qualityPeriod)?.label ?? "";

  const periodControl =
    effectiveTab === "overview" ? (
      <LitePills group="period-overview" label="Período" options={OVERVIEW_PERIODS} value={overviewPeriod} onChange={setOverviewPeriod} />
    ) : effectiveTab === "funnel" ? (
      <LitePills group="period-funnel" label="Período do funil" options={FUNNEL_PERIOD_OPTIONS} value={funnelPeriod} onChange={setFunnelPeriod} />
    ) : (
      <LitePills group="period-quality" label="Período da análise de qualidade" options={QUALITY_PERIODS} value={qualityPeriod} onChange={setQualityPeriod} />
    );

  const layerTitle = !layer ? "" : layer.kind === "drill" ? buildDrill(layer.id, layer.total, unit, baseNow).title : layer.kind === "focus" ? "Leads deste recorte" : layer.kind === "range" ? "Escolher o intervalo" : "Exportar relatório";

  return (
    <div ref={rootRef} className={`arc-venancor ${styles.tokens} ${styles.root}`} data-collapsed={collapsed}>
      <LiteSidebar collapsed={collapsed} onToggle={() => setCollapsedPref(!collapsed)} />
      <LiteDrawer open={drawer} onClose={() => setDrawer(false)} />
      <div className={styles.main}>
        <LiteHeader title="Painel" scrolled={scrolled} onMenu={() => setDrawer(true)} notifications={notifications} notificationPulse={liveNow.ticks} />
        <motion.main
          id="conteudo"
          className={styles.page}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? fadeT : enterT}
        >
          <div className={styles.pageHead}>
            <div className={styles.titleBlock}>
              <h1 className={styles.pageTitle}>Olá, {overview.welcome.firstName ?? "diretor"}</h1>
              <p className={styles.pageSubtitle}>{dateTitle(baseNow)}. O dia da operação começa às 19h de ontem.</p>
            </div>
            <div className={styles.filters}>
              <LitePick label="Unidade" icon={<Building2 aria-hidden="true" size={18} />} value={unit} onChange={(value) => setUnit(value as UnitId)} options={UNITS.map((item) => ({ value: item.id, label: item.name, hint: item.id === "all" ? "Empresa toda" : undefined }))} />
              {periodControl}
            </div>
          </div>

          {showTabs ? (
            <div className={styles.tabsRow}>
              <LitePills kind="tabs" group="dashboard-tabs" label="Seções do painel" options={TABS} value={tab} onChange={goTab} controls="painel-conteudo" />
            </div>
          ) : null}

          <div id="painel-conteudo" role={showTabs ? "tabpanel" : undefined} aria-label={TABS.find((item) => item.value === effectiveTab)?.label}>
            {state === "error" ? (
              <ErrorState onRetry={() => setState("ready")} />
            ) : (
              <SkeletonToContent loading={loading} id={effectiveTab} skeleton={<TabSkeleton tab={effectiveTab} />}>
                <LiteSwap id={effectiveTab}>
                  {effectiveTab === "overview" ? (
                    <OverviewTab
                      data={overview}
                      period={overviewPeriod === "today" ? "today" : overviewPeriod === 7 ? "7d" : "30d"}
                      now={now}
                      pulse={liveNow.ticks}
                      freshId={liveNow.leads[0]?.id ?? null}
                      onDrill={(item) => openLayer({ kind: "drill", id: item.id as DrilldownId, total: item.count })}
                      onQuality={() => (showTabs ? goTab("quality") : window.location.assign("/relatorios"))}
                    />
                  ) : effectiveTab === "funnel" ? (
                    <FunnelTab data={funnel} unitName={unit === "all" ? null : unitInfo.name} />
                  ) : state === "off" ? (
                    <QualityDisabled />
                  ) : (
                    <QualityTab
                      report={quality}
                      simple={simple}
                      vista={vista}
                      onVista={setVista}
                      queues={QUEUES.filter((queue) => queue.id).map((queue) => ({ id: queue.id as string, name: queue.name }))}
                      queueId={queueId}
                      onQueue={setQueueId}
                      onFocus={(target) => openLayer({ kind: "focus", target })}
                      onRange={() => openLayer({ kind: "range" })}
                      onExport={() => openLayer({ kind: "export" })}
                      periodLabel={qualityPeriod === "today" ? "Hoje, desde ontem às 19h" : `Últimos ${qualityPeriodLabel}`}
                    />
                  )}
                </LiteSwap>
              </SkeletonToContent>
            )}
          </div>
        </motion.main>
      </div>

      <p className={styles.srOnly} aria-live="polite">{liveNow.leads[0] ? `Novo lead: ${liveNow.leads[0].name}.` : ""}</p>

      <LiteLayer
        open={layerOpen}
        onClose={closeLayer}
        title={layerTitle}
        footer={layer?.kind === "drill" ? <FullPageLink href={`/dashboard/drill/${layer.id}?period=7`} /> : undefined}
      >
        {layer?.kind === "drill" ? <DrillContent drill={buildDrill(layer.id, layer.total, unit, baseNow)} period={7} /> : null}
        {layer?.kind === "focus" ? <FocusContent focus={layer.target} leads={focusLeads(layer.target.segment, unit, baseNow)} /> : null}
        {layer?.kind === "range" ? <RangeContent onApply={closeLayer} /> : null}
        {layer?.kind === "export" ? <ExportContent queues={QUEUES.filter((queue) => queue.id).map((queue) => ({ id: queue.id as string, name: queue.name }))} /> : null}
      </LiteLayer>

      <div className={styles.dock}>
        <AnimatePresence initial={false}>
          {dock ? (
            <motion.div key="dock" className={styles.dockPanel} initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: fadeT }}>
              <LitePills group="preview-state" size="sm" label="Estado da prévia" options={STATES} value={state} onChange={(value) => { setState(value); setDock(false); }} />
            </motion.div>
          ) : null}
        </AnimatePresence>
        <button type="button" className={styles.dockButton} onClick={() => setDock((was) => !was)} aria-expanded={dock} aria-label="Estado da prévia">
          <FlaskConical aria-hidden="true" size={16} /> Prévia: {STATES.find((item) => item.value === state)?.label}
        </button>
      </div>
    </div>
  );
}
