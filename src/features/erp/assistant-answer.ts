import "server-only";
import { ANALYTICS_METRICS, getProductionReport } from "./analytics";
import { formatDateTime, isPartialMonth, monthLabel } from "./analytics-core";
import { formatCents } from "./contracts";
import { parseMetricIntent } from "./assistant-intent";

/**
 * Answers a recognized metric question from the registered catalog, under the asker's own session scope.
 * The model never sees the data and no SQL is built from the text; unrecognized or unauthorized → null.
 */
export async function answerIfErpMetricQuestion(question: string): Promise<string | null> {
  const intent = parseMetricIntent(question);
  if (!intent) return null;
  let report: Awaited<ReturnType<typeof getProductionReport>>;
  try { report = await getProductionReport({ from: intent.month, to: intent.month }); } catch { return null; }
  const row = report.rows.find((item) => item.month === intent.month);
  const definition = ANALYTICS_METRICS[intent.metric];
  const period = `${monthLabel(intent.month)}${isPartialMonth(intent.month) ? " (mês em andamento)" : ""}`;
  let value: string;
  if (intent.metric === "production_count") value = `${row?.count ?? 0} venda(s)`;
  else if (intent.metric === "cancelled_count") value = `${row?.cancelled ?? 0} venda(s) cancelada(s)`;
  else if (intent.metric === "implanted_count") value = `${row?.implanted ?? 0} implantação(ões)`;
  else if (intent.metric === "production_value") { if (row?.cents === null || row?.cents === undefined) return "Seu perfil não tem acesso a valores de vendas neste escopo. Posso informar a quantidade de vendas."; value = formatCents(row.cents); }
  else { if (row?.cash === null || row?.cash === undefined) return "Valores recebidos pela corretora só aparecem para quem tem delegação financeira da unidade ou da empresa."; value = formatCents(row.cash); }
  const lines = [`${definition.label} em ${period}: ${value}.`, `Como é calculado: ${definition.description} Base de data: ${definition.dateBasis}.`, `Atualizado em ${formatDateTime(report.generatedAt)}, dentro do seu escopo de acesso. Detalhes em /relatorios/producao.`];
  if (intent.ambiguous === "confirmed") lines.unshift("\"Confirmada\" pode significar venda registrada, implantação comprovada ou pagamento recebido. Mostro as vendas registradas; pergunte por implantações ou recebimentos para os outros fatos.");
  return lines.join("\n\n");
}
