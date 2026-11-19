import { z } from "zod";

import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { callAncoraSessionStore } from "@/features/call-ancora/session-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = z.object({ token: z.string().min(40).max(80) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "O código de pareamento está incompleto." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const featureEnabled = (await getFeatureFlag(FEATURE_FLAGS.CALL_ANCORA_VISUAL).catch(() => "false")) === "true";
  if (!featureEnabled && !callAncoraSessionStore.pairingCanUseWhenFlagDisabled(parsed.data.token)) {
    return Response.json({ error: "O Call Âncora está desativado." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const result = callAncoraSessionStore.pair(parsed.data.token);
  if (!result.ok) {
    const status = result.reason === "expired" ? 410 : result.reason === "reused" ? 409 : 404;
    const error = result.reason === "expired" ? "Este QR venceu. Gere outro na tela do Call Âncora." : result.reason === "reused" ? "Este QR já foi usado. Gere outro na tela do Call Âncora." : "Não encontrei uma sessão para este QR.";
    return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({ deviceToken: result.deviceToken, session: result.snapshot }, { headers: { "Cache-Control": "no-store" } });
}
