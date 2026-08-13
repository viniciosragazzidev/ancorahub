import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { CRM_EVENT_LABEL_MAP } from "@/features/communication-channels/template-sync-service";

const saveUsageSchema = z.object({
  eventKey: z.string().min(1),
  templateId: z.string().min(1),
  variableMappings: z.record(z.string(), z.string()).optional(),
  active: z.boolean().default(true),
});

export async function GET() {
  try {
    const context = await getRequiredTenantContext();
    const db = getDatabase();

    const usages = await db
      .select({
        id: schema.metaWhatsAppTemplateUsages.id,
        eventKey: schema.metaWhatsAppTemplateUsages.eventKey,
        templateId: schema.metaWhatsAppTemplateUsages.templateId,
        templateName: schema.metaWhatsAppTemplates.name,
        templateLanguage: schema.metaWhatsAppTemplates.language,
        templateStatus: schema.metaWhatsAppTemplates.status,
        variableMappingsJson: schema.metaWhatsAppTemplateUsages.variableMappingsJson,
        active: schema.metaWhatsAppTemplateUsages.active,
        updatedAt: schema.metaWhatsAppTemplateUsages.updatedAt,
      })
      .from(schema.metaWhatsAppTemplateUsages)
      .innerJoin(
        schema.metaWhatsAppTemplates,
        eq(schema.metaWhatsAppTemplateUsages.templateId, schema.metaWhatsAppTemplates.id),
      )
      .where(eq(schema.metaWhatsAppTemplateUsages.tenantId, context.tenantId));

    const eventsList = Object.entries(CRM_EVENT_LABEL_MAP).map(([key, label]) => {
      const activeMapping = usages.find((u) => u.eventKey === key && u.active);
      return {
        eventKey: key,
        label,
        mapping: activeMapping || null,
      };
    });

    return NextResponse.json({ events: eventsList, usages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar vínculos de templates.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getRequiredTenantContext();
    if (context.role === "broker") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const body = await request.json();
    const validated = saveUsageSchema.parse(body);
    const db = getDatabase();
    const now = new Date();

    const [existing] = await db
      .select({ id: schema.metaWhatsAppTemplateUsages.id })
      .from(schema.metaWhatsAppTemplateUsages)
      .where(
        and(
          eq(schema.metaWhatsAppTemplateUsages.tenantId, context.tenantId),
          eq(schema.metaWhatsAppTemplateUsages.eventKey, validated.eventKey),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(schema.metaWhatsAppTemplateUsages)
        .set({
          templateId: validated.templateId,
          variableMappingsJson: validated.variableMappings || {},
          active: validated.active,
          updatedAt: now,
        })
        .where(eq(schema.metaWhatsAppTemplateUsages.id, existing.id));
    } else {
      await db.insert(schema.metaWhatsAppTemplateUsages).values({
        id: randomUUID(),
        tenantId: context.tenantId,
        eventKey: validated.eventKey,
        templateId: validated.templateId,
        variableMappingsJson: validated.variableMappings || {},
        active: validated.active,
        createdAt: now,
        updatedAt: now,
      });
    }

    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "meta_whatsapp_template_usage",
      entidadeId: validated.eventKey,
      acao: "atualizou_vinculo_template_meta",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar vínculo de template.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
