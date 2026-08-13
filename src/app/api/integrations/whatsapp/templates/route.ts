import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import {
  createTenantTemplateInMeta,
  listTenantTemplates,
} from "@/features/communication-channels/template-sync-service";

const createTemplateSchema = z.object({
  name: z.string().min(1).max(512),
  language: z.string().default("pt_BR"),
  category: z.enum(["UTILITY", "MARKETING", "AUTHENTICATION"]),
  components: z.array(z.any()).min(1),
});

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

export async function POST(request: NextRequest) {
  try {
    const context = await getRequiredTenantContext();
    if (context.role === "broker") {
      return NextResponse.json({ error: "Acesso negado para esta operação." }, { status: 403 });
    }

    const body = await request.json();
    const validated = createTemplateSchema.parse(body);

    const result = await createTenantTemplateInMeta(
      context.tenantId,
      context.userId,
      validated,
    );

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar template na Meta.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
