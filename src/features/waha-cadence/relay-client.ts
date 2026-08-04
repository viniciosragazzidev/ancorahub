import "server-only";

import { randomUUID } from "node:crypto";

import { relaySendRequestSchema, relaySignature } from "./contract";

function relayConfig() {
  const url = process.env.WAHA_RELAY_URL?.trim().replace(/\/$/, "");
  const secret = process.env.WAHA_RELAY_SHARED_SECRET?.trim();
  if (!url || !secret) throw new Error("Relay WAHA não configurado.");
  return { url, secret };
}

export async function sendWahaRelayMessage(input: { idempotencyKey: string; sessionId: string; destination: string; body: string }) {
  const config = relayConfig();
  const payload = relaySendRequestSchema.parse({ requestId: randomUUID(), ...input });
  const rawBody = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const nonce = randomUUID();
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
  const data = await response.json().catch(() => null) as { messageId?: string; errorCode?: string } | null;
  if (!response.ok || !data?.messageId) {
    const error = new Error("O relay WAHA não confirmou o envio.") as Error & { status?: number; code?: string };
    error.status = response.status;
    error.code = data?.errorCode ?? "relay_send_failed";
    throw error;
  }
  return { messageId: data.messageId };
}

export async function getWahaRelayHealth() {
  const config = relayConfig();
  const timestamp = String(Date.now());
  const nonce = randomUUID();
  const rawBody = "";
  const response = await fetch(`${config.url}/v1/health`, {
    headers: {
      "x-ancora-timestamp": timestamp,
      "x-ancora-nonce": nonce,
      "x-ancora-signature": relaySignature(config.secret, timestamp, nonce, rawBody),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Relay WAHA indisponível.");
  return response.json() as Promise<{ status: "ok"; sessions: Array<{ id: string; status: string }> }>;
}
