/**
 * Perfil do cliente do corretor (plano do modo corretor, etapa 5 e leitura da seção 7). Regras puras, sem I/O.
 * Tudo aqui parte de dados que já existem: interações do lead (`lead_interactions`), vendas, contrato ativo
 * (`active_customers`), documentos e a tarefa aberta do corretor. Ausência de dado nunca vira "em dia".
 */

import type { NextActionView } from "@/features/carteira/proxima-acao-core";

export const PROFILE_TABS = ["historico", "sobre", "contratos", "documentos"] as const;
export type ProfileTab = (typeof PROFILE_TABS)[number];

export const TIMELINE_FILTERS = ["tudo", "atendimentos", "observacoes", "contratos", "documentos"] as const;
export type TimelineFilter = (typeof TIMELINE_FILTERS)[number];

/** Tipo de cada registro da linha do tempo. `sistema` são eventos automáticos (etapa, alerta) mostrados discretos. */
export type TimelineKind = "atendimento" | "observacao" | "contrato" | "documento" | "sistema";

export type TimelineEntry = {
  id: string;
  kind: TimelineKind;
  /** Rótulo curto do tipo ("Observação", "Venda registrada"...). */
  label: string;
  content: string | null;
  /** Conversa ou texto longo: o perfil mostra o resumo e abre o restante a pedido. */
  summary: string | null;
  author: string | null;
  at: string;
  /** Registro gerado pelo sistema (etapa, alerta, revisão de documento): aparece em linha discreta. */
  automatic: boolean;
};

export type ProfileInteraction = { id: string; tipo: string; conteudo: string | null; userName: string | null; createdAt: Date | string };
export type ProfileSale = { id: string; planName: string | null; carrierName: string | null; saleValue: string | null; policyNumber: string | null; status: string; saleDate: string | Date | null; brokerName: string | null };
export type ProfileActiveCustomer = {
  status: string;
  coverageStartDate: string | null;
  contractAnniversary: string | null;
  expirationDate: string | null;
  renewalStatus: string;
  cancellationDate: string | null;
  cancellationReason: string | null;
};
export type ProfileDocument = { id: string; filename: string; status: string; requirementName: string | null };

/** Acima disso o conteúdo vira resumo (primeiros caracteres) com "Ver tudo". */
export const LONG_CONTENT_CHARS = 280;
const SUMMARY_CHARS = 200;

const INTERACTION_KIND: Record<string, { kind: TimelineKind; label: string; automatic: boolean }> = {
  note: { kind: "observacao", label: "Observação", automatic: false },
  whatsapp_msg: { kind: "atendimento", label: "Conversa no WhatsApp", automatic: false },
  service_started: { kind: "atendimento", label: "Atendimento iniciado", automatic: true },
  quote_generated: { kind: "atendimento", label: "Cotação", automatic: false },
  document_upload: { kind: "documento", label: "Documento", automatic: true },
  document_review: { kind: "documento", label: "Revisão de documento", automatic: true },
  status_change: { kind: "sistema", label: "Mudança de etapa", automatic: true },
  system_alert: { kind: "sistema", label: "Aviso do sistema", automatic: true },
};

const FILTER_KIND: Record<Exclude<TimelineFilter, "tudo">, TimelineKind> = {
  atendimentos: "atendimento",
  observacoes: "observacao",
  contratos: "contrato",
  documentos: "documento",
};

export function parseProfileTab(raw: unknown): ProfileTab {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (PROFILE_TABS as readonly string[]).includes(String(value)) ? (value as ProfileTab) : "historico";
}

export function parseTimelineFilter(raw: unknown): TimelineFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (TIMELINE_FILTERS as readonly string[]).includes(String(value)) ? (value as TimelineFilter) : "tudo";
}

/** Resumo de texto longo sem cortar palavra no meio. Texto curto devolve `null` (mostra inteiro). */
export function summarizeContent(text: string | null): string | null {
  const clean = text?.trim() ?? "";
  if (clean.length <= LONG_CONTENT_CHARS) return null;
  const cut = clean.slice(0, SUMMARY_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > SUMMARY_CHARS * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function toIso(value: Date | string): string {
  return new Date(value).toISOString();
}

/** Dia guardado como `AAAA-MM-DD` vira meio-dia de São Paulo, para ordenar sem trocar o dia. */
function dayToIso(day: string): string {
  return new Date(`${day}T12:00:00-03:00`).toISOString();
}

function money(value: string | null) {
  if (value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : null;
}

/**
 * Monta a linha do tempo do perfil, mais recente primeiro: interações do lead, vendas e cancelamento do contrato.
 * Documentos entram pelas interações que o próprio upload e a revisão já gravam (sem duplicar a lista).
 */
export function buildProfileTimeline(input: {
  interactions: ProfileInteraction[];
  sales: ProfileSale[];
  activeCustomer: ProfileActiveCustomer | null;
}): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const item of input.interactions) {
    const meta = INTERACTION_KIND[item.tipo] ?? { kind: "sistema" as const, label: "Registro", automatic: true };
    const content = item.conteudo?.trim() || null;
    entries.push({
      id: `i:${item.id}`,
      kind: meta.kind,
      label: meta.label,
      content,
      summary: summarizeContent(content),
      author: item.userName,
      at: toIso(item.createdAt),
      automatic: meta.automatic,
    });
  }

  for (const sale of input.sales) {
    if (!sale.saleDate) continue;
    const product = [sale.carrierName, sale.planName].filter(Boolean).join(" · ");
    const details = [product || null, money(sale.saleValue), sale.policyNumber ? `Apólice ${sale.policyNumber}` : null].filter(Boolean).join(" · ");
    entries.push({
      id: `s:${sale.id}`,
      kind: "contrato",
      label: sale.status === "cancelled" ? "Venda cancelada" : "Venda registrada",
      content: details || null,
      summary: null,
      author: sale.brokerName,
      at: typeof sale.saleDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sale.saleDate) ? dayToIso(sale.saleDate) : toIso(sale.saleDate),
      automatic: false,
    });
  }

  const contract = input.activeCustomer;
  if (contract?.status === "cancelled" && contract.cancellationDate) {
    entries.push({
      id: "c:cancelamento",
      kind: "contrato",
      label: "Contrato cancelado",
      content: contract.cancellationReason?.trim() || null,
      summary: null,
      author: null,
      at: dayToIso(contract.cancellationDate),
      automatic: true,
    });
  }

  return entries.sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
}

/** Filtro da linha do tempo. "Tudo" inclui os eventos automáticos; os demais filtros mostram só o tipo pedido. */
export function filterTimeline(entries: TimelineEntry[], filter: TimelineFilter): TimelineEntry[] {
  if (filter === "tudo") return entries;
  const kind = FILTER_KIND[filter];
  return entries.filter((entry) => entry.kind === kind);
}

export function countByFilter(entries: TimelineEntry[]): Record<TimelineFilter, number> {
  return {
    tudo: entries.length,
    atendimentos: entries.filter((entry) => entry.kind === "atendimento").length,
    observacoes: entries.filter((entry) => entry.kind === "observacao").length,
    contratos: entries.filter((entry) => entry.kind === "contrato").length,
    documentos: entries.filter((entry) => entry.kind === "documento").length,
  };
}

/** Situação do cliente a partir do contrato registrado. Sem contrato, diz isso (não "ativo"). */
export function profileSituation(activeCustomer: ProfileActiveCustomer | null): { label: string; tone: "accent" | "muted" } {
  if (!activeCustomer) return { label: "Contrato não registrado", tone: "muted" };
  if (activeCustomer.status === "cancelled") return { label: "Cliente cancelado", tone: "muted" };
  return { label: "Cliente ativo", tone: "accent" };
}

const SOURCE_CHANNEL_LABELS: Record<string, string> = {
  meta_ads: "Meta Ads",
  meta_lead_ads: "Meta Ads",
  bulk_import: "Importação",
  webhook: "Integração",
  whatsapp: "WhatsApp",
  whatsapp_direct: "WhatsApp",
  google_ads: "Google Ads",
  indicacao: "Indicação",
  referral: "Indicação",
  landing_page: "Site",
};

/** Origem do contato a partir do lead. `null` quando não há dado (o cabeçalho omite). */
export function profileOrigin(lead: { origem: string | null; sourceChannel: string | null } | null): string | null {
  if (!lead) return null;
  const channel = lead.sourceChannel?.trim().toLowerCase() || null;
  if (channel && SOURCE_CHANNEL_LABELS[channel]) return SOURCE_CHANNEL_LABELS[channel];
  if (lead.origem === "manual") return "Cadastro manual";
  return channel ? channel.replaceAll("_", " ") : null;
}

export type ProfilePendency = { id: string; label: string };

export type ProfileSummary = {
  lastInteraction: { label: string; author: string | null; at: string } | null;
  nextAction: NextActionView | null;
  contracts: { active: number; total: number; headline: string | null };
  pendencies: ProfilePendency[];
};

/**
 * Resumo da coluna lateral. Cada item só aparece com dado real: sem atendimento, diz que não há; sem pendência
 * registrada, diz exatamente isso (nunca "tudo em dia").
 */
export function buildProfileSummary(input: {
  timeline: TimelineEntry[];
  nextAction: NextActionView | null;
  sales: ProfileSale[];
  activeCustomer: ProfileActiveCustomer | null;
  documents: ProfileDocument[];
  renewalAttention: boolean;
}): ProfileSummary {
  const last = input.timeline.find((entry) => !entry.automatic && (entry.kind === "atendimento" || entry.kind === "observacao"));
  const activeSales = input.sales.filter((sale) => sale.status === "active");
  const headlineSale = activeSales[0] ?? null;
  const headline = headlineSale ? [headlineSale.carrierName, headlineSale.planName].filter(Boolean).join(" · ") || null : null;

  const pendencies: ProfilePendency[] = [];
  if (input.nextAction?.state === "overdue") pendencies.push({ id: "retorno", label: input.nextAction.reason });
  if (input.renewalAttention) pendencies.push({ id: "renovacao", label: "Renovação do contrato na janela de atenção." });
  const rejected = input.documents.filter((document) => document.status === "rejected").length;
  const pending = input.documents.filter((document) => document.status === "pending").length;
  if (rejected) pendencies.push({ id: "docs-recusados", label: rejected === 1 ? "1 documento recusado." : `${rejected} documentos recusados.` });
  if (pending) pendencies.push({ id: "docs-pendentes", label: pending === 1 ? "1 documento aguardando revisão." : `${pending} documentos aguardando revisão.` });

  return {
    lastInteraction: last ? { label: last.label, author: last.author, at: last.at } : null,
    nextAction: input.nextAction,
    contracts: { active: activeSales.length, total: input.sales.length, headline },
    pendencies,
  };
}

/**
 * Quem vê o Perfil do cliente novo: só o corretor do Lite com a chave do modo corretor ligada. Supervisor, gestor
 * e diretor continuam com a ficha de hoje.
 */
export function shouldUseBrokerClientProfile(input: { role: string; liteAudience: string | null; navReorgOn: boolean }): boolean {
  return input.navReorgOn && input.role === "broker" && input.liteAudience === "broker";
}

/**
 * Ações do perfil (registrar atendimento, agendar retorno, enviar documento): só enquanto o lead do cliente é do
 * corretor. Cliente que saiu da carteira, ou dono desconhecido, fica só de leitura. As actions revalidam no servidor.
 */
export function brokerProfileCanAct(input: { userId: string; leadOwnerId: string | null | undefined }): boolean {
  return Boolean(input.leadOwnerId) && input.leadOwnerId === input.userId;
}

export type ProfileHistory =
  | { status: "ok"; entries: TimelineEntry[] }
  | { status: "forbidden" }
  | { status: "error" };

export type BrokerClientProfileData = {
  client: { id: string; leadId: string; name: string; phone: string | null; email: string | null; convertedAt: string; branchName: string | null; brokerName: string | null };
  avatarSrc: string | null;
  situation: { label: string; tone: "accent" | "muted" };
  origin: string | null;
  canAct: boolean;
  /** Motivo de o perfil estar só de leitura (cliente fora da carteira ou falha ao conferir o dono). */
  readOnlyReason: string | null;
  history: ProfileHistory;
  sales: ProfileSale[];
  activeCustomer: ProfileActiveCustomer | null;
  documents: ProfileDocument[];
  beneficiaries: { id: string; name: string; relationship: string | null; isHolder: boolean }[];
  summary: ProfileSummary;
};
