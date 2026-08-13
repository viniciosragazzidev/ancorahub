import { NextResponse } from "next/server";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { syncTenantTemplates } from "@/features/communication-channels/template-sync-service";

export async function POST() {
  try {
    const context = await getRequiredTenantContext();
    if (context.role === "broker") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const result = await syncTenantTemplates(context.tenantId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao sincronizar templates com a Meta.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
