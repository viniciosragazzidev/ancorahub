import { z } from "zod";

import {
  bearerToken,
  DEVICE_DISABLED,
  DEVICE_UNAUTHORIZED,
  deviceAllowed,
  deviceJson,
  deviceStateBody,
} from "@/features/call-ancora/device-api";
import { persistClassification, syncColdQueue } from "@/features/call-ancora/cold-session";
import { ensureDeviceLoaded } from "@/features/call-ancora/session-persistence";
import { callAncoraSessionStore } from "@/features/call-ancora/session-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const classifySchema = z.object({
  outcome: z.enum(["interested", "not_interested", "no_answer", "voicemail", "wrong_number"]),
});

/**
 * App Android: feedback do contato depois da ligação, no próprio celular. Mesmo efeito
 * da classificação na web (avança a fila e grava o resultado no lead da base de frios).
 */
export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) return deviceJson({ error: DEVICE_UNAUTHORIZED }, 401);
  await ensureDeviceLoaded(token);
  if (!(await deviceAllowed(token))) return deviceJson({ error: DEVICE_DISABLED }, 403);
  const parsed = classifySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return deviceJson({ error: "Esse resultado não é válido." }, 400);
  if (!callAncoraSessionStore.deviceHeartbeat(token)) return deviceJson({ error: DEVICE_UNAUTHORIZED }, 401);
  const scope = callAncoraSessionStore.scopeForDevice(token);
  if (!scope) return deviceJson({ error: DEVICE_UNAUTHORIZED }, 401);
  const before = callAncoraSessionStore.getForBroker(scope);
  const snapshot = callAncoraSessionStore.classify(scope, parsed.data.outcome);
  if (!snapshot) return deviceJson({ error: "A ligação ainda não terminou ou já foi classificada." }, 409);
  await persistClassification(scope, before, snapshot);
  await syncColdQueue(scope);
  return deviceJson(deviceStateBody(callAncoraSessionStore.getForDevice(token) ?? snapshot));
}
