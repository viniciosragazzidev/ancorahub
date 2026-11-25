import { encodeCsvDocument } from "@/features/reports/csv-export";
import { leadStatusLabel, sourceLabel } from "@/features/reports/pdf/lead-quality-report-labels";
import { stripLeadOriginForBroker } from "@/features/leads/broker-visibility";

/**
 * Exportação dos leads selecionados em /leads (ação em lote "Exportar CSV").
 * Só montagem: o servidor busca os leads já dentro do escopo do usuário e passa aqui.
 * CSV no padrão do Excel pt-BR (BOM UTF-8, ";", proteção contra fórmula) via `encodeCsvDocument`.
 */
export const SELECTED_LEAD_EXPORT_COLUMNS = [
  "Nome",
  "Telefone",
  "E-mail",
  "Etapa",
  "Corretor",
  "Fila",
  "Unidade",
  "Origem",
  "Valor mensal",
  "Vidas",
  "Criado em",
  "Última atualização",
] as const;

/** Teto por exportação: a seleção da tela é paginada, isto só barra pedido forjado. */
export const SELECTED_LEAD_EXPORT_LIMIT = 2000;

export type SelectedLeadExportSource = {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  status: string;
  corretorNome: string | null;
  queueName: string | null;
  branchName: string | null;
  origem: string;
  sourceChannel: string | null;
  sourceCampaign: string | null;
  monthlyValue: string | number | null;
  livesCount: number | null;
  createdAt: Date | string;
  assignedAt: Date | string | null;
  updatedAt: Date | string | null;
};

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function dateLabel(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : dateTime.format(date);
}

function moneyLabel(value: string | number | null) {
  if (value == null || value === "") return "";
  const amount = Number(value);
  return Number.isFinite(amount) ? currency.format(amount) : "";
}

/** Remove vazios e repetidos, mantendo a ordem da seleção. */
export function normalizeSelectedLeadIds(ids: readonly unknown[]): string[] {
  const seen = new Set<string>();
  for (const id of ids) {
    if (typeof id !== "string") continue;
    const trimmed = id.trim();
    if (trimmed) seen.add(trimmed);
  }
  return [...seen];
}

export function buildSelectedLeadExportRow(source: SelectedLeadExportSource, viewerRole: string): Record<string, unknown> {
  // Corretor não vê de onde o lead veio nem quando chegou à corretora (mesma regra das telas).
  const lead = viewerRole === "broker" ? stripLeadOriginForBroker(source) : source;
  const channel = lead.sourceChannel || lead.origem;
  const origin = [channel ? sourceLabel(channel) : "", lead.sourceCampaign].filter(Boolean).join(" · ");
  return {
    "Nome": lead.nome,
    "Telefone": lead.telefone,
    "E-mail": lead.email ?? "",
    "Etapa": leadStatusLabel(lead.status),
    "Corretor": lead.corretorNome ?? "",
    "Fila": lead.queueName ?? "",
    "Unidade": lead.branchName ?? "",
    "Origem": origin,
    "Valor mensal": moneyLabel(lead.monthlyValue),
    "Vidas": lead.livesCount ?? "",
    "Criado em": dateLabel(lead.createdAt),
    "Última atualização": dateLabel(lead.updatedAt ?? lead.createdAt),
  };
}

/** Devolve as linhas na ordem em que o usuário selecionou. */
export function buildSelectedLeadsCsv(sources: readonly SelectedLeadExportSource[], requestedIds: readonly string[], viewerRole: string) {
  const position = new Map(requestedIds.map((id, index) => [id, index]));
  const ordered = [...sources].sort((a, b) => (position.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (position.get(b.id) ?? Number.MAX_SAFE_INTEGER));
  const rows = ordered.map((lead) => buildSelectedLeadExportRow(lead, viewerRole));
  return `${encodeCsvDocument(rows, [...SELECTED_LEAD_EXPORT_COLUMNS])}\r\n`;
}

export function buildSelectedLeadsFilename(date = new Date()) {
  const zone = "America/Sao_Paulo";
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date).replace(":", "");
  return `leads-${day}-${time}.csv`;
}

/** Mensagem curta de confirmação, já dizendo o que ficou de fora. */
export function selectedLeadsExportMessage(exported: number, requested: number) {
  const done = exported === 1 ? "1 lead exportado." : `${exported} leads exportados.`;
  const skipped = requested - exported;
  if (skipped <= 0) return done;
  return `${done} ${skipped === 1 ? "1 ficou de fora por não estar" : `${skipped} ficaram de fora por não estarem`} no seu acesso.`;
}
