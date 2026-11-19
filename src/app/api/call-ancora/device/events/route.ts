import { z } from "zod";

import {
  bearerToken,
  DEVICE_DISABLED,
  DEVICE_UNAUTHORIZED,
  deviceAllowed,
  deviceJson,
  deviceStateBody,
} from "@/features/call-ancora/device-api";
import { callAncoraSessionStore } from "@/features/call-ancora/session-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const eventSchema = z.object({
  contactId: z.string().min(1).max(80),
  event: z.enum(["dialing", "active", "disconnected"]),
  at: z.number().int().nonnegative().optional(),
  causeCode: z.number().int().min(-1).max(100).nullable().optional(),
  causeLabel: z.string().max(120).nullable().optional(),
  timeToActiveMs: z.number().int().nonnegative().nullable().optional(),
  talkMs: z.number().int().nonnegative().nullable().optional(),
  sim: z.string().max(80).nullable().optional(),
  autoOutcome: z.enum(["no_answer", "voicemail"]).nullable().optional(),
  rule: z.string().max(40).nullable().optional(),
  dialToActiveMs: z.number().int().nonnegative().max(600_000).nullable().optional(),
});

/** App Android: evento de ligação real (discando, em ligação, encerrada com a causa). */
export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) return deviceJson({ error: DEVICE_UNAUTHORIZED }, 401);
  if (!(await deviceAllowed(token))) return deviceJson({ error: DEVICE_DISABLED }, 403);
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return deviceJson({ error: "O evento da ligação não é válido." }, 400);

  const result = callAncoraSessionStore.reportDeviceEvent(token, parsed.data);
  if (!result.ok) {
    if (result.reason === "unauthorized") return deviceJson({ error: DEVICE_UNAUTHORIZED }, 401);
    if (result.reason === "not_dialable") return deviceJson({ error: "Este contato não pode ser discado." }, 422);
    return deviceJson({ error: "A fila mudou. Atualize o estado da sessão." }, 409);
  }
  return deviceJson(deviceStateBody(result.snapshot));
}
