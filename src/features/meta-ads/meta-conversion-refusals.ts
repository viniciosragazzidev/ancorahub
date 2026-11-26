/**
 * Regras puras das etapas que a Meta recusou (Conversions API for CRM): o motivo em pt-BR a partir do erro gravado
 * em meta_conversion_events.last_error e quando uma recusa pode voltar para a fila. O I/O fica no
 * meta-conversion-service.ts; nenhum clique chama a Meta direto, o job meta-conversions envia o que voltou para a fila.
 */
import { isMetaConversionEventExpired, META_CONVERSION_EVENT_NAMES, type MetaConversionStage } from "./meta-conversion-events";

export type MetaRefusalReasonKind = "token" | "dataset" | "duplicate" | "user_data" | "window" | "meta" | "unknown";

export type MetaRefusalReason = { kind: MetaRefusalReasonKind; label: string; hint: string };

const REASONS: Record<MetaRefusalReasonKind, Omit<MetaRefusalReason, "kind">> = {
  token: { label: "Token expirado", hint: "Reconecte a Meta em Marketing e tente de novo." },
  dataset: { label: "Pixel ou fonte de dados inválido", hint: "Escolha de novo a fonte de dados (dataset) e tente de novo." },
  duplicate: { label: "Evento duplicado", hint: "A Meta já tinha recebido esta etapa. Não precisa reenviar." },
  user_data: { label: "Dados do lead insuficientes", hint: "Confira telefone e e-mail do lead e tente de novo." },
  window: { label: "Fora da janela de 7 dias", hint: "A Meta só aceita etapas de até 7 dias. Esta não volta mais." },
  meta: { label: "Erro da Meta", hint: "Falha do lado da Meta. Tente de novo em alguns minutos." },
  unknown: { label: "Motivo não informado", hint: "Tente de novo. Se voltar a falhar, fale com o suporte." },
};

function reason(kind: MetaRefusalReasonKind): MetaRefusalReason {
  return { kind, ...REASONS[kind] };
}

/** Código numérico gravado pelo serviço ("código 190") ou vindo cru da Meta ("code":190). */
function errorCode(text: string): number | null {
  const match = text.match(/c[óo]digo\s+(\d+)/i) ?? text.match(/"?code"?\s*[:=]\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}

/**
 * Traduz o erro gravado para um motivo curto e o que fazer. A ordem importa: janela e duplicado vêm antes de
 * "dados do usuário" porque a Meta cita event_time e event_id dentro de mensagens de parâmetro inválido.
 */
export function describeMetaConversionRefusal(lastError: string | null | undefined): MetaRefusalReason {
  const text = (lastError ?? "").trim();
  if (!text) return reason("unknown");
  const lower = text.toLowerCase();
  const code = errorCode(text);

  if ([10, 190, 200].includes(code ?? -1) || /token|oauth|session has expired|sess[ãa]o expirou|permiss/.test(lower)) return reason("token");
  if (/7 dias|seven days|7 days|too old|event_time|janela/.test(lower)) return reason("window");
  if (/duplicad|duplicate|already (been )?received|j[áa] recebid/.test(lower)) return reason("duplicate");
  if (/pixel|dataset|fonte de dados|does not exist|unsupported post request|object with id/.test(lower)) return reason("dataset");
  if (/user_data|em_hash|ph_hash|lead_id|customer information|insufficient|insuficient|e-mail|email|telefone|phone/.test(lower)) return reason("user_data");
  if (/meta|graph|http \d{3}|rede|network|timeout/.test(lower)) return reason("meta");
  return reason("unknown");
}

export function metaConversionStageLabel(stage: string) {
  return META_CONVERSION_EVENT_NAMES[stage as MetaConversionStage] ?? "Etapa desconhecida";
}

export type MetaRefusalRetryCheck = { retryable: true } | { retryable: false; cause: string };

/**
 * Uma recusa só volta para a fila quando ainda está recusada, dentro dos 7 dias que a Meta aceita e com o envio
 * ligado (desligado, o job não envia e a linha ficaria parada). Duplicado não volta: a Meta já tem a etapa.
 */
export function checkMetaConversionRetry(input: {
  status: string;
  eventTime: Date;
  lastError: string | null | undefined;
  enabled: boolean;
  now?: Date;
}): MetaRefusalRetryCheck {
  const now = input.now ?? new Date();
  if (input.status !== "failed") return { retryable: false, cause: "Esta etapa não está mais recusada." };
  if (isMetaConversionEventExpired(input.eventTime, now)) return { retryable: false, cause: "Passou da janela de 7 dias da Meta. Esta etapa não pode mais ser enviada." };
  if (describeMetaConversionRefusal(input.lastError).kind === "duplicate") return { retryable: false, cause: "A Meta já recebeu esta etapa. Não precisa reenviar." };
  if (!input.enabled) return { retryable: false, cause: "O envio de etapas está desligado. Ligue para tentar de novo." };
  return { retryable: true };
}
