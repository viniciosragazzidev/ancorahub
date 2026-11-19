import {
  bearerToken,
  DEVICE_DISABLED,
  DEVICE_UNAUTHORIZED,
  deviceAllowed,
  deviceJson,
  deviceStateBody,
} from "@/features/call-ancora/device-api";
import { syncColdQueue, verifyColdCurrent } from "@/features/call-ancora/cold-session";
import { ensureDeviceLoaded } from "@/features/call-ancora/session-persistence";
import { callAncoraSessionStore } from "@/features/call-ancora/session-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** App Android: estado da sessão. Número só vem quando o contato é discável. */
export async function GET(request: Request) {
  const token = bearerToken(request);
  if (!token) return deviceJson({ error: DEVICE_UNAUTHORIZED }, 401);
  // Depois de um deploy/reinício, traz a sessão guardada de volta antes de responder.
  await ensureDeviceLoaded(token);
  if (!(await deviceAllowed(token))) return deviceJson({ error: DEVICE_DISABLED }, 403);
  // Cada leitura do app é também o sinal de vida (heartbeat) do celular.
  callAncoraSessionStore.deviceHeartbeat(token);
  const scope = callAncoraSessionStore.scopeForDevice(token);
  if (scope) {
    await syncColdQueue(scope);
    // Conferência na hora de entregar o número: o frio ainda está sem corretor?
    await verifyColdCurrent(scope);
  }
  const snapshot = callAncoraSessionStore.getForDevice(token);
  if (!snapshot) return deviceJson({ error: DEVICE_UNAUTHORIZED }, 401);
  return deviceJson(deviceStateBody(snapshot));
}
