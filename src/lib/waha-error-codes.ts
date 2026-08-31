/**
 * Códigos de erro WAHA compartilhados entre Server Actions e interface.
 *
 * A Server Action classifica a falha em um código estável (serializável) e a
 * interface decide a mensagem. Isto evita que erros de infraestrutura distintos
 * (TLS, DNS, timeout) colapsem em mensagens genéricas que escondem a causa raiz.
 */

export const WAHA_ERROR_CODES = [
  "WAHA_TIMEOUT",
  "WAHA_UNAVAILABLE",
  "WAHA_UNAUTHORIZED",
  "WAHA_INTERNAL_ERROR",
  "WAHA_BAD_RESPONSE",
  "WAHA_UNREACHABLE",
  "WAHA_ERROR",
  "SESSION_EXISTS",
  "QR_ERROR",
  "NO_SESSION",
] as const;

export type WahaErrorCode = (typeof WAHA_ERROR_CODES)[number];

/** Extrai o primeiro código WAHA_* presente em uma mensagem de erro do relay/VPS. */
export function wahaActionCodeFromMessage(message: string): WahaErrorCode {
  const code = message.match(
    /\b(WAHA_(?:TIMEOUT|UNAVAILABLE|UNAUTHORIZED|INTERNAL_ERROR|BAD_RESPONSE|UNREACHABLE))\b/,
  )?.[1];
  return (code as WahaErrorCode) ?? "WAHA_ERROR";
}

/**
 * Mensagem de erro em pt-BR para exibição ao usuário final por código.
 * Códigos desconhecidos mantêm a mensagem genérica.
 */
export function wahaActionErrorMessage(code?: string | null): string {
  switch (code) {
    case "WAHA_TIMEOUT":
      return "O servidor WhatsApp demorou para responder. Tente novamente ou forçar a desconexão local.";
    case "WAHA_UNAVAILABLE":
      return "Serviço de WhatsApp temporariamente indisponível.";
    case "WAHA_UNAUTHORIZED":
      return "A configuração do serviço WhatsApp precisa de atenção. Avise o administrador.";
    case "WAHA_INTERNAL_ERROR":
      return "Não foi possível encerrar a sessão no WhatsApp. Tente novamente.";
    case "WAHA_BAD_RESPONSE":
      return "O WhatsApp respondeu de forma inesperada. Tente novamente.";
    case "WAHA_UNREACHABLE":
      return "O servidor WhatsApp está temporariamente inacessível. Tente novamente ou forçar a desconexão local.";
    case "SESSION_EXISTS":
      return "Sessão já existe. Reconectando…";
    case "QR_ERROR":
      return "QR Code expirou ou indisponível. Gere um novo.";
    case "NO_SESSION":
      return "Nenhuma sessão ativa. Inicie uma nova conexão.";
    default:
      return "Não foi possível completar a operação. Tente novamente.";
  }
}
