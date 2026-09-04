import { NextRequest, NextResponse } from "next/server";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { and, eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getRequiredTenantContext();
    const { id } = await params;
    const db = getDatabase();

    const [template] = await db
      .select()
      .from(schema.metaWhatsAppTemplates)
      .where(
        and(
          eq(schema.metaWhatsAppTemplates.id, id),
          eq(schema.metaWhatsAppTemplates.tenantId, context.tenantId),
        ),
      )
      .limit(1);

    if (!template) {
      return NextResponse.json({ error: "Template não encontrado." }, { status: 404 });
    }

    const usages = await db
      .select({
        id: schema.metaWhatsAppTemplateUsages.id,
        eventKey: schema.metaWhatsAppTemplateUsages.eventKey,
        active: schema.metaWhatsAppTemplateUsages.active,
      })
      .from(schema.metaWhatsAppTemplateUsages)
      .where(
        and(
          eq(schema.metaWhatsAppTemplateUsages.templateId, id),
          eq(schema.metaWhatsAppTemplateUsages.tenantId, context.tenantId),
        ),
      );

    return NextResponse.json({ template, usages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar detalhes do template.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
