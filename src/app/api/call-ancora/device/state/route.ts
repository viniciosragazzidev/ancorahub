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

/** App Android: estado da sessão. Número só vem quando o contato é discável. */
export async function GET(request: Request) {
  const token = bearerToken(request);
  if (!token) return deviceJson({ error: DEVICE_UNAUTHORIZED }, 401);
  if (!(await deviceAllowed(token))) return deviceJson({ error: DEVICE_DISABLED }, 403);
  const snapshot = callAncoraSessionStore.getForDevice(token);
  if (!snapshot) return deviceJson({ error: DEVICE_UNAUTHORIZED }, 401);
  return deviceJson(deviceStateBody(snapshot));
}
