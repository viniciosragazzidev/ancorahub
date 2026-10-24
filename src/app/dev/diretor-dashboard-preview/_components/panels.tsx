"use client";

/** What opens in the side panel (desktop) or the BottomSheet (phone): drills, the leads of a quality cut, the range and the export. */
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, FileSpreadsheet, FileText } from "lucide-react";

import { motionTokens as m } from "@/components/arc/motion-tokens";
import type { LeadQualityReport } from "@/features/reports/metrics/lead-quality-service";
import type { DrilldownResult } from "@/features/reports/metrics/metrics-service";

import styles from "../preview.module.css";
import { QUALITY_PERIODS } from "./data";
import { LEAD_STATUS, n, shortDate } from "./format";
import { ease, enterT, fadeT, LiteItem, LiteNumber, useReduce } from "./motion";
import type { FocusTarget } from "./quality-tab";
import { DIMENSION_LABELS, hourLabel } from "./quality-tab";
import { LitePick } from "./overlay";

function Status({ status }: { status: string }) {
  const info = LEAD_STATUS[status] ?? { label: status.replaceAll("_", " "), tone: "neutral" as const };
  return <span className={styles.badge} data-tone={info.tone}>{info.label}</span>;
}

/** The drill-down (/dashboard/drill/[drillId]) as a panel: explanation, total, brokers and leads. */
export function DrillContent({ drill, period }: { drill: DrilldownResult; period: number }) {
  return (
    <div className={styles.panelStack}>
      <p className={styles.cardDescription}>{drill.explanation}</p>
      <div className={styles.stat}>
        <span className={styles.statLabel}>Total</span>
        <LiteNumber value={drill.total} className={styles.statValue} />
        <span className={styles.statDetail}>{drill.total === 1 ? "registro" : "registros"} nos últimos {period} dias</span>
      </div>
      {drill.brokers.length ? (
        <section aria-labelledby="drill-brokers" className={styles.panelSection}>
          <h3 id="drill-brokers" className={styles.cardTitleSm}>Corretores</h3>
          <ul className={styles.rows}>
            {drill.brokers.map((broker, index) => (
              <LiteItem as="li" key={broker.brokerId} index={index}>
                <Link href={`/equipe/${broker.brokerId}`} className={styles.dutyRow}>
                  <span className={styles.dutyText}>
                    <span className={styles.rowTitle}><span className={styles.truncate}>{broker.brokerName}</span></span>
                    <span className={styles.muted}>{n(broker.activeLeads)} leads ativos, capacidade {n(broker.capacity)}</span>
                  </span>
                  <span className={styles.badge} data-tone="danger">+{n(broker.activeLeads - broker.capacity)}</span>
                </Link>
              </LiteItem>
            ))}
          </ul>
        </section>
      ) : null}
      {drill.rows.length ? (
        <section aria-labelledby="drill-leads" className={styles.panelSection}>
          <h3 id="drill-leads" className={styles.cardTitleSm}>Leads</h3>
          <ul className={styles.rows}>
            {drill.rows.map((lead, index) => (
              <LiteItem as="li" key={lead.id} index={index}>
                <Link href={`/leads/${lead.id}`} className={styles.dutyRow}>
                  <span className={styles.dutyText}>
                    <span className={styles.rowTitle}><span className={styles.truncate}>{lead.nome}</span></span>
                    <span className={styles.muted}>{lead.brokerName ?? "Sem corretor"}, {lead.branchName ?? "sem unidade"}, {shortDate(lead.createdAt)}{lead.latencySeconds ? `, 1º contato em ${Math.round(lead.latencySeconds / 60)} min` : ""}</span>
                  </span>
                  <Status status={lead.status} />
                </Link>
              </LiteItem>
            ))}
          </ul>
          {drill.total > drill.rows.length ? <p className={styles.footnote}>Mostrando {n(drill.rows.length)} de {n(drill.total)} registros.</p> : null}
        </section>
      ) : null}
    </div>
  );
}

function Temperature({ status }: { status: string }) {
  if (status === "hot") return <span className={styles.badge} data-tone="danger">Quente</span>;
  if (status === "warm") return <span className={styles.badge} data-tone="warning">Morno</span>;
  if (status === "cold") return <span className={styles.badge} data-tone="info">Frio</span>;
  return <span className={styles.badge} data-tone="neutral">Sem classe</span>;
}

/** "Recorte ativo" + "Leads deste recorte" of the detailed quality view. */
export function FocusContent({ focus, leads }: { focus: FocusTarget; leads: LeadQualityReport["focusedLeads"] }) {
  const label = focus.dimension === "hour" ? hourLabel(focus.segment.key) : focus.segment.label;
  return (
    <div className={styles.panelStack}>
      <div className={styles.focusBanner}>
        <span className={styles.badge} data-tone="info">Recorte ativo</span>
        <span><span className={styles.muted}>{DIMENSION_LABELS[focus.dimension]}:</span> <strong className={styles.strong}>{label}</strong></span>
        <span className={styles.muted}>{n(focus.segment.total)} leads</span>
      </div>
      <div className={styles.stats2}>
        <div className={styles.stat}><span className={styles.statLabel}>Quentes e mornos</span><LiteNumber value={focus.segment.hot + focus.segment.warm} className={styles.miniValue} /></div>
        <div className={styles.stat}><span className={styles.statLabel}>Convertidos</span><LiteNumber value={focus.segment.converted} className={styles.miniValue} /></div>
      </div>
      <section aria-labelledby="focus-leads" className={styles.panelSection}>
        <h3 id="focus-leads" className={styles.cardTitleSm}>Leads deste recorte</h3>
        {leads.length ? (
          <ul className={styles.rows}>
            {leads.map((lead, index) => (
              <LiteItem as="li" key={lead.id} index={index}>
                <Link href={`/leads/${encodeURIComponent(lead.id)}`} className={styles.focusRow}>
                  <span className={styles.dutyText}>
                    <span className={styles.rowTitle}><span className={styles.truncate}>{lead.name}</span></span>
                    <span className={styles.muted}>{lead.queueName ?? "Sem fila"}, {lead.brokerName ?? "Sem atribuição"}, {shortDate(lead.createdAt)}</span>
                  </span>
                  <span className={styles.badgeStack}><Status status={lead.status} /><Temperature status={lead.qualificationStatus} /></span>
                </Link>
              </LiteItem>
            ))}
          </ul>
        ) : (
          <p className={styles.cardEmptyText}>Este grupo tem menos de 3 leads ou nenhum registro ativo para exibir.</p>
        )}
        <p className={styles.footnote}>{focus.segment.total > leads.length ? `Mostrando ${n(leads.length)} de ${n(focus.segment.total)} leads. ` : ""}Telefone e e-mail não aparecem aqui; abra o lead para ver os detalhes autorizados.</p>
      </section>
    </div>
  );
}

/** The quality range picker (LeadQualityRangePicker). */
export function RangeContent({ onApply }: { onApply: () => void }) {
  const [start, setStart] = useState("2026-10-17");
  const [end, setEnd] = useState("2026-10-24");
  const valid = start < end;
  return (
    <div className={styles.panelStack}>
      <p className={styles.cardDescription}>Sem horário, o início é 19h da véspera e o fim 19h. O Turno 1 vai do início até 13h30 do último dia; o Turno 2, de lá até o fim.</p>
      <div className={styles.fields}>
        <label className={styles.field}><span>Início</span><input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label>
        <label className={styles.field}><span>Hora do início</span><input type="time" defaultValue="19:00" /></label>
        <label className={styles.field}><span>Fim</span><input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label>
        <label className={styles.field}><span>Hora do fim</span><input type="time" defaultValue="19:00" /></label>
      </div>
      <AnimatePresence initial={false}>
        {valid ? null : <motion.p className={styles.fieldError} role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: enterT }} exit={{ opacity: 0, transition: fadeT }}>O início vem antes do fim, em até um ano.</motion.p>}
      </AnimatePresence>
      <div className={styles.panelActions}>
        <button type="button" className={styles.ghostButton} onClick={() => { setStart("2026-10-17"); setEnd("2026-10-24"); }}>Limpar</button>
        <button type="button" className={styles.primaryButton} disabled={!valid} onClick={onApply}>Aplicar</button>
      </div>
    </div>
  );
}

/** "Exportar relatório": period, queue and origin, then PDF or Excel. The button confirms with a drawn check. */
export function ExportContent({ queues }: { queues: Array<{ id: string; name: string }> }) {
  const reduce = useReduce();
  const [period, setPeriod] = useState("7");
  const [queue, setQueue] = useState("all");
  const [origin, setOrigin] = useState("all");
  const [done, setDone] = useState<"pdf" | "xlsx" | null>(null);
  const run = (format: "pdf" | "xlsx") => {
    setDone(format);
    window.setTimeout(() => setDone(null), 1200);
  };
  const periodOptions = [...QUALITY_PERIODS.map((option) => ({ value: String(option.value), label: option.value === "today" ? "Hoje (19h às 19h)" : option.value === 3 ? "3 dias (segunda desde sexta às 19h)" : option.label }))];
  return (
    <div className={styles.panelStack}>
      <p className={styles.cardDescription}>Mesmos números da página, separados por origem e por turno (19h às 13h30 e 13h30 às 19h).</p>
      <div className={styles.fieldStack}>
        <span className={styles.fieldLabel}>Período do relatório</span>
        <LitePick label="Período do relatório" value={period} onChange={setPeriod} options={periodOptions} />
        <span className={styles.fieldLabel}>Fila do relatório</span>
        <LitePick label="Fila do relatório" value={queue} onChange={setQueue} options={[{ value: "all", label: "Todas as filas" }, ...queues.map((item) => ({ value: item.id, label: item.name }))]} />
        <span className={styles.fieldLabel}>Origem do relatório</span>
        <LitePick label="Origem do relatório" value={origin} onChange={setOrigin} options={[{ value: "all", label: "Todas (Formulário, WhatsApp e Outros)" }, { value: "form", label: "Formulário" }, { value: "whatsapp", label: "WhatsApp" }, { value: "other", label: "Outros" }]} />
      </div>
      <div className={styles.panelActions}>
        {(["pdf", "xlsx"] as const).map((format) => (
          <motion.button key={format} type="button" className={format === "pdf" ? styles.primaryButton : styles.secondaryButton} onClick={() => run(format)} whileTap={reduce ? undefined : { scale: 0.97 }} transition={m.spring.snappy} aria-live="polite">
            <AnimatePresence mode="popLayout" initial={false}>
              {done === format ? (
                <motion.span key="ok" className={styles.buttonInner} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: fadeT }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><motion.path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: m.duration.considered * 0.66, ease: ease.standard }} /></svg>
                  Pronto
                </motion.span>
              ) : (
                <motion.span key="label" className={styles.buttonInner} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: fadeT }}>
                  {format === "pdf" ? <FileText aria-hidden="true" size={18} /> : <FileSpreadsheet aria-hidden="true" size={18} />}
                  {format === "pdf" ? "Baixar PDF" : "Baixar Excel"}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

export function FullPageLink({ href }: { href: string }) {
  return (
    <Link href={href} className={styles.textLink}>Abrir a página completa <ArrowUpRight aria-hidden="true" size={14} /></Link>
  );
}

