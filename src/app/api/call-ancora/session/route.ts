import { z } from "zod";

import { AuthenticationError, AuthorizationError } from "@/shared/auth/errors";
import { requireCallAncoraAccess } from "@/features/call-ancora/access";
import { CALL_ANCORA_PAIR_TTL_MS, callAncoraSessionStore } from "@/features/call-ancora/session-store";
import { CALL_ANCORA_TEST_LIST_MAX, parseCallAncoraTestList } from "@/features/call-ancora/test-list";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("classify"), outcome: z.enum(["interested", "not_interested", "no_answer", "voicemail"]) }),
  z.object({ action: z.literal("reclassify"), outcome: z.enum(["interested", "not_interested", "no_answer", "voicemail"]) }),
  z.object({ action: z.literal("hangup-voicemail") }),
  z.object({ action: z.literal("hangup-call") }),
  z.object({ action: z.literal("run-pause") }),
  z.object({ action: z.literal("run-resume") }),
  z.object({ action: z.literal("end") }),
  z.object({ action: z.literal("pause") }),
  z.object({ action: z.literal("resume") }),
  z.object({ action: z.literal("auto-dial"), enabled: z.boolean() }),
  z.object({ action: z.literal("test-list"), text: z.string().max(10_000) }),
]);

function authError(error: unknown) {
  if (error instanceof AuthenticationError) return Response.json({ error: "Faça login para abrir o Call Âncora." }, { status: 401 });
  if (error instanceof AuthorizationError) return Response.json({ error: error.message }, { status: 403 });
  console.error("Call Âncora indisponível", error instanceof Error ? error.message : "erro inesperado");
  return Response.json({ error: "Não foi possível acessar a sessão do Call Âncora. Tente novamente." }, { status: 500 });
}

const noStore = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  try {
    const { context, sessionOwnerId } = await requireCallAncoraAccess();
    const snapshot = callAncoraSessionStore.getForBroker({ tenantId: context.tenantId, brokerId: sessionOwnerId });
    return Response.json({ session: snapshot }, { headers: noStore });
  } catch (error) {
    return authError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { context, sessionOwnerId, brokerName, flagBypass } = await requireCallAncoraAccess();
    const parsed = z.object({ action: z.literal("start") }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Não reconheci o início da sessão." }, { status: 400, headers: noStore });
    const started = callAncoraSessionStore.create({ tenantId: context.tenantId, brokerId: sessionOwnerId }, brokerName, { flagBypass });
    return Response.json({ ...started, pairExpiresAt: Date.now() + CALL_ANCORA_PAIR_TTL_MS }, { headers: noStore });
  } catch (error) {
    return authError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { context, sessionOwnerId, flagBypass } = await requireCallAncoraAccess();
    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Essa ação não é válida para a sessão." }, { status: 400, headers: noStore });
    const scope = { tenantId: context.tenantId, brokerId: sessionOwnerId };
    if (parsed.data.action === "test-list") {
      // Ligação real: só admin da plataforma ou desenvolvimento local.
      if (!flagBypass) return Response.json({ error: "A lista de teste é só para administradores da plataforma." }, { status: 403, headers: noStore });
      const { entries, errors } = parseCallAncoraTestList(parsed.data.text);
      if (errors.length || entries.length === 0) {
        return Response.json({ error: errors[0] ?? "Digite pelo menos um número.", errors }, { status: 400, headers: noStore });
      }
      const updated = callAncoraSessionStore.setTestList(scope, entries.slice(0, CALL_ANCORA_TEST_LIST_MAX));
      if (!updated) return Response.json({ error: "Inicie a sessão e espere a ligação atual terminar para trocar a fila." }, { status: 409, headers: noStore });
      return Response.json({ session: updated }, { headers: noStore });
    }
    const snapshot = parsed.data.action === "classify"
      ? callAncoraSessionStore.classify(scope, parsed.data.outcome)
      : parsed.data.action === "reclassify"
        ? callAncoraSessionStore.reclassify(scope, parsed.data.outcome)
      : parsed.data.action === "hangup-voicemail"
        ? callAncoraSessionStore.requestHangup(scope, "voicemail")
      : parsed.data.action === "hangup-call"
        ? callAncoraSessionStore.requestHangup(scope, "hangup")
      : parsed.data.action === "run-pause"
        ? callAncoraSessionStore.pauseRunForBroker(scope)
      : parsed.data.action === "run-resume"
        ? callAncoraSessionStore.resumeRunForBroker(scope)
      : parsed.data.action === "end"
        ? callAncoraSessionStore.endRunForBroker(scope)
      : parsed.data.action === "auto-dial"
        ? callAncoraSessionStore.setAutoDialEnabled(scope, parsed.data.enabled)
      : parsed.data.action === "pause"
        ? callAncoraSessionStore.pauseCountdown(scope)
        : callAncoraSessionStore.resumeCountdown(scope);
    if (!snapshot) return Response.json({ error: "A sessão mudou ou a ligação ainda não terminou. Atualize e tente de novo." }, { status: 409, headers: noStore });
    return Response.json({ session: snapshot }, { headers: noStore });
  } catch (error) {
    return authError(error);
  }
}
