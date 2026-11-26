/**
 * Quem fez cada item da linha do tempo do lead: pessoa da equipe, IA ou regra automática.
 *
 * `lead_interactions.user_id` é obrigatório e os jobs gravam um membro qualquer do tenant
 * (resolveSystemUserId), então o usuário sozinho não diz quem agiu. A ordem é:
 * 1. `metadata.source` conhecido; 2. tipo do evento; 3. texto que os geradores escrevem;
 * 4. sem certeza: Equipe quando tem usuário, Automático quando não tem.
 */

export type TimelineOrigin = "team" | "ai" | "automatic";
export type TimelineOriginFilter = "all" | TimelineOrigin;

export const TIMELINE_ORIGIN_FILTERS: readonly TimelineOriginFilter[] = ["all", "team", "ai", "automatic"];

export const TIMELINE_ORIGIN_LABELS: Record<TimelineOrigin, string> = { team: "Equipe", ai: "IA", automatic: "Automático" };
export const TIMELINE_FILTER_LABELS: Record<TimelineOriginFilter, string> = { all: "Tudo", ...TIMELINE_ORIGIN_LABELS };

export type TimelineOriginInput = {
  tipo: string;
  conteudo?: string | null;
  metadata?: unknown;
  userId?: string | null;
  userName?: string | null;
};

const SOURCE_ORIGINS: Record<string, TimelineOrigin> = {
  // Pessoas, inclusive quando aceitam ou desfazem algo que a IA sugeriu.
  user_accepted_ai_suggestion: "team",
  user_undid_ai_move: "team",
  ai_regression_protection: "team",
  extension: "team",
  browser_extension: "team",
  closing_outcome_hold: "team",
  call_ancora: "team",
  manual: "team",
  dashboard: "team",
  // IA.
  ai: "ai",
  ai_sale_detected: "ai",
  ai_qualification: "ai",
  ai_follow_up: "ai",
  ai_followup: "ai",
  agent: "ai",
  // Regras, jobs e integrações.
  stale_rule: "automatic",
  webhook: "automatic",
  post_sale_audit: "automatic",
  qualification_timeout: "automatic",
  sla: "automatic",
  system_recovery: "automatic",
  system_generated: "automatic",
  automatic: "automatic",
  redistribution: "automatic",
  intake: "automatic",
  cadence: "automatic",
  cronograma: "automatic",
};

const TEAM_TYPES = new Set(["service_started", "document_upload", "document_review", "quote_generated"]);

/** Ação de pessoa descrita no texto (vem antes da IA: "Qualificação por IA iniciada manualmente"). */
const TEAM_TEXT = /manualmente|por solicita[çc][ãa]o administrativa|\bassumi[ru]\b|\bpor (diretor|gestor|supervisor)\b|reatribu[íi]do por|transferido por|registrado pela extens[ãa]o|^feedback registrado|^corretor (recusou|aceitou|iniciou)|^lead importado|corretor foi exclu[íi]do|^sugest[ãa]o da IA aceita|^mudan[çc]a da IA desfeita/i;
/** Regras de etapa que citam a IA mas não são a IA agindo. */
const RULE_TEXT = /etapa exige qualifica[çc][ãa]o pr[ée]via|marca[çc][ãa]o 'IA Desativada'/i;
const AI_TEXT = /\bIA\b|qualifica[çc][ãa]o autom[áa]tica|atendimento virtual|^capacidade \[|cliente corrigiu os dados|follow-?up da IA|pergunt\w* (para|à) (a )?dire[çc][ãa]o/i;
const AUTOMATIC_TEXT = /^gatilho \[|tempo limite|alerta de sla|\bsla\b|automaticamente|automática|webhook|landing page|preencheu um novo formul[áa]rio|lead sem whatsapp|^lead recebido|redistribu|cad[êe]ncia|cliente sem resposta|cliente voltou a responder|sem resposta do cliente/i;

function readSource(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const source = (metadata as Record<string, unknown>).source;
  return typeof source === "string" && source.trim() ? source.trim().toLowerCase() : null;
}

export function classifyTimelineOrigin(item: TimelineOriginInput): TimelineOrigin {
  const source = readSource(item.metadata);
  if (source && SOURCE_ORIGINS[source]) return SOURCE_ORIGINS[source];
  if (TEAM_TYPES.has(item.tipo)) return "team";
  const text = (item.conteudo ?? "").trim();
  if (text) {
    if (TEAM_TEXT.test(text)) return "team";
    if (RULE_TEXT.test(text)) return "automatic";
    if (AI_TEXT.test(text)) return "ai";
    if (AUTOMATIC_TEXT.test(text)) return "automatic";
  }
  return item.userId || item.userName ? "team" : "automatic";
}

export function filterTimelineByOrigin<T extends TimelineOriginInput>(items: readonly T[], filter: TimelineOriginFilter): T[] {
  return filter === "all" ? [...items] : items.filter((item) => classifyTimelineOrigin(item) === filter);
}

export function isTimelineOriginFilter(value: unknown): value is TimelineOriginFilter {
  return typeof value === "string" && (TIMELINE_ORIGIN_FILTERS as readonly string[]).includes(value);
}

export function timelineFilterStorageKey(viewerId?: string | null) {
  return `ancorahub:lead-timeline-origem:${viewerId || "anonimo"}`;
}
