import { NextResponse } from "next/server";

import { ingestWahaWebhook } from "@/features/waha-cadence/inbound";
import {
  normalizeWahaWebhookPayload,
  verifyRelaySignature,
  wahaWebhookSchema,
} from "@/features/waha-cadence/contract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.WAHA_RELAY_SHARED_SECRET?.trim();
  if (!secret) return NextResponse.json({ accepted: false, error: "WAHA webhook não configurado." }, { status: 503 });
  const rawBody = await request.text();
  const valid = verifyRelaySignature({
    secret,
    timestamp: request.headers.get("x-ancora-timestamp"),
    nonce: request.headers.get("x-ancora-nonce"),
    signature: request.headers.get("x-ancora-signature"),
    rawBody,
  });
  if (!valid) return NextResponse.json({ accepted: false, error: "Assinatura inválida." }, { status: 401 });
  try {
    const result = await ingestWahaWebhook(
      wahaWebhookSchema.parse(normalizeWahaWebhookPayload(JSON.parse(rawBody))),
      rawBody,
    );
    return NextResponse.json({ accepted: true, ...result });
  } catch (error) {
    console.error("[waha/webhook] processing_failed", { error: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
    return NextResponse.json({ accepted: false }, { status: 400 });
  }
}
