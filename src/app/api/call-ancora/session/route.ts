import { z } from "zod";

import { AuthenticationError, AuthorizationError } from "@/shared/auth/errors";
import { requireCallAncoraAccess } from "@/features/call-ancora/access";
import { CALL_ANCORA_PAIR_TTL_MS, callAncoraSessionStore } from "@/features/call-ancora/session-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("classify"), outcome: z.enum(["interested", "not_interested"]) }),
  z.object({ action: z.literal("pause") }),
  z.object({ action: z.literal("resume") }),
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
    if (!parsed.success) return Response.json({ error: "Não reconheci o início da demonstração." }, { status: 400, headers: noStore });
    const started = callAncoraSessionStore.create({ tenantId: context.tenantId, brokerId: sessionOwnerId }, brokerName, { flagBypass });
    return Response.json({ ...started, pairExpiresAt: Date.now() + CALL_ANCORA_PAIR_TTL_MS }, { headers: noStore });
  } catch (error) {
    return authError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { context, sessionOwnerId } = await requireCallAncoraAccess();
    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Essa ação não é válida para a demonstração." }, { status: 400, headers: noStore });
    const scope = { tenantId: context.tenantId, brokerId: sessionOwnerId };
    const snapshot = parsed.data.action === "classify"
      ? callAncoraSessionStore.classify(scope, parsed.data.outcome)
      : parsed.data.action === "pause"
        ? callAncoraSessionStore.pauseCountdown(scope)
        : callAncoraSessionStore.resumeCountdown(scope);
    if (!snapshot) return Response.json({ error: "A sessão mudou ou a ligação ainda não terminou. Atualize e tente de novo." }, { status: 409, headers: noStore });
    return Response.json({ session: snapshot }, { headers: noStore });
  } catch (error) {
    return authError(error);
  }
}
