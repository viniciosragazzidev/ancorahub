import { requireCallAncoraDirectorAccess } from "@/features/call-ancora/director-access";
import { readCallAncoraSettings, writeCallAncoraSettings } from "@/features/call-ancora/settings";
import { callAncoraSettingsSchema } from "@/features/call-ancora/settings-rules";
import { AuthenticationError } from "@/shared/auth/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store, max-age=0" };

function failure(error: unknown) {
  if (error instanceof AuthenticationError) return Response.json({ error: "Faça login para abrir o Call Âncora." }, { status: 401, headers: noStore });
  console.error("Configurações do Call Âncora indisponíveis", error instanceof Error ? error.message : "erro inesperado");
  return Response.json({ error: "Não foi possível carregar as configurações. Tente novamente." }, { status: 500, headers: noStore });
}

export async function GET() {
  try {
    const context = await requireCallAncoraDirectorAccess();
    if (!context) return Response.json({ error: "Só o diretor configura o Call Âncora." }, { status: 403, headers: noStore });
    return Response.json({ settings: await readCallAncoraSettings(context.tenantId) }, { headers: noStore });
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireCallAncoraDirectorAccess();
    if (!context) return Response.json({ error: "Só o diretor configura o Call Âncora." }, { status: 403, headers: noStore });
    const parsed = callAncoraSettingsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? "Confira os valores." }, { status: 400, headers: noStore });
    }
    await writeCallAncoraSettings(context.tenantId, parsed.data);
    return Response.json({ settings: parsed.data }, { headers: noStore });
  } catch (error) {
    return failure(error);
  }
}
