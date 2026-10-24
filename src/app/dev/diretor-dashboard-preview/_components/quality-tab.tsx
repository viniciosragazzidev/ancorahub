"use client";

/** "Qualidade dos leads" (LeadQualityCenter + LeadQualitySimple) in the director Lite look. */
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, CalendarRange, Clock3, Download, Info, Megaphone, SearchX, Table2 } from "lucide-react";

import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { motionTokens as m } from "@/components/arc/motion-tokens";
import type { LeadQualityReport, LeadQualitySegment, SimpleLeadQualityReportData } from "@/features/reports/metrics/lead-quality-service";
import type { LeadQualityDimension } from "@/features/reports/metrics/lead-quality-contract";

import styles from "../preview.module.css";
import { n, pct, plural, share } from "./format";
import { enterT, exitT, fadeT, LiteBar, LiteColumn, LiteItem, LiteNumber, LitePills, LiteReveal, LiteSwap, staggerDelay, useMedia, useReduce } from "./motion";
import { LitePick } from "./overlay";

export const DIMENSION_LABELS: Record<LeadQualityDimension, string> = {
  source: "Origem", campaign: "Campanha", adset: "Conjunto de anúncios", ad: "Anúncio", form: "Formulário", queue: "Fila atual", broker: "Corretor atual",
  lead_type: "Tipo de lead", plan_type: "Tipo de plano", city: "Cidade", age_band: "Faixa etária", hour: "Dia e horário", origin: "Origem do lead", shift: "Turno", origin_shift: "Origem e turno",
};
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAY_PHRASE = ["no domingo", "na segunda", "na terça", "na quarta", "na quinta", "na sexta", "no sábado"];
export const hourLabel = (key: string) => {
  const [day, hour] = key.split(":").map(Number);
  return `${WEEKDAYS[day]}, ${String(hour).padStart(2, "0")}h`;
};

export type FocusTarget = { dimension: LeadQualityDimension; segment: LeadQualitySegment };

/* ------------------------------------------------------------------ simple view */

function Stat({ label, value, detail, tone, index, kind = "int" }: { label: string; value: number; detail?: string; tone?: "good" | "weak"; index: number; kind?: "int" | "dec" }) {
  return (
    <LiteItem index={index} className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <LiteNumber value={value} kind={kind} className={`${styles.statValue} ${tone === "good" ? styles.good : tone === "weak" ? styles.weak : ""}`} />
      {detail ? <span className={styles.statDetail}>{detail}</span> : null}
    </LiteItem>
  );
}

function Question({ number, title, children, help }: { number: number; title: string; children: ReactNode; help?: ReactNode }) {
  return (
    <LiteReveal as="section" className={styles.block} label={title}>
      <h2 className={styles.blockTitle}><span className={styles.stepNumber}>{number}</span>{title}</h2>
      {help ? <p className={styles.blockHelp}>{help}</p> : null}
      {children}
    </LiteReveal>
  );
}

function HourChart({ report }: { report: SimpleLeadQualityReportData }) {
  const max = Math.max(1, ...report.hours.map((hour) => Math.max(hour.arrived.good, hour.arrived.cold + hour.arrived.noReply)));
  return (
    <div className={styles.hourChart}>
      <div className={styles.legend} aria-hidden="true">
        <span><span className={styles.legendSwatch} data-tone="success" />Entraram bons</span>
        <span><span className={styles.legendSwatch} data-tone="neutral" />Entraram frios</span>
        {report.hourly === "timeline" ? <span><span className={styles.legendSwatch} data-tone="warning" />Bons acabaram</span> : null}
      </div>
      <div className={styles.hourBars} role="img" aria-label="Leads bons e frios que entraram por hora">
        {report.hours.map((hour, index) => {
          const weak = hour.arrived.cold + hour.arrived.noReply;
          const ranOut = hour.goodWaiting === 0 && hour.distributed.cold + hour.distributed.noReply > 0;
          return (
            <span key={hour.startsAt} className={styles.hourSlot} data-ranout={ranOut || undefined}>
              <span className={styles.hourPair}>
                <LiteColumn value={hour.arrived.good / max} delay={Math.min(index, 12) * 0.03} tone="success" label={`${hour.label}: ${n(hour.arrived.good)} bons`} />
                <LiteColumn value={weak / max} delay={Math.min(index, 12) * 0.03} tone="neutral" label={`${hour.label}: ${n(weak)} frios`} />
              </span>
              <span className={styles.hourTick}>{index % 2 === 0 ? hour.label : ""}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function SimpleView({ report, queueName }: { report: SimpleLeadQualityReportData; queueName: string | null }) {
  const [table, setTable] = useState(false);
  const arrivedWeak = report.arrived.cold + report.arrived.noReply;
  const sentWeak = report.distributed.cold + report.distributed.noReply;
  const runOuts = report.byQueue.filter((queue) => queue.goodRanOut);
  const inversions = report.byQueue.filter((queue) => queue.weakWhileGoodWaiting > 0);
  if (!report.arrived.total) {
    return <div className={styles.card}><div className={styles.cardEmpty}><EmptyState icon={<SearchX aria-hidden="true" />} title="Nenhum lead neste período" description="Escolha outro período ou outra fila." /></div></div>;
  }
  return (
    <div className={styles.stack}>
      {report.truncated ? <p className={styles.note} data-tone="warning"><AlertTriangle aria-hidden="true" size={16} />Período muito longo: o relatório usa só os leads mais recentes. Escolha um intervalo menor para ver tudo.</p> : null}
      <Question number={1} title="Quantos leads entraram e quantos são bons" help="Bom é quente ou morno validado. Lead de WhatsApp só conta como bom se o cliente respondeu a qualificação.">
        <div className={styles.stats4}>
          <Stat index={0} label="Entraram" value={report.arrived.total} detail={queueName ? `Pela fila ${queueName}` : "Todas as filas"} />
          <Stat index={1} label="Bons (quentes e mornos)" value={report.arrived.good} detail={`${pct(report.arrived.good, report.arrived.total)} do que entrou`} tone="good" />
          <Stat index={2} label="Frios" value={arrivedWeak} detail={`${n(report.arrived.cold)} frios e ${n(report.arrived.noReply)} de WhatsApp que não responderam, ${pct(arrivedWeak, report.arrived.total)}`} tone="weak" />
          <Stat index={3} label="Descartados ou em qualificação" value={report.arrived.other} detail={pct(report.arrived.other, report.arrived.total)} />
        </div>
      </Question>

      <Question number={2} title="Por fila">
        <div className={styles.card}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Fila de entrada</th>
                <th scope="col">Reter frios</th>
                <th scope="col" className={styles.numCol}>Entraram</th>
                <th scope="col" className={styles.numCol}>Bons</th>
                <th scope="col" className={styles.numCol}>Frios</th>
                <th scope="col" className={styles.numCol}>Distribuídos</th>
                <th scope="col" className={styles.numCol}>Frios distribuídos</th>
                <th scope="col" className={styles.numCol}>Bons acabaram</th>
              </tr>
            </thead>
            <tbody>
              {report.byQueue.map((queue) => (
                <tr key={queue.queue}>
                  <td data-label="Fila"><span className={styles.cellMain}>{queue.queue}</span></td>
                  <td data-label="Reter frios"><span className={styles.badge} data-tone={queue.holdColdLeads ? "success" : "neutral"}>{queue.holdColdLeads ? "Ligada" : "Desligada"}</span></td>
                  <td data-label="Entraram" className={styles.numCol}>{n(queue.arrived)}</td>
                  <td data-label="Bons" className={styles.numCol}>{n(queue.good)} <span className={styles.muted}>({pct(queue.good, queue.arrived)})</span></td>
                  <td data-label="Frios" className={styles.numCol}>{n(queue.weak)}</td>
                  <td data-label="Distribuídos" className={styles.numCol}>{n(queue.distributed)}</td>
                  <td data-label="Frios distribuídos" className={styles.numCol}>{n(queue.distributedWeak)}</td>
                  <td data-label="Bons acabaram" className={styles.numCol}>{report.hourly === "timeline" ? queue.goodRanOut ?? "Não acabaram" : "Escolha um dia"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Question>

      <Question
        number={3}
        title="Hora a hora: quando os bons acabaram"
        help={
          <>
            {report.hourly === "timeline"
              ? runOuts.length
                ? `${runOuts.map((queue) => `${queue.queue}: os bons acabaram às ${queue.goodRanOut}`).join("; ")}. Dali em diante só havia frios para entregar.`
                : "Em nenhuma hora os bons acabaram: sempre havia lead bom qualificado esperando."
              : "Período longo: cada coluna soma a mesma hora de todos os dias. A hora em que os bons acabam aparece escolhendo um dia só."}
            {queueName ? null : " Os bons de uma fila não atendem outra: escolha uma fila para ver só ela."}
          </>
        }
      >
        <div className={styles.card}>
          <div className={styles.cardBody}>
            <HourChart report={report} />
            <button type="button" className={styles.ghostButton} onClick={() => setTable((was) => !was)} aria-expanded={table}>
              <Table2 aria-hidden="true" size={16} /> {table ? "Esconder a tabela" : "Ver hora a hora em tabela"}
            </button>
          </div>
          <AnimatePresence initial={false}>
            {table ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: enterT }} exit={{ opacity: 0, transition: exitT }}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Hora</th>
                      <th scope="col" className={styles.numCol}>Entraram bons</th>
                      <th scope="col" className={styles.numCol}>Entraram frios</th>
                      <th scope="col" className={styles.numCol}>Foram bons</th>
                      <th scope="col" className={styles.numCol}>Foram frios</th>
                      {report.hourly === "timeline" ? <th scope="col" className={styles.numCol}>Bons esperando</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {report.hours.map((hour) => {
                      const ranOut = hour.goodWaiting === 0 && hour.distributed.cold + hour.distributed.noReply > 0;
                      return (
                        <tr key={hour.startsAt} data-tone={ranOut ? "warning" : undefined}>
                          <td data-label="Hora"><span className={styles.cellMain}>{hour.label}</span></td>
                          <td data-label="Entraram bons" className={styles.numCol}>{n(hour.arrived.good)}</td>
                          <td data-label="Entraram frios" className={styles.numCol}>{n(hour.arrived.cold + hour.arrived.noReply)}</td>
                          <td data-label="Foram bons" className={styles.numCol}>{n(hour.distributed.good)}</td>
                          <td data-label="Foram frios" className={styles.numCol}>{n(hour.distributed.cold + hour.distributed.noReply)}</td>
                          {report.hourly === "timeline" ? <td data-label="Bons esperando" className={styles.numCol}>{hour.goodWaiting === 0 ? "0, acabaram" : n(hour.goodWaiting ?? 0)}</td> : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
        {inversions.length ? (
          <p className={styles.note} data-tone="warning">
            <AlertTriangle aria-hidden="true" size={16} />
            Atenção: {inversions.map((queue) => `${queue.queue} mandou ${n(queue.weakWhileGoodWaiting)} frios com lead bom qualificado esperando na mesma fila`).join("; ")}. Aqui não faltou lead bom: vale revisar a distribuição.
          </p>
        ) : null}
      </Question>

      <Question number={4} title="E se não mandasse os frios? (estimativa)" help="Estimativa: tira os frios do que foi entregue e supõe que os bons seriam entregues igual.">
        <div className={styles.stats3}>
          <Stat index={0} label="Foram para os corretores" value={report.distributed.total} detail={`${n(report.distributed.good)} bons e ${n(sentWeak)} frios, ${n(report.brokers)} corretores`} />
          <Stat index={1} label="Sem os frios seriam (estimativa)" value={report.withoutWeak.distributed} detail={`${n(report.withoutWeak.removed)} leads a menos (${share(report.withoutWeak.removedShare)})`} tone="weak" />
          <LiteItem index={2} className={styles.stat}>
            <span className={styles.statLabel}>Média por corretor</span>
            <span className={styles.statValue}>
              {report.withoutWeak.perBrokerNow === null ? "sem dados" : <LiteNumber value={report.withoutWeak.perBrokerNow} kind="dec" />}
              <span className={styles.statArrow} aria-label="para">para</span>
              {report.withoutWeak.perBrokerWithout === null ? "sem dados" : <LiteNumber value={report.withoutWeak.perBrokerWithout} kind="dec" />}
            </span>
            <span className={styles.statDetail}>Hoje, e sem os frios</span>
          </LiteItem>
        </div>
        <div className={styles.split11}>
          {report.shifts.map((shift, index) => {
            const total = shift.distributedGood + shift.distributedWeak;
            return (
              <LiteItem key={shift.key} index={index} className={styles.mutedCard}>
                <h3 className={styles.cardTitleSm}>{shift.label}</h3>
                <p>Receberam <strong className={styles.strong}>{n(total)}</strong> leads: {n(shift.distributedGood)} bons e {n(shift.distributedWeak)} frios ({n(shift.brokers)} corretores).</p>
                <p className={styles.muted}>Sem os frios: <strong className={styles.strong}>{n(shift.distributedGood)}</strong> leads{shift.brokers ? `, ${(shift.distributedGood / shift.brokers).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} por corretor` : ""}.</p>
              </LiteItem>
            );
          })}
        </div>
        <p className={styles.footnote}>Vendas vindas de leads frios no período: {n(report.converted.weak)}. De leads bons: {n(report.converted.good)}.</p>
      </Question>
    </div>
  );
}

/* ------------------------------------------------------------------ detailed view */

function SegmentCard({ title, description, dimension, rows, onFocus, metaOnly = false, index = 0 }: { title: string; description: string; dimension: LeadQualityDimension; rows: LeadQualitySegment[]; onFocus: (target: FocusTarget) => void; metaOnly?: boolean; index?: number }) {
  const visible = metaOnly ? rows.filter((row) => row.key !== "__unknown__") : rows;
  const max = Math.max(1, ...visible.map((row) => row.total));
  return (
    <LiteReveal as="section" className={styles.card} label={title} delay={staggerDelay(index % 2)}>
      <header className={styles.cardHeader}>
        <div>
          <h3 className={styles.cardTitle}>{title}</h3>
          <p className={styles.cardDescription}>{description}</p>
        </div>
      </header>
      {visible.length ? (
        <table className={styles.table} data-clickable="true">
          <thead>
            <tr>
              <th scope="col">{DIMENSION_LABELS[dimension]}</th>
              <th scope="col" className={styles.numCol}>Leads</th>
              <th scope="col" className={styles.numCol}>Quentes e mornos</th>
              <th scope="col" className={styles.numCol}>Convertidos*</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={`${dimension}-${row.key}`}>
                <td data-label={DIMENSION_LABELS[dimension]}>
                  <button type="button" className={styles.rowButton} onClick={() => onFocus({ dimension, segment: row })} aria-haspopup="dialog" title={row.label}>
                    <span className={styles.truncate}>{row.label}</span>
                  </button>
                  <LiteBar value={row.total / max} height={3} className={styles.segmentBar} />
                </td>
                <td data-label="Leads" className={styles.numCol}>{n(row.total)}</td>
                <td data-label="Quentes e mornos" className={styles.numCol}>{n(row.hot + row.warm)} <span className={styles.muted}>{share(row.hotWarmShare)}</span></td>
                <td data-label="Convertidos" className={styles.numCol}>{n(row.converted)} <span className={styles.muted}>{share(row.conversionRate)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className={styles.cardEmptyText}>Nenhum grupo com 3 ou mais leads neste recorte.</p>
      )}
    </LiteReveal>
  );
}

function SectionHead({ id, title, help, aside }: { id: string; title: string; help: string; aside?: ReactNode }) {
  return (
    <div className={styles.sectionHead}>
      <div>
        <h2 id={id} className={styles.blockTitle}>{title}</h2>
        <p className={styles.blockHelp}>{help}</p>
      </div>
      {aside}
    </div>
  );
}

function Temperature({ report }: { report: LeadQualityReport }) {
  const reduce = useReduce();
  const { summary } = report;
  const rows = [
    { label: "Quente", value: summary.hot, share: summary.temperatureDistribution.hot, tone: "danger" },
    { label: "Morno", value: summary.warm, share: summary.temperatureDistribution.warm, tone: "warning" },
    { label: "Frio", value: summary.cold, share: summary.temperatureDistribution.cold, tone: "series-1" },
    { label: "Sem classificação", value: summary.unclassified, share: summary.temperatureDistribution.unclassified, tone: "neutral" },
  ];
  return (
    <LiteReveal as="section" className={styles.card} label="Temperatura registrada">
      <header className={styles.cardHeader}>
        <div>
          <h3 className={styles.cardTitle}>Temperatura registrada</h3>
          <p className={styles.cardDescription}>Classificação atual salva no lead. O score não é tratado como chance de venda.</p>
        </div>
      </header>
      <div className={styles.cardBody}>
        <motion.div className={styles.stacked} role="img" aria-label={`Distribuição de temperatura em ${n(summary.total)} leads`} initial={reduce ? { opacity: 0 } : { scaleX: 0 }} whileInView={{ opacity: 1, scaleX: 1 }} viewport={{ once: true }} transition={reduce ? fadeT : { ...enterT, duration: m.duration.considered }}>
          {rows.map((row) => <span key={row.label} data-tone={row.tone} style={{ flexGrow: Math.max(row.value, 0.0001) }} />)}
        </motion.div>
        <ul className={styles.legendList}>
          {rows.map((row) => (
            <li key={row.label}>
              <span className={styles.legendName}><span className={styles.legendSwatch} data-tone={row.tone} aria-hidden="true" />{row.label}</span>
              <LiteNumber value={row.value} className={styles.rowNumber} />
              <span className={styles.muted}>{share(row.share)}</span>
            </li>
          ))}
        </ul>
        <p className={styles.footnote}>{n(summary.classified)} classificados, {share(summary.classificationCoverage)} de cobertura.</p>
      </div>
    </LiteReveal>
  );
}

function Cohort({ report }: { report: LeadQualityReport }) {
  const { summary } = report;
  const items = [
    { label: "Convertidos hoje", value: summary.converted, detail: `${share(summary.conversionRate)} da coorte` },
    { label: "Quentes e mornos convertidos", value: summary.hotWarmConverted, detail: `${share(summary.hotWarmConversionRate)} de quentes e mornos` },
    { label: "Distribuídos no turno", value: summary.assignedInShift, detail: `de ${n(summary.total)}: ${share(summary.assignedInShiftRate)} entraram e foram atribuídos até o fim do próprio turno` },
    { label: "Com corretor atual", value: summary.assigned, detail: `${share(summary.assignedRate)} da coorte` },
  ];
  return (
    <LiteReveal as="section" className={styles.card} label="O que aconteceu com essa coorte" delay={staggerDelay(1)}>
      <header className={styles.cardHeader}>
        <div>
          <h3 className={styles.cardTitle}>O que aconteceu com essa coorte</h3>
          <p className={styles.cardDescription}>Status e atribuição atuais; não é um retrato histórico da temperatura no momento da entrada.</p>
        </div>
      </header>
      <div className={styles.cardBody}>
        <div className={styles.stats2}>
          {items.map((item, index) => (
            <LiteItem key={item.label} index={index} className={styles.stat}>
              <span className={styles.statLabel}>{item.label}</span>
              <LiteNumber value={item.value} className={styles.miniValue} />
              <span className={styles.statDetail}>{item.detail}</span>
            </LiteItem>
          ))}
        </div>
        <p className={styles.note}><Clock3 aria-hidden="true" size={16} />Tempo médio até o 1º contato: {summary.averageFirstContactSeconds == null ? "sem registros" : `${n(Math.round(summary.averageFirstContactSeconds / 60))} min`}</p>
      </div>
    </LiteReveal>
  );
}

function ShiftFlow({ report }: { report: LeadQualityReport }) {
  const first = report.segments.shift.find((segment) => segment.key === "1");
  const second = report.segments.shift.find((segment) => segment.key === "2");
  const arrived1 = first?.total ?? 0;
  const inShift1 = first?.assignedInShift ?? 0;
  const leftover = arrived1 - inShift1;
  const leftoverTaken = first?.assignedAfterShift ?? 0;
  const arrived2 = second?.total ?? 0;
  const inShift2 = second?.assignedInShift ?? 0;
  const toHandle = arrived2 + leftover;
  const handled = inShift2 + leftoverTaken;
  const cards = [
    { title: "Turno 1", rows: [["Entraram", n(arrived1)], ["Distribuídos no turno", n(inShift1)], ["Sobraram para o Turno 2", n(leftover)]] },
    { title: "Turno 2", rows: [["Entraram", n(arrived2)], ["Mais as sobras do Turno 1", n(leftover)], ["Total para distribuir", n(toHandle)], ["Distribuídos", `${n(handled)} (${n(inShift2)} do turno e ${n(leftoverTaken)} das sobras)`], ["Não distribuídos no turno", n(Math.max(0, toHandle - handled))]] },
  ];
  return (
    <div className={styles.split11} aria-label="Entrada e distribuição por turno">
      {cards.map((card, index) => (
        <LiteItem key={card.title} index={index} className={styles.mutedCard}>
          <h3 className={styles.cardTitleSm}>{card.title}</h3>
          <dl className={styles.dl}>
            {card.rows.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>
        </LiteItem>
      ))}
    </div>
  );
}

function Heatmap({ report, onFocus }: { report: LeadQualityReport; onFocus: (target: FocusTarget) => void }) {
  const reduce = useReduce();
  const values = new Map(report.segments.hour.map((row) => [row.key, row]));
  const max = Math.max(3, ...report.segments.hour.map((row) => row.total));
  const level = (count: number) => (count >= max * 0.72 ? 4 : count >= max * 0.42 ? 3 : count >= max * 0.22 ? 2 : 1);
  const phone = useMedia("(max-width: 767px)");
  const totals = WEEKDAYS.map((_, dayIndex) => report.segments.hour.filter((row) => row.key.startsWith(`${dayIndex}:`)).reduce((sum, row) => sum + row.total, 0));
  const [pickedDay, setPickedDay] = useState<number | null>(null);
  const activeDay = pickedDay ?? totals.indexOf(Math.max(...totals));
  return (
    <LiteReveal as="section" className={styles.card} label="Quando os leads chegam">
      <header className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle}>Quando os leads chegam</h2>
          <p className={styles.cardDescription}>Dia da semana e hora de criação, no fuso de Brasília. Células com menos de 3 leads ficam vazias. Toque numa célula para ver os leads.</p>
        </div>
      </header>
      <div className={styles.cardBody}>
        {phone ? (
          <>
            <LitePills group="heat-day" label="Dia da semana" className={styles.heatDays} options={WEEKDAYS.map((day, index) => ({ value: index, label: day }))} value={activeDay} onChange={setPickedDay} />
            <p className={styles.muted}>{plural(totals[activeDay], "lead", "leads", "Nenhum lead")} {WEEKDAY_PHRASE[activeDay]}, hora a hora.</p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.ul key={activeDay} className={styles.heatHours} aria-label={`Leads por hora, ${WEEKDAYS[activeDay]}`} initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0, transition: reduce ? fadeT : enterT }} exit={{ opacity: 0, transition: fadeT }}>
                {Array.from({ length: 24 }, (_, hour) => {
                  const key = `${activeDay}:${hour}`;
                  const row = values.get(key);
                  const label = `${String(hour).padStart(2, "0")}h`;
                  return (
                    <li key={key}>
                      {row ? (
                        <button type="button" className={styles.heatCell} data-level={level(row.total)} onClick={() => onFocus({ dimension: "hour", segment: row })} aria-label={`${WEEKDAYS[activeDay]}, ${hour} horas: ${row.total} leads. Abrir registros`}>
                          <span className={styles.heatHourLabel}>{label}</span>
                          <span>{n(row.total)}</span>
                        </button>
                      ) : (
                        <span className={styles.heatCell} data-level="0" aria-label={`${WEEKDAYS[activeDay]}, ${hour} horas: sem amostra suficiente`}>
                          <span className={styles.heatHourLabel}>{label}</span>
                          <span aria-hidden="true">·</span>
                        </span>
                      )}
                    </li>
                  );
                })}
              </motion.ul>
            </AnimatePresence>
          </>
        ) : (
        <div className={styles.heatmap}>
          <span aria-hidden="true" />
          {Array.from({ length: 24 }, (_, hour) => <span key={hour} className={styles.heatHour} aria-hidden="true">{hour % 3 === 0 ? String(hour).padStart(2, "0") : ""}</span>)}
          {WEEKDAYS.map((day, dayIndex) => (
            <motion.div key={day} className={styles.heatRow} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={reduce ? fadeT : { ...enterT, delay: staggerDelay(dayIndex) }}>
              <span className={styles.heatDay}>{day}</span>
              {Array.from({ length: 24 }, (_, hour) => {
                const key = `${dayIndex}:${hour}`;
                const row = values.get(key);
                return row ? (
                  <button key={key} type="button" className={styles.heatCell} data-level={level(row.total)} onClick={() => onFocus({ dimension: "hour", segment: row })} aria-label={`${day}, ${hour} horas: ${row.total} leads. Abrir registros`} title={`${hourLabel(key)}: ${n(row.total)} leads`}>
                    <span className={styles.heatNumber}>{row.total}</span>
                  </button>
                ) : (
                  <span key={key} className={styles.heatCell} data-level="0" title="Sem amostra suficiente" aria-label={`${day}, ${hour} horas: sem amostra suficiente`} />
                );
              })}
            </motion.div>
          ))}
        </div>
        )}
        <div className={styles.heatLegend} aria-hidden="true">
          <span>Menos</span>
          {[1, 2, 3, 4].map((step) => <span key={step} className={styles.heatCell} data-level={step} />)}
          <span>Mais leads</span>
        </div>
      </div>
    </LiteReveal>
  );
}

function DetailedView({ report, onFocus, periodLabel }: { report: LeadQualityReport; onFocus: (target: FocusTarget) => void; periodLabel: string }) {
  const { summary } = report;
  const originOrder = ["form", "whatsapp", "other"];
  const originShiftRows = [...report.segments.origin_shift].sort((a, b) => {
    const [originA, shiftA] = a.key.split(":");
    const [originB, shiftB] = b.key.split(":");
    return shiftA.localeCompare(shiftB) || originOrder.indexOf(originA) - originOrder.indexOf(originB);
  });
  if (!summary.total) {
    return <div className={styles.card}><div className={styles.cardEmpty}><EmptyState icon={<Megaphone aria-hidden="true" />} title="Nenhum lead neste período" description="Não há leads visíveis no seu escopo neste período. Escolha uma janela maior ou volte depois que novos leads entrarem na operação." /></div></div>;
  }
  return (
    <div className={styles.stack}>
      <LiteReveal as="section" className={`${styles.card} ${styles.intro}`} label="Sobre a análise">
        <div>
          <h2 className={styles.introTitle}>Da origem do lead aos sinais de qualidade</h2>
          <p className={styles.cardDescription}>Compare temperatura, anúncio, perfil, fila e horário para achar os padrões que merecem atenção, com caminho até os leads de cada recorte.</p>
        </div>
        <span className={styles.badge} data-tone="neutral"><Clock3 aria-hidden="true" size={14} />{periodLabel}</span>
      </LiteReveal>

      <section className={styles.stats4} aria-label="Indicadores principais">
        <LiteItem index={0} className={styles.stat}><span className={styles.statLabel}>Leads recebidos</span><LiteNumber value={summary.total} className={styles.statValue} /><span className={styles.statDetail}>{periodLabel}</span></LiteItem>
        <LiteItem index={1} className={styles.stat}><span className={styles.statLabel}>Quentes e mornos</span><LiteNumber value={summary.hot + summary.warm} className={`${styles.statValue} ${styles.good}`} /><span className={styles.statDetail}>{share(summary.hotWarmShare)} dos que têm temperatura</span></LiteItem>
        <LiteItem index={2} className={styles.stat}><span className={styles.statLabel}>Classificação registrada</span><LiteNumber value={summary.classificationCoverage} kind="dec" className={styles.statValue} /><span className={styles.statDetail}>% dos leads, {n(summary.classified)} com temperatura salva</span></LiteItem>
        <LiteItem index={3} className={styles.stat}><span className={styles.statLabel}>Com anúncio Meta</span><LiteNumber value={summary.metaAdAttributionCoverage} kind="dec" className={styles.statValue} /><span className={styles.statDetail}>% dos leads, {n(summary.metaAttributed)} com ID de anúncio confirmado</span></LiteItem>
      </section>

      <div className={styles.split45}>
        <Temperature report={report} />
        <Cohort report={report} />
      </div>

      <section className={styles.stack} aria-labelledby="q-origin">
        <SectionHead id="q-origin" title="Formulário e WhatsApp, por turno" help="Turno 1: das 19h do dia anterior às 13h30. Turno 2: das 13h30 às 19h. Num intervalo, o Turno 1 vai do início até 13h30 do último dia." />
        <ShiftFlow report={report} />
        <div className={styles.split11}>
          <SegmentCard index={0} title="Origem do lead" description="Formulário Meta, WhatsApp e demais origens." dimension="origin" rows={report.segments.origin} onFocus={onFocus} />
          <SegmentCard index={1} title="Origem por turno" description="Cada origem em cada turno do dia." dimension="origin_shift" rows={originShiftRows} onFocus={onFocus} />
        </div>
      </section>

      <section className={styles.stack} aria-labelledby="q-acq">
        <SectionHead id="q-acq" title="Campanhas e anúncios" help="Origem pelos IDs Meta salvos no lead. Sem estimativa de investimento, CPL ou CPA." aside={<span className={styles.badge} data-tone="neutral">{n(summary.metaAttributed)} IDs de anúncio</span>} />
        <div className={styles.split11}>
          <SegmentCard index={0} title="Anúncios com maior volume" description="Quentes, mornos e conversões no status atual." dimension="ad" rows={report.segments.ad} onFocus={onFocus} metaOnly />
          <SegmentCard index={1} title="Campanhas" description="Compare a qualidade entre campanhas identificadas." dimension="campaign" rows={report.segments.campaign} onFocus={onFocus} metaOnly />
          <SegmentCard index={0} title="Conjuntos de anúncios" description="Padrões por público ou conjunto registrado na Meta." dimension="adset" rows={report.segments.adset} onFocus={onFocus} metaOnly />
          <SegmentCard index={1} title="Formulários" description="Leads atribuídos a formulários identificados." dimension="form" rows={report.segments.form} onFocus={onFocus} metaOnly />
          <SegmentCard index={0} title="Canais de entrada" description="Canal registrado no momento da captura." dimension="source" rows={report.segments.source} onFocus={onFocus} />
        </div>
      </section>

      <section className={styles.stack} aria-labelledby="q-op">
        <SectionHead id="q-op" title="Para onde foram e quem atende" help="Fila e corretor refletem a atribuição atual do lead." />
        <div className={styles.split11}>
          <SegmentCard index={0} title="Filas atuais" description="Volume e qualidade por fila responsável hoje." dimension="queue" rows={report.segments.queue} onFocus={onFocus} />
          <SegmentCard index={1} title="Corretores atuais" description="Leitura de carteira; não representa histórico de transferência." dimension="broker" rows={report.segments.broker} onFocus={onFocus} />
        </div>
      </section>

      <section className={styles.stack} aria-labelledby="q-profile">
        <SectionHead id="q-profile" title="Quem está chegando" help="Recortes agregados; idade aparece em faixas e grupos pequenos ficam ocultos." />
        <div className={styles.split11}>
          <SegmentCard index={0} title="Tipo de lead e plano" description="Perfil comercial registrado na qualificação." dimension="lead_type" rows={report.segments.lead_type} onFocus={onFocus} />
          <SegmentCard index={1} title="Tipo de plano" description="Plano individual, familiar ou empresarial informado." dimension="plan_type" rows={report.segments.plan_type} onFocus={onFocus} />
          <SegmentCard index={0} title="Cidades" description="Localidade informada pelo lead." dimension="city" rows={report.segments.city} onFocus={onFocus} />
          <SegmentCard index={1} title="Faixa etária" description="A partir da idade individual ou média salva, quando numérica." dimension="age_band" rows={report.segments.age_band} onFocus={onFocus} />
        </div>
      </section>

      <Heatmap report={report} onFocus={onFocus} />

      <p className={styles.footnote}>
        Quentes e mornos são percentuais entre os classificados. *Convertidos são o status atual sobre o total do grupo. Só aparecem grupos com ao menos 3 leads.
        Coorte por data de criação. Temperatura, status, fila e corretor são valores atuais; mudanças passadas não têm retrato nesta versão. Nomes e detalhes pessoais só aparecem depois de escolher um recorte.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ tab */

export function QualityTab({
  report, simple, vista, onVista, queues, queueId, onQueue, onFocus, onRange, onExport, periodLabel,
}: {
  report: LeadQualityReport; simple: SimpleLeadQualityReportData; vista: "simples" | "detalhada"; onVista: (vista: "simples" | "detalhada") => void;
  queues: Array<{ id: string; name: string }>; queueId: string | null; onQueue: (id: string | null) => void;
  onFocus: (target: FocusTarget) => void; onRange: () => void; onExport: () => void; periodLabel: string;
}) {
  const queueName = queues.find((queue) => queue.id === queueId)?.name ?? null;
  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <LitePills group="quality-vista" label="Vista do relatório" options={[{ value: "simples", label: "Simples" }, { value: "detalhada", label: "Detalhada" }]} value={vista} onChange={onVista} />
        <div className={styles.toolbarEnd}>
          <LitePick label="Fila da análise de qualidade" value={queueId ?? "all"} onChange={(value) => onQueue(value === "all" ? null : value)} options={[{ value: "all", label: "Todas as filas" }, ...queues.map((queue) => ({ value: queue.id, label: queue.name }))]} />
          <button type="button" className={styles.secondaryButton} onClick={onRange} aria-haspopup="dialog"><CalendarRange aria-hidden="true" size={18} /> Intervalo</button>
          <button type="button" className={styles.secondaryButton} onClick={onExport} aria-haspopup="dialog"><Download aria-hidden="true" size={18} /> Exportar</button>
        </div>
      </div>
      <LiteSwap id={vista}>
        {vista === "simples" ? (
          <div className={styles.stack}>
            <SimpleView report={simple} queueName={queueName} />
            <button type="button" className={styles.textLink} onClick={() => onVista("detalhada")}>
              <Info aria-hidden="true" size={14} /> Ver a análise detalhada (campanhas, anúncios, cidades)
            </button>
          </div>
        ) : (
          <DetailedView report={report} onFocus={onFocus} periodLabel={periodLabel} />
        )}
      </LiteSwap>
    </div>
  );
}

export function QualityDisabled() {
  return (
    <div className={styles.card}>
      <div className={styles.cardEmpty}>
        <EmptyState icon={<Info aria-hidden="true" />} title="Central temporariamente indisponível" description="A Central de Relatórios foi desativada pelo Super-admin. A visão da operação continua disponível." action={<Link href="/dashboard" className={styles.secondaryButton}>Voltar ao painel</Link>} />
      </div>
    </div>
  );
}
