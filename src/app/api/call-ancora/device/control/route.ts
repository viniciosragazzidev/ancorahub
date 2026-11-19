import { z } from "zod";

import {
  bearerToken,
  DEVICE_DISABLED,
  DEVICE_UNAUTHORIZED,
  deviceAllowed,
  deviceJson,
  deviceStateBody,
} from "@/features/call-ancora/device-api";
import { syncColdQueue } from "@/features/call-ancora/cold-session";
import { ensureDeviceLoaded } from "@/features/call-ancora/session-persistence";
import { callAncoraSessionStore } from "@/features/call-ancora/session-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** App Android: pausar, retomar ou pular o contato atual. */
export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) return deviceJson({ error: DEVICE_UNAUTHORIZED }, 401);
  // Depois de um deploy/reinício, traz a sessão guardada de volta antes de responder.
  await ensureDeviceLoaded(token);
  if (!(await deviceAllowed(token))) return deviceJson({ error: DEVICE_DISABLED }, 403);
  const parsed = z.object({ action: z.enum(["pause", "resume", "skip", "end"]) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return deviceJson({ error: "Essa ação não é válida." }, 400);
  if (!callAncoraSessionStore.deviceHeartbeat(token)) return deviceJson({ error: DEVICE_UNAUTHORIZED }, 401);
  const snapshot = callAncoraSessionStore.deviceControl(token, parsed.data.action);
  if (!snapshot) return deviceJson({ error: "Agora não dá para fazer isso. Atualize o estado da sessão." }, 409);
  const scope = callAncoraSessionStore.scopeForDevice(token);
  if (scope) await syncColdQueue(scope);
  return deviceJson(deviceStateBody(callAncoraSessionStore.getForDevice(token) ?? snapshot));
}
