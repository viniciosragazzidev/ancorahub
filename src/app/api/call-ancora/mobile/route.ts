import { z } from "zod";

import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { ensureDeviceLoaded } from "@/features/call-ancora/session-persistence";
import { callAncoraSessionStore, type CallStatus } from "@/features/call-ancora/session-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function deviceToken(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

async function enabled(token: string) {
  return (await getFeatureFlag(FEATURE_FLAGS.CALL_ANCORA_VISUAL).catch(() => "false")) === "true"
    || callAncoraSessionStore.deviceCanUseWhenFlagDisabled(token);
}

export async function GET(request: Request) {
  const token = deviceToken(request);
  await ensureDeviceLoaded(token);
  if (!(await enabled(token))) return Response.json({ error: "O Call Âncora está desativado." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const session = token ? callAncoraSessionStore.getForDevice(token) : null;
  if (!session) return Response.json({ error: "O pareamento do celular expirou. Gere um novo QR." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return Response.json({ session }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const token = deviceToken(request);
  await ensureDeviceLoaded(token);
  if (!(await enabled(token))) return Response.json({ error: "O Call Âncora está desativado." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const parsed = z.object({ callStatus: z.enum(["dialing", "ringing", "active", "ended"]) }).safeParse(await request.json().catch(() => null));
  if (!token || !parsed.success) return Response.json({ error: "A atualização do celular não é válida." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const session = callAncoraSessionStore.updateCallStatus(token, parsed.data.callStatus as CallStatus);
  if (!session) return Response.json({ error: "A ligação mudou. Atualize a tela do celular." }, { status: 409, headers: { "Cache-Control": "no-store" } });
  return Response.json({ session }, { headers: { "Cache-Control": "no-store" } });
}
