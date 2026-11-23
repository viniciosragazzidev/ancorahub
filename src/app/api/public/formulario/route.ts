import { type NextRequest, NextResponse } from "next/server";

import { receivePublicForm } from "@/features/public-form/intake";
import { checkPublicFormRateLimit } from "@/features/public-form/rate-limit";
import { parsePublicFormSubmission } from "@/features/public-form/submission-schema";
import { readWebhookJson, resolveRequestId } from "@/features/leads/webhooks/utils/lead-webhook.utils";
import { backgroundRoute } from "@/shared/db/background-pool";

export const runtime = "nodejs";

const RETRY_LATER = "Não consegui enviar agora. Suas respostas continuam aqui. Tente de novo em instantes.";

/**
 * Envio do formulário público (/formulario). Sem login: limite por visitante e geral, honeypot, celular
 * conferido e chave de idempotência (reenviar a mesma conversa nunca cria dois leads). O lead entra pelo
 * mesmo caminho da landing page: dedupe por telefone, nota, distribuição e notificação.
 */
async function handlePOST(request: NextRequest) {
  const receivedAt = new Date();
  const requestId = resolveRequestId(request.headers.get("X-Request-Id"));
  const headers = { "Cache-Control": "no-store", "X-Request-Id": requestId };
  const fail = (status: number, error: string, retryable: boolean, extra?: Record<string, string>) =>
    NextResponse.json({ ok: false, error, retryable }, { status, headers: { ...headers, ...extra } });

  if (!(request.headers.get("Content-Type") ?? "").includes("application/json")) return fail(415, RETRY_LATER, false);

  const limited = checkPublicFormRateLimit(request);
  if (!limited.ok) return fail(429, "Muitos envios em pouco tempo. Espere um minuto e tente de novo; suas respostas continuam aqui.", true, { "Retry-After": String(limited.retryAfterSeconds) });

  const body = await readWebhookJson(request);
  if (!body.ok) return fail(body.code === "PAYLOAD_TOO_LARGE" ? 413 : 400, "Algumas respostas chegaram incompletas. Recarregue a página e responda de novo.", false);

  const parsed = parsePublicFormSubmission(body.data);
  if (!parsed.ok) return fail(422, parsed.error, false);

  try {
    const result = await receivePublicForm(parsed.data, { requestId, userAgent: request.headers.get("User-Agent"), receivedAt });
    if (!result.ok) {
      if (result.code === "UNAVAILABLE") return fail(503, "O formulário está fora do ar agora. Tente de novo mais tarde.", true);
      if (result.code === "CONFLICT") return fail(409, "Essas respostas mudaram depois do primeiro envio. Toque em Tentar de novo.", true);
      return fail(500, RETRY_LATER, true);
    }
    // Repetido (mesmo telefone ou mesma conversa) responde igual: quem envia não fica sabendo quem já é lead.
    return NextResponse.json({ ok: true }, { status: result.duplicate ? 200 : 201, headers });
  } catch (error) {
    console.error("[formulario] unexpected error:", error);
    return fail(500, RETRY_LATER, true);
  }
}

// Entrada de lead usa as conexões de segundo plano, como os webhooks (24/10).
export const POST = backgroundRoute(handlePOST);
