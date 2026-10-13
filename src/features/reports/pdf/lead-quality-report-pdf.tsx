import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ReactNode } from "react";
import { render } from "takumi-pdf";
import { PageNumber, TotalPages } from "takumi-pdf/primitives";

import { Badge } from "@/components/pdf/badge/badge";
import { DataTable } from "@/components/pdf/data-table/data-table";
import type { DataTableColumn } from "@/components/pdf/data-table/data-table.types";
import { Heading } from "@/components/pdf/heading/heading";
import { Text } from "@/components/pdf/text/text";
import { PdfcnThemeProvider } from "@/components/pdf/theme-provider";
import { Document, Page, View, Text as Span } from "@/lib/pdf-primitives";

import { LEAD_ORIGINS, type LeadOrigin } from "../metrics/lead-quality-contract";
import type { LeadQualitySegment, SimpleLeadQualityReportData } from "../metrics/lead-quality-service";
import type { LeadQualityExport } from "../metrics/lead-quality-export";
import { LEAD_SHIFTS, leadQualityPeriodLabel, leadQualityWindowLabel } from "../metrics/lead-quality-period";
import { ancoraPdfTheme } from "./ancora-pdf-theme";
import {
  dateTimeLabel, shortDateTimeLabel, durationLabel, hourSlotLabel, leadStatusLabel, numberLabel, originLabel, percentLabel, sourceLabel, temperatureLabel,
} from "./lead-quality-report-labels";

const C = ancoraPdfTheme.colors;
/** Temperature hues, the same as the dashboard's temperature card. */
const TEMPERATURE = { hot: "#f43f5e", warm: "#f59e0b", cold: "#0ea5e9", unclassified: "#d4d4d4" } as const;

export type LeadQualityPdfInput = LeadQualityExport & {
  tenantName: string;
  generatedAt: Date;
  originLabelFilter: string;
  /** The simple, explained report (default). Null: the detailed analysis. */
  simple?: SimpleLeadQualityReportData | null;
};

// ─── Small building blocks ────────────────────────────────────────────────

function Row({ children, gap = 8, style }: { children: ReactNode; gap?: number; style?: Record<string, unknown> }) {
  return <View style={{ flexDirection: "row", gap, ...style }}>{children}</View>;
}

function Tile({ label, value, detail, highlight = false }: { label: string; value: string; detail?: string; highlight?: boolean }) {
  return (
    <View style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 10, gap: 3 }}>
      <Span style={{ fontSize: 7.5, color: C.mutedForeground, fontWeight: 500 }}>{label}</Span>
      <Span style={{ fontSize: 17, fontWeight: 600, color: highlight ? C.accent : C.foreground }}>{value}</Span>
      {detail ? <Span style={{ fontSize: 7, color: C.mutedForeground }}>{detail}</Span> : null}
    </View>
  );
}

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <View style={{ gap: 2, marginTop: 18, marginBottom: 8 }} wrap={false}>
      <Heading level={2} noMargin>{title}</Heading>
      {description ? <Span style={{ fontSize: 8, color: C.mutedForeground }}>{description}</Span> : null}
    </View>
  );
}

/** One horizontal bar: track in Paper Mist, fill in the given color. */
function Bar({ share, color = C.accent, height = 6 }: { share: number; color?: string; height?: number }) {
  const width = `${Math.max(0, Math.min(100, share))}%`;
  return (
    <View style={{ height, borderRadius: 9999, backgroundColor: C.muted, flexDirection: "row", overflow: "hidden" }}>
      <View style={{ width, height, backgroundColor: color, borderRadius: 9999 }} />
    </View>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <Row gap={5} style={{ alignItems: "center" }}>
      <View style={{ width: 6, height: 6, borderRadius: 9999, backgroundColor: color }} />
      <Span style={{ fontSize: 8, color: C.mutedForeground }}>{label}</Span>
      <Span style={{ fontSize: 8, fontWeight: 600, color: C.foreground }}>{value}</Span>
    </Row>
  );
}

// ─── Sections ─────────────────────────────────────────────────────────────

type SegmentRow = {
  label: string; total: string; share: string; hot: string; warm: string; cold: string; assigned: string; converted: string; conversion: string; firstContact: string;
};

function segmentRow(segment: Pick<LeadQualitySegment, "total" | "hot" | "warm" | "cold" | "assigned" | "assignedInShift" | "converted" | "hotWarmShare" | "conversionRate" | "averageFirstContactSeconds">, label: string): SegmentRow {
  return {
    label,
    total: numberLabel(segment.total),
    share: percentLabel(segment.hotWarmShare),
    hot: numberLabel(segment.hot),
    warm: numberLabel(segment.warm),
    cold: numberLabel(segment.cold),
    assigned: numberLabel(segment.assignedInShift),
    converted: numberLabel(segment.converted),
    conversion: percentLabel(segment.conversionRate),
    firstContact: durationLabel(segment.averageFirstContactSeconds),
  };
}

const segmentColumns = (first: string): DataTableColumn<SegmentRow>[] => [
  { key: "label", header: first, width: "24%" },
  { key: "total", header: "Leads", align: "right", width: "7.5%" },
  { key: "share", header: "Q+M", align: "right", width: "7.5%" },
  { key: "hot", header: "Quentes", align: "right", width: "8.5%" },
  { key: "warm", header: "Mornos", align: "right", width: "8.5%" },
  { key: "cold", header: "Frios", align: "right", width: "7%" },
  { key: "assigned", header: "Distrib. no turno", align: "right", width: "8.5%" },
  { key: "converted", header: "Conv.", align: "right", width: "7%" },
  { key: "conversion", header: "Taxa", align: "right", width: "8%" },
  { key: "firstContact", header: "1º contato", align: "right", width: "13.5%" },
];

function SegmentSection({ title, description, rows, first, label = (row) => row.label }: { title: string; description: string; rows: LeadQualitySegment[]; first: string; label?: (row: LeadQualitySegment) => string }) {
  if (!rows.length) return null;
  return (
    <View>
      <SectionTitle title={title} description={description} />
      <DataTable size="compact" stripe columns={segmentColumns(first)} data={rows.map((row) => segmentRow(row, label(row)))} />
    </View>
  );
}

function Cover({ input }: { input: LeadQualityPdfInput }) {
  const { report } = input;
  const window = { since: new Date(report.window.since), until: report.window.until ? new Date(report.window.until) : null };
  return (
    <View style={{ gap: 10 }}>
      <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
        <Span style={{ fontSize: 8, fontWeight: 600, color: C.accent, letterSpacing: 0.6 }}>RELATÓRIO DE QUALIDADE DE LEADS</Span>
        <Span style={{ fontSize: 8, color: C.mutedForeground }}>{input.tenantName}</Span>
      </Row>
      <Heading level={1} noMargin>{leadQualityPeriodLabel(report.period)}</Heading>
      <Text variant="sm" color="mutedForeground" noMargin>{`Leads criados entre ${leadQualityWindowLabel(window, input.generatedAt)} · horário de Brasília`}</Text>
      <Row gap={6} style={{ flexWrap: "wrap" }}>
        <Badge variant="outline" size="sm" label={`Fila: ${input.queueName ?? "Todas as filas"}`} />
        <Badge variant="outline" size="sm" label={`Origem: ${input.originLabelFilter}`} />
        <Badge variant="outline" size="sm" label="Turno 1: 19h–13h30 · Turno 2: 13h30–19h" />
      </Row>
    </View>
  );
}

function SummaryTiles({ input }: { input: LeadQualityPdfInput }) {
  const s = input.report.summary;
  return (
    <View style={{ gap: 8, marginTop: 16 }}>
      <Row>
        <Tile label="Leads recebidos" value={numberLabel(s.total)} detail={`${numberLabel(s.classified)} classificados`} highlight />
        <Tile label="Quentes + mornos" value={percentLabel(s.hotWarmShare)} detail={`${numberLabel(s.hot + s.warm)} leads`} />
        <Tile label="Conversão" value={percentLabel(s.conversionRate)} detail={`${numberLabel(s.converted)} convertidos`} />
        <Tile label="Distribuídos no turno" value={`${numberLabel(s.assignedInShift)} de ${numberLabel(s.total)}`} detail={`${percentLabel(s.assignedInShiftRate)} entraram e foram atribuídos até o fim do próprio turno · ${numberLabel(s.assigned)} com corretor hoje`} />
      </Row>
      <Row>
        <Tile label="1º contato (média)" value={durationLabel(s.averageFirstContactSeconds)} detail="Do recebimento ao primeiro contato" />
        <Tile label="Conversão de Q+M" value={percentLabel(s.hotWarmConversionRate)} detail={`${numberLabel(s.hotWarmConverted)} convertidos`} />
        <Tile label="Cobertura da classificação" value={percentLabel(s.classificationCoverage)} detail="Leads com temperatura" />
        <Tile label="Atribuição a anúncio" value={percentLabel(s.metaAdAttributionCoverage)} detail={`${numberLabel(s.metaAttributed)} com anúncio Meta`} />
      </Row>
    </View>
  );
}

function TemperatureBlock({ input }: { input: LeadQualityPdfInput }) {
  const s = input.report.summary;
  const parts = [
    { key: "hot", label: "Quentes", value: s.hot, color: TEMPERATURE.hot },
    { key: "warm", label: "Mornos", value: s.warm, color: TEMPERATURE.warm },
    { key: "cold", label: "Frios", value: s.cold, color: TEMPERATURE.cold },
    { key: "unclassified", label: "Sem classificação", value: s.unclassified, color: TEMPERATURE.unclassified },
  ];
  return (
    <View wrap={false}>
      <SectionTitle title="Temperatura" description="Classificação registrada no lead pela qualificação." />
      <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, gap: 10 }}>
        <View style={{ height: 10, borderRadius: 9999, backgroundColor: C.muted, flexDirection: "row", overflow: "hidden" }}>
          {parts.filter((part) => part.value > 0).map((part) => (
            <View key={part.key} style={{ width: `${s.total ? (part.value / s.total) * 100 : 0}%`, height: 10, backgroundColor: part.color }} />
          ))}
        </View>
        <Row gap={16} style={{ flexWrap: "wrap" }}>
          {parts.map((part) => <Legend key={part.key} color={part.color} label={part.label} value={`${numberLabel(part.value)} · ${percentLabel(s.total ? (part.value / s.total) * 100 : 0)}`} />)}
        </Row>
      </View>
    </View>
  );
}

function OriginCards({ input }: { input: LeadQualityPdfInput }) {
  const total = input.report.summary.total;
  const byOrigin = new Map(input.report.segments.origin.map((segment) => [segment.key as LeadOrigin, segment]));
  const origins = LEAD_ORIGINS.filter((origin) => origin.key !== "other" || byOrigin.get("other"));
  return (
    <View wrap={false}>
      <SectionTitle title="Formulário × WhatsApp" description="Leads de formulário Meta, leads que chegaram pelo WhatsApp e demais origens." />
      <Row>
        {origins.map((origin) => {
          const segment = byOrigin.get(origin.key);
          const count = segment?.total ?? 0;
          const share = total ? (count / total) * 100 : 0;
          return (
            <View key={origin.key} style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, gap: 6 }}>
              <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
                <Span style={{ fontSize: 9, fontWeight: 600, color: C.foreground }}>{origin.label}</Span>
                <Span style={{ fontSize: 8, color: C.mutedForeground }}>{percentLabel(share)} do total</Span>
              </Row>
              <Span style={{ fontSize: 20, fontWeight: 600, color: C.accent }}>{numberLabel(count)}</Span>
              <Bar share={share} />
              <View style={{ gap: 2, marginTop: 2 }}>
                {[
                  ["Quentes + mornos", segment ? percentLabel(segment.hotWarmShare) : "—"],
                  ["Distribuídos no turno", segment ? `${numberLabel(segment.assignedInShift)} de ${numberLabel(segment.total)}` : "—"],
                  ["Convertidos", segment ? `${numberLabel(segment.converted)} (${percentLabel(segment.conversionRate)})` : "—"],
                  ["1º contato (média)", durationLabel(segment?.averageFirstContactSeconds ?? null)],
                ].map(([label, value]) => (
                  <Row key={label} style={{ justifyContent: "space-between" }}>
                    <Span style={{ fontSize: 8, color: C.mutedForeground }}>{label}</Span>
                    <Span style={{ fontSize: 8, fontWeight: 500, color: C.foreground }}>{value}</Span>
                  </Row>
                ))}
              </View>
            </View>
          );
        })}
      </Row>
    </View>
  );
}

function ShiftBlock({ input }: { input: LeadQualityPdfInput }) {
  const { segments } = input.report;
  const shiftTotals = new Map(segments.shift.map((segment) => [Number(segment.key), segment]));
  const byOriginShift = new Map(segments.origin_shift.map((segment) => [segment.key, segment]));
  const origins = LEAD_ORIGINS.filter((origin) => origin.key !== "other" || segments.origin.some((segment) => segment.key === "other"));
  const max = Math.max(1, ...segments.origin_shift.map((segment) => segment.total));
  // What Turno 1 left for Turno 2: arrived in Turno 1, not handed out before it ended.
  const first = shiftTotals.get(1);
  const leftover = first ? first.total - first.assignedInShift : 0;
  const leftoverTakenLater = first?.assignedAfterShift ?? 0;
  const flow = (shiftKey: number): Array<[string, string]> => {
    const total = shiftTotals.get(shiftKey);
    const arrived = total?.total ?? 0;
    const inShift = total?.assignedInShift ?? 0;
    if (shiftKey === 1) {
      return [
        ["Entraram no turno", numberLabel(arrived)],
        ["Distribuídos no turno", `${numberLabel(inShift)} (${percentLabel(arrived ? (inShift / arrived) * 100 : 0)})`],
        ["Sobraram para o Turno 2", `${numberLabel(leftover)}`],
      ];
    }
    const toHandle = arrived + leftover;
    const handled = inShift + leftoverTakenLater;
    return [
      ["Entraram no turno", numberLabel(arrived)],
      ["+ Sobras do Turno 1", numberLabel(leftover)],
      ["Total para distribuir", numberLabel(toHandle)],
      ["Distribuídos", `${numberLabel(handled)} (${numberLabel(inShift)} do turno + ${numberLabel(leftoverTakenLater)} das sobras)`],
      ["Não distribuídos no turno", numberLabel(Math.max(0, toHandle - handled))],
    ];
  };

  const rows: LeadQualitySegment[] = [];
  for (const shift of LEAD_SHIFTS) {
    for (const origin of origins) {
      const segment = byOriginShift.get(`${origin.key}:${shift.key}`);
      if (segment) rows.push(segment);
    }
    const total = shiftTotals.get(shift.key);
    if (total) rows.push({ ...total, label: `Total · ${shift.label}` });
  }

  return (
    <View>
      <View wrap={false}>
        <SectionTitle title="Por turno" description="Turno 1: das 19h do dia anterior às 13h30 · Turno 2: das 13h30 às 19h. O turno é o de entrada do lead. Distribuídos no turno: atribuídos a um corretor até o fim desse turno (pela atribuição mais recente; um lead redistribuído depois conta como fora)." />
        <Row>
          {LEAD_SHIFTS.map((shift) => {
            const total = shiftTotals.get(shift.key);
            return (
              <View key={shift.key} style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, gap: 7 }}>
                <Row style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
                  <View style={{ gap: 1 }}>
                    <Span style={{ fontSize: 9, fontWeight: 600, color: C.foreground }}>{shift.label}</Span>
                    <Span style={{ fontSize: 7.5, color: C.mutedForeground }}>{shift.hours}</Span>
                  </View>
                  <Span style={{ fontSize: 18, fontWeight: 600, color: C.accent }}>{numberLabel(total?.total ?? 0)}</Span>
                </Row>
                <View style={{ gap: 2, paddingVertical: 4, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border }}>
                  {flow(shift.key).map(([label, value]) => (
                    <Row key={label} style={{ justifyContent: "space-between" }}>
                      <Span style={{ fontSize: 8, color: C.mutedForeground }}>{label}</Span>
                      <Span style={{ fontSize: 8, fontWeight: 600, color: C.foreground }}>{value}</Span>
                    </Row>
                  ))}
                </View>
                {origins.map((origin) => {
                  const segment = byOriginShift.get(`${origin.key}:${shift.key}`);
                  const count = segment?.total ?? 0;
                  return (
                    <View key={origin.key} style={{ gap: 3 }}>
                      <Row style={{ justifyContent: "space-between" }}>
                        <Span style={{ fontSize: 8, color: C.mutedForeground }}>{origin.label}</Span>
                        <Span style={{ fontSize: 8, fontWeight: 600, color: C.foreground }}>{`${numberLabel(count)} · ${segment ? percentLabel(segment.hotWarmShare) : "—"} Q+M`}</Span>
                      </Row>
                      <Bar share={(count / max) * 100} height={5} />
                    </View>
                  );
                })}
              </View>
            );
          })}
        </Row>
      </View>
      {rows.length ? (
        <View style={{ marginTop: 10 }}>
          <DataTable size="compact" stripe columns={segmentColumns("Origem · turno")} data={rows.map((row) => segmentRow(row, row.label))} />
        </View>
      ) : null}
    </View>
  );
}

type LeadRow = { createdAt: string; name: string; origin: string; shift: string; queue: string; broker: string; temperature: string; status: string };

function LeadList({ input }: { input: LeadQualityPdfInput }) {
  if (!input.leads.length) return null;
  const columns: DataTableColumn<LeadRow>[] = [
    { key: "createdAt", header: "Recebido", width: "12.5%" },
    { key: "name", header: "Lead", width: "19.5%" },
    { key: "origin", header: "Origem", width: "10%" },
    { key: "shift", header: "Turno", width: "6%" },
    { key: "queue", header: "Fila", width: "15%" },
    { key: "broker", header: "Corretor", width: "15%" },
    { key: "temperature", header: "Temp.", width: "9%" },
    { key: "status", header: "Etapa", width: "13%" },
  ];
  return (
    <View break>
      <SectionTitle
        title="Leads do período"
        description={`T1 = Turno 1 (19h–13h30) · T2 = Turno 2 (13h30–19h). ` + (input.leadsTruncated ? `Os ${numberLabel(input.leads.length)} mais recentes; a planilha traz o mesmo recorte.` : `${numberLabel(input.leads.length)} leads, do mais recente ao mais antigo.`)}
      />
      <DataTable
        size="compact"
        stripe
        columns={columns}
        data={input.leads.map((lead) => ({
          createdAt: shortDateTimeLabel(lead.createdAt),
          name: lead.name,
          origin: originLabel(lead.origin),
          shift: `T${lead.shift}`,
          queue: lead.queueName ?? "—",
          broker: lead.brokerName ?? "Sem corretor",
          temperature: temperatureLabel(lead.qualificationStatus, true),
          status: leadStatusLabel(lead.status),
        }))}
      />
    </View>
  );
}

type SimpleQueueRow = { queue: string; arrived: string; good: string; weak: string; distributed: string; distributedWeak: string; ranOut: string };
type SimpleHourRow = { label: string; arrivedGood: string; arrivedWeak: string; sentGood: string; sentWeak: string; waiting: string };
const pctOf = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)}%` : "0%");

/** The simple report: the four answers the owner needs, in plain numbers. */
function SimpleBody({ simple, queueName }: { simple: SimpleLeadQualityReportData; queueName: string | null }) {
  const arrivedWeak = simple.arrived.cold + simple.arrived.noReply;
  const sentWeak = simple.distributed.cold + simple.distributed.noReply;
  const runOuts = simple.byQueue.filter((queue) => queue.goodRanOut);
  const inversions = simple.byQueue.filter((queue) => queue.weakWhileGoodWaiting > 0);
  const timeline = simple.hourly === "timeline";
  const queueColumns: DataTableColumn<SimpleQueueRow>[] = [
    { key: "queue", header: "Fila", width: "28%" },
    { key: "arrived", header: "Entraram", align: "right", width: "11%" },
    { key: "good", header: "Bons", align: "right", width: "13%" },
    { key: "weak", header: "Frios", align: "right", width: "10%" },
    { key: "distributed", header: "Distribuídos", align: "right", width: "13%" },
    { key: "distributedWeak", header: "Frios distrib.", align: "right", width: "12%" },
    { key: "ranOut", header: "Bons acabaram", align: "right", width: "13%" },
  ];
  const hourColumns: DataTableColumn<SimpleHourRow>[] = [
    { key: "label", header: "Hora", width: "20%" },
    { key: "arrivedGood", header: "Entraram bons", align: "right", width: "16%" },
    { key: "arrivedWeak", header: "Entraram frios", align: "right", width: "16%" },
    { key: "sentGood", header: "Foram bons", align: "right", width: "16%" },
    { key: "sentWeak", header: "Foram frios", align: "right", width: "16%" },
    ...(timeline ? [{ key: "waiting" as const, header: "Bons esperando", align: "right" as const, width: "16%" }] : []),
  ];
  return (
    <View>
      {simple.truncated ? <Text variant="xs" color="mutedForeground" style={{ marginTop: 8 }}>Período muito longo: o relatório usa só os leads mais recentes. Escolha um intervalo menor para ver tudo.</Text> : null}
      <SectionTitle title="1. Quantos leads entraram e quantos são bons" description="Bom = quente ou morno validado. Lead de WhatsApp só conta como bom se o cliente respondeu a qualificação." />
      <Row>
        <Tile label="Entraram" value={numberLabel(simple.arrived.total)} detail={queueName ? `Fila ${queueName}` : "Todas as filas"} highlight />
        <Tile label="Bons (quentes + mornos)" value={numberLabel(simple.arrived.good)} detail={`${pctOf(simple.arrived.good, simple.arrived.total)} do que entrou`} />
        <Tile label="Frios" value={numberLabel(arrivedWeak)} detail={`${numberLabel(simple.arrived.cold)} frios + ${numberLabel(simple.arrived.noReply)} sem resposta no WhatsApp`} />
        <Tile label="Descartados ou em qualificação" value={numberLabel(simple.arrived.other)} detail={pctOf(simple.arrived.other, simple.arrived.total)} />
      </Row>

      <SectionTitle title="2. Por fila" />
      <DataTable size="compact" stripe columns={queueColumns} data={simple.byQueue.map((queue) => ({
        queue: queue.queue, arrived: numberLabel(queue.arrived), good: `${numberLabel(queue.good)} (${pctOf(queue.good, queue.arrived)})`, weak: numberLabel(queue.weak),
        distributed: numberLabel(queue.distributed), distributedWeak: numberLabel(queue.distributedWeak), ranOut: timeline ? queue.goodRanOut ?? "Não acabaram" : "—",
      }))} />

      <View wrap={false}>
        <SectionTitle
          title="3. Hora a hora: quando os bons acabaram"
          description={timeline
            ? runOuts.length ? `${runOuts.map((queue) => `${queue.queue}: às ${queue.goodRanOut}`).join(" · ")}. Dali em diante só havia frios para entregar.` : "Em nenhuma hora os bons acabaram: sempre havia lead bom qualificado esperando."
            : "Período longo: cada linha soma a mesma hora de todos os dias."}
        />
        <DataTable size="compact" stripe columns={hourColumns} data={simple.hours.map((hour) => ({
          label: hour.label, arrivedGood: numberLabel(hour.arrived.good), arrivedWeak: numberLabel(hour.arrived.cold + hour.arrived.noReply),
          sentGood: numberLabel(hour.distributed.good), sentWeak: numberLabel(hour.distributed.cold + hour.distributed.noReply),
          waiting: hour.goodWaiting === 0 ? "0 · acabaram" : numberLabel(hour.goodWaiting ?? 0),
        }))} />
        {inversions.length ? (
          <Text variant="xs" color="mutedForeground" style={{ marginTop: 6 }}>
            {`Atenção: ${inversions.map((queue) => `${queue.queue} mandou ${numberLabel(queue.weakWhileGoodWaiting)} frios com lead bom esperando na mesma fila`).join(" · ")}. Aqui não faltou lead bom.`}
          </Text>
        ) : null}
      </View>

      <View wrap={false}>
        <SectionTitle title="4. E se não mandasse os frios? (estimativa)" description="Estimativa: tira os frios do que foi entregue e supõe que os bons seriam entregues igual." />
        <Row>
          <Tile label="Foram para os corretores" value={numberLabel(simple.distributed.total)} detail={`${numberLabel(simple.distributed.good)} bons + ${numberLabel(sentWeak)} frios · ${numberLabel(simple.brokers)} corretores`} highlight />
          <Tile label="Sem os frios seriam (estimativa)" value={numberLabel(simple.withoutWeak.distributed)} detail={`${numberLabel(simple.withoutWeak.removed)} leads a menos (${simple.withoutWeak.removedShare.toLocaleString("pt-BR")}%)`} />
          <Tile label="Média por corretor" value={`${simple.withoutWeak.perBrokerNow?.toLocaleString("pt-BR") ?? "—"} → ${simple.withoutWeak.perBrokerWithout?.toLocaleString("pt-BR") ?? "—"}`} detail="Hoje → sem os frios" />
        </Row>
        <Row style={{ marginTop: 8 }}>
          {simple.shifts.map((shift) => (
            <Tile key={shift.key} label={shift.label} value={`${numberLabel(shift.distributedGood + shift.distributedWeak)} → ${numberLabel(shift.distributedGood)}`} detail={`${numberLabel(shift.distributedGood)} bons + ${numberLabel(shift.distributedWeak)} frios; sem os frios, só os bons`} />
          ))}
        </Row>
        <Text variant="xs" color="mutedForeground" style={{ marginTop: 6 }}>{`Vendas vindas de leads frios no período: ${numberLabel(simple.converted.weak)} · de leads bons: ${numberLabel(simple.converted.good)}.`}</Text>
      </View>
    </View>
  );
}

function LeadQualityReportDocument({ input }: { input: LeadQualityPdfInput }) {
  const { segments } = input.report;
  const topHours = [...segments.hour].sort((a, b) => b.total - a.total).slice(0, 10);
  return (
    <Document title="Relatório de qualidade de leads">
      <Page size="A4">
        <PdfcnThemeProvider theme={ancoraPdfTheme}>
          <View style={{ fontFamily: "Inter", color: C.foreground }}>
            <Cover input={input} />
            {input.simple ? (
              <SimpleBody simple={input.simple} queueName={input.queueName} />
            ) : input.report.summary.total === 0 ? (
              <View style={{ marginTop: 24, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 16 }}>
                <Span style={{ fontSize: 10, color: C.mutedForeground }}>Nenhum lead nesta seleção.</Span>
              </View>
            ) : (
              <View>
                <SummaryTiles input={input} />
                <TemperatureBlock input={input} />
                <OriginCards input={input} />
                <ShiftBlock input={input} />
                <SegmentSection title="Canais de entrada" description="Canal registrado no momento da captura." rows={segments.source} first="Canal" label={(row) => sourceLabel(row.key)} />
                <SegmentSection title="Campanhas" description="Qualidade por campanha identificada na Meta." rows={segments.campaign} first="Campanha" />
                <SegmentSection title="Conjuntos de anúncios" description="Padrões por público/conjunto registrado na Meta." rows={segments.adset} first="Conjunto" />
                <SegmentSection title="Anúncios" description="Anúncios com maior volume." rows={segments.ad} first="Anúncio" />
                <SegmentSection title="Formulários" description="Leads atribuídos a formulários identificados." rows={segments.form} first="Formulário" />
                <SegmentSection title="Filas" description="Fila responsável hoje." rows={segments.queue} first="Fila" />
                <SegmentSection title="Corretores" description="Carteira atual; não representa histórico de transferência." rows={segments.broker} first="Corretor" />
                <SegmentSection title="Tipo de lead" description="Perfil comercial registrado na qualificação." rows={segments.lead_type} first="Tipo" />
                <SegmentSection title="Tipo de plano" description="Individual, familiar ou empresarial informado." rows={segments.plan_type} first="Plano" />
                <SegmentSection title="Cidades" description="Localidade informada pelo lead." rows={segments.city} first="Cidade" />
                <SegmentSection title="Faixa etária" description="Pela idade individual ou média registrada." rows={segments.age_band} first="Faixa" />
                <SegmentSection title="Horários com mais leads" description="Dia da semana e hora de chegada (os 10 com mais leads)." rows={topHours} first="Dia e hora" label={(row) => hourSlotLabel(row.key)} />
                <Text variant="xs" color="mutedForeground" style={{ marginTop: 10 }}>
                  {`Grupos com menos de 3 leads ficam de fora das tabelas de detalhamento. Etapas e conversões refletem o status atual de cada lead.`}
                </Text>
                <LeadList input={input} />
              </View>
            )}
          </View>
        </PdfcnThemeProvider>
      </Page>
    </Document>
  );
}

// ─── Render ───────────────────────────────────────────────────────────────

let fontsPromise: Promise<{ name: string; weight: number; style: "normal"; data: Uint8Array }[]> | null = null;

function loadFonts() {
  fontsPromise ??= Promise.all([400, 500, 600, 700].map(async (weight) => ({
    name: "Inter",
    weight,
    style: "normal" as const,
    data: new Uint8Array(await readFile(path.join(process.cwd(), "src/features/reports/pdf/fonts", `inter-latin-${weight}.woff2`))),
  })));
  return fontsPromise;
}

export async function renderLeadQualityReportPdf(input: LeadQualityPdfInput): Promise<Uint8Array> {
  const band = { fontFamily: "Inter", fontSize: 9, color: C.mutedForeground, display: "flex", width: "100%", justifyContent: "space-between", padding: "0 48px" } as const;
  return render(<LeadQualityReportDocument input={input} />, {
    size: "a4",
    margin: { left: 48, right: 48 },
    fonts: await loadFonts(),
    // Lead names may carry emoji; characters no font covers are left blank.
    uncoveredText: "blank",
    fontFamilies: ["Inter"],
    metadata: { title: "Relatório de qualidade de leads", authors: [input.tenantName], creator: "AncoraHub" },
    footer: (
      <div style={band}>
        <span>{`${input.tenantName} · gerado em ${dateTimeLabel(input.generatedAt)}`}</span>
        <span>Página <PageNumber /> de <TotalPages /></span>
      </div>
    ),
  } as Parameters<typeof render>[1]);
}
