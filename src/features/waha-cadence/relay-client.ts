import "server-only";

import { randomUUID } from "node:crypto";

import {
  relaySendRequestSchema,
  relaySessionCreateSchema,
  relaySessionStateSchema,
  relaySignature,
} from "./contract";

/**
 * Keep the company-number flow on the same reachable Fastify base used by
 * broker Lite connections. A legacy WAHA_RELAY_URL must not shadow VPS_API_URL.
 */
export function resolveWahaRelayBaseUrl(environment: Record<string, string | undefined> = process.env) {
  const value = (
    environment.VPS_API_URL ||
    environment.WAHA_API_URL ||
    environment.WAHA_RELAY_URL ||
    environment.NEXT_PUBLIC_VPS_API_URL
  )?.trim();
  if (!value) return null;
  try {
    return new URL(value.startsWith("http") ? value : `https://${value}`).origin;
  } catch {
    return null;
  }
}

function relayConfig() {
  const url = resolveWahaRelayBaseUrl();

  const secret = (
    process.env.WHATSAPP_API_INTERNAL_TOKEN ||
    process.env.VPS_INTERNAL_API_TOKEN ||
    process.env.VPS_API_TOKEN ||
    process.env.WAHA_RELAY_SHARED_SECRET
  )?.trim();

  if (!url || !secret) {
    throw new Error("Relay WAHA não configurado. Defina VPS_API_URL e WHATSAPP_API_INTERNAL_TOKEN no ambiente.");
  }
  return { url, secret };
}

function getFastifyHeaders(secret: string, hasBody: boolean) {
  return {
    ...(hasBody ? { "content-type": "application/json" } : {}),
    "X-CorreTop-Internal-Token": secret,
    "x-corretop-internal-token": secret,
    Authorization: `Bearer ${secret}`,
  };
}

export async function sendWahaRelayMessage(input: {
  idempotencyKey: string;
  sessionId: string;
  destination: string;
  body: string;
}) {
  const config = relayConfig();
  const payload = relaySendRequestSchema.parse({ requestId: randomUUID(), ...input });
  const rawBody = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const nonce = randomUUID();

  try {
    const response = await fetch(`${config.url}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ancora-timestamp": timestamp,
        "x-ancora-nonce": nonce,
        "x-ancora-signature": relaySignature(config.secret, timestamp, nonce, rawBody),
      },
      body: rawBody,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    if (response.ok) {
      const data = (await response.json().catch(() => null)) as { messageId?: string; errorCode?: string } | null;
      if (data?.messageId) {
        return { messageId: data.messageId };
      }
    }
  } catch {
    // Fall through to Fastify endpoint
  }

  // Fallback para o Fastify /internal/waha/messages/text (usado pelo broker)
  const phone = input.destination.replace(/\D/g, "");
  const fastifyRes = await fetch(`${config.url}/internal/waha/messages/text`, {
    method: "POST",
    headers: getFastifyHeaders(config.secret, true),
    body: JSON.stringify({
      sessionName: input.sessionId,
      chatId: phone,
      text: input.body,
      idempotencyKey: input.idempotencyKey,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  const fbData = (await fastifyRes.json().catch(() => null)) as { ok?: boolean; messageId?: string } | null;
  if (!fastifyRes.ok || !fbData?.messageId) {
    const error = new Error("O serviço WAHA não confirmou o envio da mensagem.") as Error & {
      status?: number;
      code?: string;
    };
    error.status = fastifyRes.status;
    error.code = "relay_send_failed";
    throw error;
  }
  return { messageId: fbData.messageId };
}

export async function getWahaRelayHealth() {
  const config = relayConfig();
  const timestamp = String(Date.now());
  const nonce = randomUUID();
  const rawBody = "";

  try {
    const response = await fetch(`${config.url}/v1/health`, {
      headers: {
        "x-ancora-timestamp": timestamp,
        "x-ancora-nonce": nonce,
        "x-ancora-signature": relaySignature(config.secret, timestamp, nonce, rawBody),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (response.ok) {
      const data = await response.json().catch(() => null);
      if (data) return data as { status: "ok"; sessions: Array<{ id: string; status: string }> };
    }
  } catch {
    // Fall through
  }

  // Fallback Fastify health
  const fastifyRes = await fetch(`${config.url}/health`, {
    headers: getFastifyHeaders(config.secret, false),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);

  if (fastifyRes && fastifyRes.ok) {
    return { status: "ok", sessions: [] };
  }

  throw new Error(`Serviço WAHA indisponível em ${config.url}.`);
}

async function relaySessionRequest(path: string, method: "GET" | "POST" | "DELETE", payload?: unknown) {
  const config = relayConfig();
  const rawBody = payload ? JSON.stringify(payload) : "";
  const timestamp = String(Date.now());
  const nonce = randomUUID();
  const primaryHeaders = {
    ...(rawBody ? { "content-type": "application/json" } : {}),
    "x-ancora-timestamp": timestamp,
    "x-ancora-nonce": nonce,
    "x-ancora-signature": relaySignature(config.secret, timestamp, nonce, rawBody),
  };

  let primaryResponse: Response | null = null;
  let primaryData: unknown = null;

  try {
    primaryResponse = await fetch(`${config.url}${path}`, {
      method,
      headers: primaryHeaders,
      ...(rawBody ? { body: rawBody } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    if (primaryResponse.ok) {
      primaryData = await primaryResponse.json().catch(() => null);
      if (primaryData) {
        return relaySessionStateSchema.parse(primaryData);
      }
    }
  } catch {
    // Se a rota /v1/sessions der erro de rede / timeout / DNS, cair no fallback do Fastify abaixo
  }

  // Fallback para rotas Fastify /internal/waha/connections
  const fastifyHeaders = getFastifyHeaders(config.secret, Boolean(rawBody));
  const sessionId =
    (payload as { sessionId?: string })?.sessionId ||
    decodeURIComponent(path.split("/")[3]?.split("?")[0] ?? "");

  let fallbackUrl = `${config.url}/internal/waha/connections`;
  let fallbackBody = rawBody;
  let fallbackMethod = method;
  const tenantId = (payload as { tenantId?: string })?.tenantId || "system";
  const userId = (payload as { userId?: string })?.userId || "system";

  if (method === "POST" && path === "/v1/sessions") {
    fallbackUrl = `${config.url}/internal/waha/connections`;
    fallbackBody = JSON.stringify({
      sessionName: sessionId,
      tenantId,
      userId,
    });
  } else if (method === "GET" && sessionId) {
    fallbackUrl = `${config.url}/internal/waha/connections/${encodeURIComponent(sessionId)}/status`;
  } else if (method === "DELETE" && sessionId) {
    fallbackUrl = `${config.url}/internal/waha/connections/${encodeURIComponent(sessionId)}/disconnect`;
    fallbackMethod = "POST";
    fallbackBody = "";
  }

  const fallbackRes = await fetch(fallbackUrl, {
    method: fallbackMethod,
    headers: fastifyHeaders,
    ...(fallbackMethod !== "GET" && fallbackBody ? { body: fallbackBody } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);

  if (fallbackRes && fallbackRes.ok) {
    const fbData = (await fallbackRes.json().catch(() => null)) as {
      ok?: boolean;
      status?: string;
      phoneNumber?: string | null;
      displayPhoneNumber?: string | null;
      qr?: string | null;
      qrCode?: string | null;
    } | null;

    if (fbData && fbData.ok !== false) {
      const rawStatus = String(fbData.status || "STARTING").toUpperCase();
      let status: "pending" | "connecting" | "active" | "paused" | "offline" | "error" = "connecting";
      if (rawStatus === "WORKING" || rawStatus === "CONNECTED") status = "active";
      else if (rawStatus === "STOPPED") status = "offline";
      else if (rawStatus === "FAILED" || rawStatus === "ERROR") status = "error";

      let qrCode = fbData.qr ?? fbData.qrCode ?? null;

      // Se a sessão está aguardando leitura do QR e não veio no status, buscar no endpoint /qr
      if (status !== "active" && !qrCode && sessionId) {
        try {
          const qrRes = await fetch(`${config.url}/internal/waha/connections/${encodeURIComponent(sessionId)}/qr`, {
            headers: fastifyHeaders,
            cache: "no-store",
            signal: AbortSignal.timeout(10_000),
          });
          if (qrRes.ok) {
            const qrData = (await qrRes.json().catch(() => null)) as { ok?: boolean; qr?: string } | null;
            if (qrData?.qr) {
              qrCode = qrData.qr;
            }
          }
        } catch {
          // QR pode ainda não estar pronto no primeiro instante
        }
      }

      return relaySessionStateSchema.parse({
        sessionId: sessionId || "waha-session",
        status,
        displayPhoneNumber: fbData.phoneNumber ?? fbData.displayPhoneNumber ?? null,
        qrCode,
      });
    }
  }

  const errorMsg =
    (primaryData as { message?: string; error?: string })?.message ||
    (primaryData as { message?: string; error?: string })?.error ||
    primaryResponse?.statusText ||
    "Não foi possível conectar ao serviço WAHA";

  throw new Error(`O serviço WAHA não confirmou a conexão (${errorMsg}).`);
}

export async function createWahaRelaySession(
  sessionId: string,
  meta?: { tenantId?: string; userId?: string },
) {
  const payload = relaySessionCreateSchema.parse({
    sessionId,
    tenantId: meta?.tenantId,
    userId: meta?.userId,
  });
  return relaySessionRequest("/v1/sessions", "POST", payload);
}

export async function getWahaRelaySession(sessionId: string) {
  return relaySessionRequest(`/v1/sessions/${encodeURIComponent(sessionId)}`, "GET");
}

export async function pauseWahaRelaySession(sessionId: string) {
  return relaySessionRequest(`/v1/sessions/${encodeURIComponent(sessionId)}/pause`, "POST");
}

export async function resumeWahaRelaySession(sessionId: string) {
  return relaySessionRequest(`/v1/sessions/${encodeURIComponent(sessionId)}/resume`, "POST");
}

export async function disconnectWahaRelaySession(sessionId: string) {
  return relaySessionRequest(`/v1/sessions/${encodeURIComponent(sessionId)}`, "DELETE");
}
