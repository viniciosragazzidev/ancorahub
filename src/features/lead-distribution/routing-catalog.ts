/** Shared vocabulary for the routing editor and the deterministic evaluator. */
export const ALL_ROUTING_SOURCES_ID = "__all_sources__";

export const ROUTING_SOURCE_OPTIONS = [
  { id: ALL_ROUTING_SOURCES_ID, label: "Todas as origens", aliases: ["all", "todas_as_origens"] },
  { id: "meta_lead_ads", label: "Meta Ads (Facebook/Instagram)", aliases: ["meta_ads"] },
  { id: "google_ads", label: "Google Ads", aliases: ["google"] },
  { id: "whatsapp", label: "WhatsApp Direto", aliases: ["whatsapp_direct", "whatsapp_direto"] },
  { id: "indicacao", label: "Indicação", aliases: ["referral"] },
  { id: "landing_page", label: "Site / Orgânico", aliases: ["site", "landing-page"] },
  { id: "bulk_import", label: "Importação manual", aliases: ["bulk-import", "csv"] },
] as const;

/** Stable sentinel used for a tenant-wide destination in the routing matrix. */
export const ALL_BRANCHES_TARGET_ID = "__all_branches__";

export const ROUTING_QUALIFICATION_STATUS_OPTIONS = [
  { id: "hot", label: "Lead Quente (Alta Intenção)" },
  { id: "warm", label: "Lead Morno (Em Qualificação)" },
  { id: "cold", label: "Lead Frio (Sem Resposta)" },
  { id: "handoff", label: "Encaminhado p/ Humano" },
  { id: "disqualified", label: "Desqualificado" },
] as const;

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("pt-BR");
}

export function normalizeRoutingSource(value: string | null | undefined) {
  const normalized = normalize(value);
  const option = ROUTING_SOURCE_OPTIONS.find(
    (candidate) => candidate.id === normalized || candidate.aliases.some((alias) => alias === normalized),
  );
  return option?.id ?? normalized;
}

export function getRoutingSourceLabel(value: string | null | undefined) {
  const normalized = normalizeRoutingSource(value);
  return ROUTING_SOURCE_OPTIONS.find((candidate) => candidate.id === normalized)?.label ?? value ?? "Não informado";
}

export function normalizeRoutingQualificationStatus(value: string | null | undefined) {
  const normalized = normalize(value);
  return normalized === "not_qualified" || normalized === "unqualified" ? "disqualified" : normalized;
}

export function getRoutingQualificationStatusLabel(value: string | null | undefined) {
  const normalized = normalizeRoutingQualificationStatus(value);
  return ROUTING_QUALIFICATION_STATUS_OPTIONS.find((candidate) => candidate.id === normalized)?.label ?? value ?? "Não informado";
}
