import { z } from "zod";

export const INCENTIVE_METRICS = ["sales_count", "sales_value_cents", "implanted_count"] as const;
export type IncentiveMetric = (typeof INCENTIVE_METRICS)[number];
export const INCENTIVE_METRIC_LABELS: Record<IncentiveMetric, string> = {
  sales_count: "Quantidade de vendas", sales_value_cents: "Valor vendido", implanted_count: "Implantações confirmadas",
};
export const INCENTIVE_STATUSES = ["draft", "approved", "closed", "cancelled"] as const;
export type IncentiveStatus = (typeof INCENTIVE_STATUSES)[number];
export const INCENTIVE_STATUS_LABELS: Record<IncentiveStatus, string> = { draft: "Rascunho", approved: "Aprovada", closed: "Encerrada", cancelled: "Cancelada" };
export const INCENTIVE_TIME_ZONE = "America/Sao_Paulo";

const isoDate = z.iso.date("Informe uma data válida.");
export const incentiveCampaignInputSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome da campanha.").max(120),
  regulation: z.string().trim().min(20, "Descreva o regulamento com pelo menos 20 caracteres.").max(10_000),
  metric: z.enum(INCENTIVE_METRICS, "Selecione a métrica."),
  startsOn: isoDate, endsOn: isoDate,
  branchIds: z.array(z.string().trim().min(1).max(100)).max(100).transform((ids) => [...new Set(ids)].sort()),
  prize: z.string().trim().max(500).default(""),
  showNames: z.boolean(),
}).strict().refine((input) => input.endsOn >= input.startsOn, { message: "O fim precisa ser igual ou posterior ao início.", path: ["endsOn"] });
export type IncentiveCampaignInput = z.infer<typeof incentiveCampaignInputSchema>;

/** One eligible fact: a sale or a confirmed implantation, already filtered by period, branch and status. */
export type IncentiveFact = { id: string; brokerId: string; branchId: string | null; at: string; value: number };
export type IncentiveRankingRow = { position: number; brokerId: string; branchId: string | null; value: number; lastFactAt: string; facts: string[] };

const compareText = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

/** Higher value first; ties go to whoever reached it earlier (earlier last qualifying fact); then broker id. */
export function rankIncentiveFacts(facts: readonly IncentiveFact[]): IncentiveRankingRow[] {
  const byBroker = new Map<string, { value: number; facts: IncentiveFact[] }>();
  for (const fact of facts) {
    if (!Number.isSafeInteger(fact.value) || fact.value < 0) throw new Error("Valor de fato inválido para apuração.");
    const current = byBroker.get(fact.brokerId) ?? { value: 0, facts: [] };
    current.value += fact.value;
    if (!Number.isSafeInteger(current.value)) throw new Error("Total excede o limite de apuração.");
    current.facts.push(fact);
    byBroker.set(fact.brokerId, current);
  }
  const rows = [...byBroker.entries()].map(([brokerId, entry]) => {
    const ordered = [...entry.facts].sort((left, right) => compareText(left.at, right.at) || compareText(left.id, right.id));
    const last = ordered[ordered.length - 1];
    return { brokerId, branchId: last.branchId, value: entry.value, lastFactAt: last.at, facts: ordered.map((fact) => fact.id).sort(compareText) };
  });
  rows.sort((left, right) => (right.value - left.value) || compareText(left.lastFactAt, right.lastFactAt) || compareText(left.brokerId, right.brokerId));
  return rows.map((row, index) => ({ position: index + 1, ...row }));
}

export type IncentiveSnapshot = {
  version: 1; campaignId: string; campaignVersion: number; metric: IncentiveMetric;
  period: { startsOn: string; endsOn: string; timeZone: string }; branchIds: string[];
  rows: IncentiveRankingRow[]; calculatedAt: string;
};
export const incentiveSnapshotSchema = z.object({
  version: z.literal(1), campaignId: z.string(), campaignVersion: z.number().int(), metric: z.enum(INCENTIVE_METRICS),
  period: z.object({ startsOn: z.string(), endsOn: z.string(), timeZone: z.string() }), branchIds: z.array(z.string()),
  rows: z.array(z.object({ position: z.number().int(), brokerId: z.string(), branchId: z.string().nullable(), value: z.number().int(), lastFactAt: z.string(), facts: z.array(z.string()) })),
  calculatedAt: z.string(),
});

/** Stable JSON: object keys sorted recursively; arrays keep their (already deterministic) order. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([left], [right]) => compareText(left, right));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
}

/** The digest covers everything that defines the result except when it was calculated. */
export function incentiveDigestInput(snapshot: IncentiveSnapshot): string {
  const { calculatedAt: _calculatedAt, ...stable } = snapshot;
  void _calculatedAt;
  return canonicalJson({ ...stable, branchIds: [...stable.branchIds].sort(compareText) });
}

export function todayInSaoPaulo(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: INCENTIVE_TIME_ZONE }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export type RankingViewer = { userId: string; showNames: boolean; metric: IncentiveMetric; canSeeValue: (row: IncentiveRankingRow) => boolean; names: ReadonlyMap<string, string> };
export type VisibleRankingRow = { position: number; label: string; isViewer: boolean; value: number | null };

/** Exposure policy: names only when the campaign allows it; money of colleagues only for whom the viewer may see. */
export function visibleRanking(rows: readonly IncentiveRankingRow[], viewer: RankingViewer): VisibleRankingRow[] {
  return rows.map((row) => {
    const isViewer = row.brokerId === viewer.userId;
    const name = viewer.showNames ? viewer.names.get(row.brokerId) ?? `Corretor ${row.position}` : `Corretor ${row.position}`;
    const label = isViewer ? (viewer.showNames ? `${name} (você)` : "Você") : name;
    const value = viewer.metric !== "sales_value_cents" || isViewer || viewer.canSeeValue(row) ? row.value : null;
    return { position: row.position, label, isViewer, value };
  });
}
