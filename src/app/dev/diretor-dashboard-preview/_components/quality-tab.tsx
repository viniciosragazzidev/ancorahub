"use client";

/** "Qualidade dos leads" (LeadQualityCenter + LeadQualitySimple) in the director Lite look. */
import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarRange, Clock3, Download, Info, Megaphone } from "lucide-react";

import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { motionTokens as m } from "@/components/arc/motion-tokens";
import type { LeadQualityReport, LeadQualitySegment, SimpleLeadQualityReportData } from "@/features/reports/metrics/lead-quality-service";
import type { LeadQualityDimension } from "@/features/reports/metrics/lead-quality-contract";

import { QualityView } from "@/features/dashboard/components/director-lite/quality-view";

import styles from "../preview.module.css";
import { n, plural, share } from "./format";
import { enterT, fadeT, LiteBar, LiteItem, LiteNumber, LitePills, LiteReveal, LiteSwap, staggerDelay, useMedia, useReduce } from "./motion";
import { LitePick } from "./overlay";

export { QualityDisabled } from "@/features/dashboard/components/director-lite/quality-view";

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
            <QualityView report={simple} unitName={null} />
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

