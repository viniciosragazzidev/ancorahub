/**
 * Erro de ação num formato só (docs/design-system/FEEDBACK.md §8): a causa em português, curta,
 * e se dá para tentar de novo. Aceita os três formatos de retorno das actions
 * ({ ok:false, reason }, { error }, { message }), Error, string ou qualquer coisa.
 * Texto técnico (inglês, pilha, código) nunca chega ao usuário: vira o texto padrão.
 */
export type ActionErrorInfo = { cause: string; retryable: boolean };

export const DEFAULT_ACTION_ERROR = "Não consegui concluir agora.";
const OFFLINE_ERROR = "Sem conexão agora.";
const MAX_LENGTH = 180;

const TECHNICAL = /(\b(TypeError|ReferenceError|SyntaxError|undefined|null|NaN|ECONN\w*|ETIMEDOUT|SQL|stack|digest|status code|JSON)\b|\bat \w+ \(|[{}<>]|=>|::)/;
const ENGLISH = /\b(the|failed|error|invalid|unexpected|unauthorized|forbidden|not found|timeout|network|request|internal|server)\b/i;
const PORTUGUESE_HINT = /[ãõçáéíóúâêô]|\b(não|nao|para|com|sem|de|do|da|tente|já|ja|está|esta)\b/i;
const OFFLINE = /failed to fetch|networkerror|load failed|network request failed|offline/i;

function pickText(input: unknown): string | null {
  if (typeof input === "string") return input;
  if (input instanceof Error) return input.message;
  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    for (const field of ["reason", "error", "message"] as const) {
      const value = record[field];
      if (typeof value === "string" && value.trim()) return value;
      if (value && typeof value === "object") {
        const nested = pickText(value);
        if (nested) return nested;
      }
    }
  }
  return null;
}

function isReadable(text: string) {
  if (text.length > MAX_LENGTH || TECHNICAL.test(text)) return false;
  if (ENGLISH.test(text) && !PORTUGUESE_HINT.test(text)) return false;
  return true;
}

function sentence(text: string) {
  const trimmed = text.trim().replace(/\s+/g, " ");
  const capital = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?…]$/.test(capital) ? capital : `${capital}.`;
}

export function normalizeActionError(input: unknown, fallback: string = DEFAULT_ACTION_ERROR): ActionErrorInfo {
  const retryable = !(input && typeof input === "object" && (input as { retryable?: unknown }).retryable === false);
  const text = pickText(input);
  if (!text || !text.trim()) return { cause: sentence(fallback), retryable };
  if (OFFLINE.test(text)) return { cause: OFFLINE_ERROR, retryable: true };
  return { cause: sentence(isReadable(text) ? text : fallback), retryable };
}

/** Frase completa para a tela: causa + o que continua valendo ("O lead continua esperando você."). */
export function actionErrorMessage(info: ActionErrorInfo, keeps?: string) {
  return keeps ? `${info.cause} ${sentence(keeps)}` : info.cause;
}

/** Resultado de action que falhou: { ok: false } com qualquer um dos três campos. */
export function isFailedResult(value: unknown): value is { ok: false } {
  return Boolean(value && typeof value === "object" && (value as { ok?: unknown }).ok === false);
}
