import { NextRequest, NextResponse } from "next/server";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { listTenantTemplates } from "@/features/communication-channels/template-sync-service";

export async function GET(request: NextRequest) {
  try {
    const context = await getRequiredTenantContext();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") ?? undefined;
    const category = searchParams.get("category") ?? undefined;
    const search = searchParams.get("search") ?? undefined;

    const templates = await listTenantTemplates(context.tenantId, {
      status,
      category,
      search,
    });

    return NextResponse.json({ templates });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar templates.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
