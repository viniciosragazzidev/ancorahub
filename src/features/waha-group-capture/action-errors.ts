import { postgresErrorCode } from "@/shared/db/postgres-errors";

/**
 * What the person should do when the relay cannot list the number's chats.
 * relay-client throws `WAHA_CHATS_FAILED:<what the relay answered>`: the relay's
 * own code (WAHA_UNAVAILABLE) or, when the route does not exist on the relay that
 * is running, Fastify's plain "Not Found".
 */
function describeChatsFailure(detail: string, fallback: string): string {
  const reason = detail.trim().toLowerCase();
  if (reason === "not found" || reason === "404") {
    return `${fallback} O serviço de WhatsApp (relay) que está no ar não tem a rota de listar conversas: atualize o serviço services/whatsapp-api para a versão atual e tente de novo.`;
  }
  if (reason === "unauthorized" || reason === "forbidden" || reason === "401" || reason === "403") {
    return `${fallback} O CRM não conseguiu se autenticar no serviço de WhatsApp. Confira o token interno configurado no CRM.`;
  }
  if (reason === "waha_unavailable" || reason === "502" || reason === "503") {
    return `${fallback} O WAHA não respondeu. Confirme que o número está conectado e tente de novo.`;
  }
  return `${fallback} O serviço de WhatsApp recusou a listagem (${detail.trim().slice(0, 60)}).`;
}

/**
 * The text a screen may show for a failed action. A database error carries the
 * whole query and its values, so it never reaches the person: only a short
 * explanation and the SQLSTATE do. Errors the code raised itself (the relay is
 * unreachable, the number is not found) already read well and pass through.
 */
export function describeActionError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.startsWith("WAHA_CHATS_FAILED:")) {
    return describeChatsFailure(error.message.slice("WAHA_CHATS_FAILED:".length), fallback);
  }
  if (error instanceof Error && error.message === "WAHA_CHATS_REQUIRES_FASTIFY") {
    return `${fallback} O CRM está configurado para outro transporte de WhatsApp: defina VPS_API_URL no ambiente.`;
  }
  const code = postgresErrorCode(error);
  if (code === "23514") {
    return `${fallback} O banco ainda não aceita este tipo de número: falta aplicar a migração 0206.`;
  }
  if (code === "42P01" || code === "42883") {
    return `${fallback} Falta aplicar migrações no banco (erro ${code}).`;
  }
  if (code) return `${fallback} Erro de banco (${code}).`;
  if (error instanceof Error) {
    // A failed query whose cause did not carry a code: still not for the screen.
    return /^Failed query/i.test(error.message) ? `${fallback} Erro de banco.` : error.message;
  }
  return fallback;
}
