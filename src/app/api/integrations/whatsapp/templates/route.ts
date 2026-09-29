import { NextRequest, NextResponse } from "next/server";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { listTenantTemplates } from "@/features/communication-channels/template-sync-service";
import { z } from "zod";
import { createTenantTemplate } from "@/features/communication-channels/template-sync-service";

const componentSchema = z.object({
  type: z.enum(["HEADER", "BODY", "FOOTER", "BUTTONS"]),
  format: z.enum(["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT", "LOCATION"]).optional(),
  text: z.string().trim().max(1024).optional(),
  example: z.record(z.string(), z.unknown()).optional(),
  buttons: z.array(z.object({
    type: z.enum(["QUICK_REPLY", "URL", "PHONE_NUMBER", "FLOW"]),
    text: z.string().trim().min(1).max(25),
    url: z.string().url().optional(),
    phone_number: z.string().optional(),
  })).max(10).optional(),
});

const createSchema = z.object({
  name: z.string().trim().regex(/^[a-z0-9_]{3,512}$/),
  language: z.string().trim().regex(/^[a-z]{2}(?:_[A-Z]{2})?$/),
  category: z.enum(["UTILITY", "MARKETING", "AUTHENTICATION"]),
  components: z.array(componentSchema).min(1).max(10),
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
    if (context.role !== "director" && context.role !== "manager") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    const input = createSchema.parse(await request.json());
    const result = await createTenantTemplate(context.tenantId, context.userId, input);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar template na Meta.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
