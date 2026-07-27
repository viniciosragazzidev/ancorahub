import { type NextRequest, NextResponse } from "next/server";

import {
  resolveRequestId,
  readWebhookJson,
} from "@/features/leads/webhooks/utils/lead-webhook.utils";
import { authenticateLeadWebhook, WebhookAuthError } from "@/features/leads/webhooks/services/authenticate-lead-webhook";
import { createLeadFromWebhookSync } from "@/features/leads/webhooks/services/create-lead-from-webhook-sync";

export const runtime = "nodejs";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Idempotency-Key, X-Request-Id",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Unified webhook endpoint — Bearer token in Authorization header.
 * Used by server-to-server integrations (n8n, Make, and other approved sources).
 * For landing page embeds, use /api/webhooks/leads/[token] instead.
 */
export async function POST(request: NextRequest) {
  const receivedAt = new Date();
  const requestId = resolveRequestId(request.headers.get("X-Request-Id"));

  const headers: Record<string, string> = {
    ...CORS_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Request-Id": requestId,
  };

  // ── Validate Content-Type ──────────────────────────────────────────
  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { success: false, error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "O Content-Type deve ser application/json." } },
      { status: 415, headers },
    );
  }

  // ── Extract Bearer token ───────────────────────────────────────────
  const authHeader = request.headers.get("Authorization");
  const rawToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!rawToken) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Credenciais inválidas." } },
      { status: 401, headers },
    );
  }

  // ── Authenticate ───────────────────────────────────────────────────
  let credential;
  try {
    credential = await authenticateLeadWebhook(rawToken);
  } catch (error) {
    if (error instanceof WebhookAuthError) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Credenciais inválidas." } },
        { status: 401, headers },
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Não foi possível processar a requisição." } },
      { status: 500, headers },
    );
  }

  // ── Read body ──────────────────────────────────────────────────────
  const bodyResult = await readWebhookJson(request);
  if (!bodyResult.ok) {
    const status = bodyResult.code === "PAYLOAD_TOO_LARGE" ? 413 : 400;
    return NextResponse.json(
      { success: false, error: { code: bodyResult.code, message: bodyResult.code === "PAYLOAD_TOO_LARGE" ? "O payload excede o limite de 32 KB." : "JSON inválido." } },
      { status, headers },
    );
  }

  // ── Idempotency-Key ────────────────────────────────────────────────
  const rawIdempotencyKey = request.headers.get("Idempotency-Key");
  const idempotencyKey = rawIdempotencyKey && /^[a-zA-Z0-9_-]{1,64}$/.test(rawIdempotencyKey) ? rawIdempotencyKey : null;

  // ── Create lead synchronously ──────────────────────────────────────
  try {
    const result = await createLeadFromWebhookSync({
      tenantId: credential.tenantId,
      branchId: credential.branchId,
      credentialId: credential.credentialId,
      createdByUserId: credential.createdBy,
      payload: bodyResult.data,
      idempotencyKey,
      requestMetadata: { requestId, userAgent: request.headers.get("User-Agent"), receivedAt },
    });

    if (!result.success) {
      const statusMap: Record<string, number> = {
        UNAUTHORIZED: 401, TENANT_INACTIVE: 403, INVALID_PAYLOAD: 422,
        BRANCH_NOT_FOUND: 422, IDEMPOTENCY_CONFLICT: 409,
        PAYLOAD_TOO_LARGE: 413, RATE_LIMITED: 429,
      };
      return NextResponse.json(
        { success: false, error: { code: result.code, message: getErrorMessage(result.code), issues: result.issues } },
        { status: statusMap[result.code] ?? 500, headers },
      );
    }

    return NextResponse.json(
      { success: true, data: { leadId: result.leadId, duplicate: result.duplicate } },
      { status: result.duplicate ? 200 : 201, headers },
    );
  } catch (error) {
    console.error("[webhook/bearer] unexpected error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Não foi possível processar a requisição." } },
      { status: 500, headers },
    );
  }
}

function getErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    UNAUTHORIZED: "Credenciais inválidas.",
    TENANT_INACTIVE: "Integração indisponível.",
    INVALID_PAYLOAD: "Os dados enviados são inválidos.",
    BRANCH_NOT_FOUND: "A filial informada não está disponível.",
    IDEMPOTENCY_CONFLICT: "Chave de idempotência conflitante.",
    PAYLOAD_TOO_LARGE: "Payload excede 32 KB.",
    RATE_LIMITED: "Limite de requisições excedido.",
    INTERNAL_ERROR: "Erro interno.",
  };
  return messages[code] ?? "Erro interno.";
}
