/**
 * Foto diária do Fechamento (09/11, diretor: "guarda a foto diária do fechamento"). Uma linha por empresa e dia de
 * São Paulo em `negotiation_daily_snapshots`, gravada pelo job `/api/internal/jobs/negotiation-snapshot` às 23:55.
 * Aqui ficam só as partes puras: montar a foto, ler o jsonb de volta e comparar dois dias. Sem I/O.
 * Plano: docs/implementations/active/2026-11-09-fechamento-ate-negativa.md
 */
import type { NegotiationLead, NegotiationsDashboardData } from "./queries";

export type ClosingSnapshotLead = {
  leadId: string;
  name: string;
  brokerId: string;
  brokerName: string;
  /** Unidade do lead na hora da foto: deixa o diretor filtrar a faixa pela unidade escolhida. */
  branchId: string | null;
  status: string;
  daysAtStage: number | null;
};

export type NegotiationSnapshotCounts = NegotiationsDashboardData["counts"];

export type NegotiationSnapshot = {
  day: string;
  counts: NegotiationSnapshotCounts;
  closingLeads: ClosingSnapshotLead[];
};

const TIME_ZONE = "America/Sao_Paulo";

/** Dia do calendário de São Paulo (YYYY-MM-DD). O job das 23:55 de SP roda 02:55 UTC do dia seguinte. */
export function negotiationSnapshotDay(now: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

type ClosingSource = Pick<NegotiationLead, "id" | "name" | "brokerId" | "brokerName" | "branchId" | "status" | "daysAtStage" | "level">;

/** Os leads em Fechamento, em ordem de nome (a foto é para comparar, não para priorizar). */
export function shapeClosingLeads(leads: readonly ClosingSource[]): ClosingSnapshotLead[] {
  return leads
    .filter((lead) => lead.level === "closing")
    .map((lead) => ({
      leadId: lead.id,
      name: lead.name,
      brokerId: lead.brokerId,
      brokerName: lead.brokerName,
      branchId: lead.branchId,
      status: lead.status,
      daysAtStage: lead.daysAtStage,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR") || left.leadId.localeCompare(right.leadId));
}

export function buildNegotiationSnapshot(data: Pick<NegotiationsDashboardData, "counts" | "leads">, now: Date): NegotiationSnapshot {
  return { day: negotiationSnapshotDay(now), counts: { ...data.counts }, closingLeads: shapeClosingLeads(data.leads) };
}

/** Lê o jsonb gravado, descartando entradas quebradas (a foto nunca pode derrubar a página). */
export function parseClosingLeads(value: unknown): ClosingSnapshotLead[] {
  if (!Array.isArray(value)) return [];
  const leads: ClosingSnapshotLead[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    if (typeof raw.leadId !== "string" || !raw.leadId) continue;
    leads.push({
      leadId: raw.leadId,
      name: typeof raw.name === "string" && raw.name ? raw.name : "Cliente",
      brokerId: typeof raw.brokerId === "string" ? raw.brokerId : "",
      brokerName: typeof raw.brokerName === "string" && raw.brokerName ? raw.brokerName : "Corretor",
      branchId: typeof raw.branchId === "string" ? raw.branchId : null,
      status: typeof raw.status === "string" ? raw.status : "",
      daysAtStage: typeof raw.daysAtStage === "number" && Number.isFinite(raw.daysAtStage) ? raw.daysAtStage : null,
    });
  }
  return leads;
}

/** Quem entrou e quem saiu do Fechamento entre duas fotos (ou entre a última foto e a lista de agora). */
export function diffClosingLeads(previous: readonly ClosingSnapshotLead[], current: readonly ClosingSnapshotLead[]) {
  const before = new Set(previous.map((lead) => lead.leadId));
  const after = new Set(current.map((lead) => lead.leadId));
  return {
    entered: current.filter((lead) => !before.has(lead.leadId)),
    left: previous.filter((lead) => !after.has(lead.leadId)),
  };
}

/** Uma foto lida do banco, como a tela usa. */
export type NegotiationSnapshotHistoryRow = { day: string; closingLeads: ClosingSnapshotLead[] };

export type ClosingHistoryDay = { day: string; count: number };

export type ClosingHistoryView = {
  /** Até 7 fotos, do dia mais antigo para o mais recente. */
  days: ClosingHistoryDay[];
  /** Foto usada na comparação: a mais recente de um dia anterior a hoje. */
  baselineDay: string | null;
  entered: ClosingSnapshotLead[];
  left: ClosingSnapshotLead[];
};

/**
 * Monta a faixa do diretor: contagem por dia das últimas 7 fotos e, contra a foto mais recente de antes de hoje,
 * quem entrou e quem saiu do Fechamento até agora. `branchId` filtra pela unidade escolhida na tela.
 */
export function buildClosingHistoryView(input: {
  snapshots: ReadonlyArray<{ day: string; closingLeads: readonly ClosingSnapshotLead[] }>;
  liveClosing: readonly ClosingSnapshotLead[];
  now: Date;
  branchId?: string | null;
  maxDays?: number;
}): ClosingHistoryView {
  const inBranch = (lead: ClosingSnapshotLead) => !input.branchId || lead.branchId === input.branchId;
  const ordered = [...input.snapshots].sort((left, right) => left.day.localeCompare(right.day));
  const recent = ordered.slice(-(input.maxDays ?? 7));
  const today = negotiationSnapshotDay(input.now);
  const baseline = [...ordered].reverse().find((snapshot) => snapshot.day < today) ?? null;
  const diff = baseline ? diffClosingLeads(baseline.closingLeads.filter(inBranch), input.liveClosing.filter(inBranch)) : { entered: [], left: [] };
  return {
    days: recent.map((snapshot) => ({ day: snapshot.day, count: snapshot.closingLeads.filter(inBranch).length })),
    baselineDay: baseline?.day ?? null,
    entered: diff.entered,
    left: diff.left,
  };
}
