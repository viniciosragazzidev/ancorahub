/**
 * Frases do topo das abas Qualidade e Funil (abaixo da saudação, como no artifact de 27/11/2026). Arquivo comum,
 * sem "use client", para a página do servidor montar a frase.
 */
import type { SimpleLeadQualityReportData } from "@/features/reports/metrics/lead-quality-service";
import type { QualificationFunnel } from "@/features/qualification-turbo/funnel";

import { n, plural, ranOutLabel } from "./format";

/** "Fila PME", sem repetir quando o nome da fila já começa com "Fila". */
export function queueWords(name: string) {
  return /^fila\s/i.test(name.trim()) ? name.trim() : `Fila ${name.trim()}`;
}

export function qualityHeadline(report: SimpleLeadQualityReportData, periodText: string) {
  if (!report.arrived.total) return null;
  const first = report.byQueue.find((queue) => queue.goodRanOut);
  const base = `${periodText} entraram ${plural(report.arrived.total, "lead", "leads")}, ${n(report.arrived.good)} ${report.arrived.good === 1 ? "bom" : "bons"}.`;
  return first ? `${base} Na ${queueWords(first.queue).replace(/^Fila/, "fila")} os bons acabaram às ${ranOutLabel(first.goodRanOut ?? "", report.period)}.` : base;
}

export function funnelHeadline(data: QualificationFunnel, periodText: string) {
  const byKey = new Map(data.stages.map((stage) => [stage.key, stage.count]));
  const arrived = byKey.get("arrived") ?? 0;
  if (!arrived) return null;
  const converted = byKey.get("converted") ?? 0;
  return `${periodText} chegaram ${plural(arrived, "lead", "leads")} e ${converted === 1 ? "1 virou venda" : `${n(converted)} viraram venda`}.`;
}

