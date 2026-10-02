import * as XLSX from "xlsx";

import { LEAD_ORIGINS } from "../metrics/lead-quality-contract";
import type { LeadQualityExport } from "../metrics/lead-quality-export";
import { LEAD_SHIFTS, leadQualityPeriodLabel, leadQualityWindowLabel } from "../metrics/lead-quality-period";
import type { LeadQualitySegment } from "../metrics/lead-quality-service";
import { dateTimeLabel, hourSlotLabel, leadStatusLabel, originLabel, sourceLabel, temperatureLabel } from "./lead-quality-report-labels";

/** Cells starting with = + - @ would run as formulas in Excel. */
function safeCell(value: unknown) {
  if (typeof value === "number") return value;
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

const SEGMENT_HEADER = ["Leads", "Quentes", "Mornos", "Frios", "Sem classificação", "Quentes + mornos (%)", "Distribuídos", "Convertidos", "Conversão (%)", "1º contato médio (min)"];

function segmentValues(segment: LeadQualitySegment) {
  return [
    segment.total, segment.hot, segment.warm, segment.cold, segment.unclassified,
    Number(segment.hotWarmShare.toFixed(1)), segment.assigned, segment.converted, Number(segment.conversionRate.toFixed(1)),
    segment.averageFirstContactSeconds == null ? "" : Math.round(segment.averageFirstContactSeconds / 60),
  ];
}

function sheet(rows: Array<Array<string | number>>, widths: number[]) {
  const result = XLSX.utils.aoa_to_sheet(rows.map((row) => row.map(safeCell)));
  result["!cols"] = widths.map((wch) => ({ wch }));
  return result;
}

export function encodeLeadQualitySpreadsheet(input: LeadQualityExport & { tenantName: string; generatedAt: Date; originLabelFilter: string }) {
  const { report } = input;
  const window = { since: new Date(report.window.since), until: report.window.until ? new Date(report.window.until) : null };
  const s = report.summary;
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, sheet([
    ["Relatório de qualidade de leads", input.tenantName],
    ["Período", leadQualityPeriodLabel(report.period)],
    ["Janela", `${leadQualityWindowLabel(window, input.generatedAt)} (horário de Brasília)`],
    ["Fila", input.queueName ?? "Todas as filas"],
    ["Origem", input.originLabelFilter],
    ["Turnos", "Turno 1: 18h–13h30 · Turno 2: 13h30–18h"],
    ["Gerado em", dateTimeLabel(input.generatedAt)],
    [],
    ["Indicador", "Valor"],
    ["Leads recebidos", s.total],
    ["Quentes", s.hot],
    ["Mornos", s.warm],
    ["Frios", s.cold],
    ["Sem classificação", s.unclassified],
    ["Quentes + mornos (%)", Number(s.hotWarmShare.toFixed(1))],
    ["Distribuídos", s.assigned],
    ["Distribuídos (%)", Number(s.assignedRate.toFixed(1))],
    ["Convertidos", s.converted],
    ["Conversão (%)", Number(s.conversionRate.toFixed(1))],
    ["Conversão de quentes + mornos (%)", Number(s.hotWarmConversionRate.toFixed(1))],
    ["1º contato médio (min)", s.averageFirstContactSeconds == null ? "" : Math.round(s.averageFirstContactSeconds / 60)],
    ["Cobertura da classificação (%)", Number(s.classificationCoverage.toFixed(1))],
    ["Atribuição a anúncio (%)", Number(s.metaAdAttributionCoverage.toFixed(1))],
  ], [34, 48]), "Resumo");

  // Origin × shift, with each shift's and each origin's totals.
  const byKey = new Map(report.segments.origin_shift.map((segment) => [segment.key, segment]));
  const shiftRows: Array<Array<string | number>> = [["Turno", "Origem", ...SEGMENT_HEADER]];
  for (const shift of LEAD_SHIFTS) {
    for (const origin of LEAD_ORIGINS) {
      const segment = byKey.get(`${origin.key}:${shift.key}`);
      if (segment) shiftRows.push([`${shift.label} (${shift.hours})`, origin.label, ...segmentValues(segment)]);
    }
    const total = report.segments.shift.find((segment) => segment.key === String(shift.key));
    if (total) shiftRows.push([`${shift.label} (${shift.hours})`, "Total do turno", ...segmentValues(total)]);
  }
  shiftRows.push([]);
  shiftRows.push(["Origem", "", ...SEGMENT_HEADER]);
  for (const segment of report.segments.origin) shiftRows.push([originLabel(segment.key as never), "", ...segmentValues(segment)]);
  XLSX.utils.book_append_sheet(workbook, sheet(shiftRows, [24, 16, 8, 9, 9, 8, 16, 18, 13, 12, 13, 20]), "Origem e turno");

  const detail: Array<[string, LeadQualitySegment[], (segment: LeadQualitySegment) => string]> = [
    ["Canal de entrada", report.segments.source, (segment) => sourceLabel(segment.key)],
    ["Campanha", report.segments.campaign, (segment) => segment.label],
    ["Conjunto de anúncios", report.segments.adset, (segment) => segment.label],
    ["Anúncio", report.segments.ad, (segment) => segment.label],
    ["Formulário", report.segments.form, (segment) => segment.label],
    ["Fila", report.segments.queue, (segment) => segment.label],
    ["Corretor", report.segments.broker, (segment) => segment.label],
    ["Tipo de lead", report.segments.lead_type, (segment) => segment.label],
    ["Tipo de plano", report.segments.plan_type, (segment) => segment.label],
    ["Cidade", report.segments.city, (segment) => segment.label],
    ["Faixa etária", report.segments.age_band, (segment) => segment.label],
    ["Dia e hora", report.segments.hour, (segment) => hourSlotLabel(segment.key)],
  ];
  const detailRows: Array<Array<string | number>> = [["Recorte", "Segmento", ...SEGMENT_HEADER]];
  for (const [title, rows, label] of detail) for (const segment of rows) detailRows.push([title, label(segment), ...segmentValues(segment)]);
  XLSX.utils.book_append_sheet(workbook, sheet(detailRows, [20, 36, 8, 9, 9, 8, 16, 18, 13, 12, 13, 20]), "Detalhamento");

  const leadRows: Array<Array<string | number>> = [["Recebido em", "Lead", "Origem", "Turno", "Fila", "Corretor", "Temperatura", "Etapa", "Campanha", "Cidade", "Plano"]];
  for (const lead of input.leads) {
    leadRows.push([
      dateTimeLabel(lead.createdAt), lead.name, originLabel(lead.origin), `Turno ${lead.shift}`, lead.queueName ?? "", lead.brokerName ?? "Sem corretor",
      temperatureLabel(lead.qualificationStatus), leadStatusLabel(lead.status), lead.sourceCampaign ?? "", lead.city ?? "", lead.planType ?? "",
    ]);
  }
  const leadsSheet = sheet(leadRows, [16, 30, 12, 9, 22, 24, 16, 20, 28, 18, 16]);
  leadsSheet["!autofilter"] = { ref: `A1:K${Math.max(leadRows.length, 1)}` };
  XLSX.utils.book_append_sheet(workbook, leadsSheet, "Leads");

  return new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx" }));
}
