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
  version: z.number().int().nonnegative().nullable().optional(),
});

/** App Android: evento de ligação real (discando, em ligação, encerrada com a causa). */
export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) return deviceJson({ error: DEVICE_UNAUTHORIZED }, 401);
  // Depois de um deploy/reinício, traz a sessão guardada de volta antes de responder.
  await ensureDeviceLoaded(token);
  if (!(await deviceAllowed(token))) return deviceJson({ error: DEVICE_DISABLED }, 403);
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return deviceJson({ error: "O evento da ligação não é válido." }, 400);

  const scope = callAncoraSessionStore.scopeForDevice(token);
  const before = scope ? callAncoraSessionStore.getForBroker(scope) : null;
  const result = callAncoraSessionStore.reportDeviceEvent(token, parsed.data);
  if (!result.ok) {
    if (result.reason === "unauthorized") return deviceJson({ error: DEVICE_UNAUTHORIZED }, 401);
    if (result.reason === "not_dialable") return deviceJson({ error: "Este contato não pode ser discado." }, 422);
    if (result.reason === "paused") return deviceJson({ error: "Pausado pela tela. Nenhuma ligação nova começa.", code: "paused" }, 409);
    if (result.reason === "outside_window") return deviceJson({ error: "Fora do horário de ligações.", code: "outside_window" }, 409);
    if (result.reason === "version_mismatch") return deviceJson({ error: "A sessão mudou na tela. Atualize antes de discar.", code: "version_mismatch" }, 409);
    return deviceJson({ error: "A fila mudou. Atualize o estado da sessão." }, 409);
  }
  if (scope && parsed.data.event === "disconnected") {
    // "Não atendeu"/caixa postal automáticos: grava no lead quando é da base de frios.
    await persistClassification(scope, before, result.snapshot);
    await syncColdQueue(scope);
  }
  const fresh = callAncoraSessionStore.getForDevice(token);
  return deviceJson(deviceStateBody(fresh ?? result.snapshot));
}
