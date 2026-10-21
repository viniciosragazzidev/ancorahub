"use server";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createTenantTemplate, resolveMetaChannelCredentials } from "@/features/communication-channels/template-sync-service";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { getTurboSettings, saveTurboSettings, type TurboSettings } from "./service";
import { RECOMMENDED_TEMPLATES, toMetaTemplatePayload } from "./templates-pack";

export type TurboTemplateRow = {
  name: string;
  label: string;
  touch: string;
  expectedCategory: string;
  /** Status at Meta, or "MISSING" when it was never submitted. */
  status: string;
  category: string | null;
  quality: string | null;
  rejectedReason: string | null;
  body: string;
  buttons: string[];
};

export type TurboAdminData = {
  settings: TurboSettings;
  templates: TurboTemplateRow[];
  metaConnected: boolean;
  canEdit: boolean;
};

async function requireDirector() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") throw new Error("Só o diretor altera a qualificação turbo.");
  return context;
}

export async function getTurboAdminData(): Promise<TurboAdminData> {
  const context = await getRequiredTenantContext();
  const settings = await getTurboSettings(context.tenantId);
  const credentials = await resolveMetaChannelCredentials(context.tenantId).catch(() => null);
  const rows = credentials
    ? await getDatabase().select({
      name: schema.metaWhatsAppTemplates.name,
      status: schema.metaWhatsAppTemplates.status,
      category: schema.metaWhatsAppTemplates.category,
      quality: schema.metaWhatsAppTemplates.qualityRating,
      rejectedReason: schema.metaWhatsAppTemplates.rejectedReason,
    }).from(schema.metaWhatsAppTemplates).where(and(
      eq(schema.metaWhatsAppTemplates.tenantId, context.tenantId),
      eq(schema.metaWhatsAppTemplates.wabaId, credentials.wabaId),
      inArray(schema.metaWhatsAppTemplates.name, RECOMMENDED_TEMPLATES.map((template) => template.name)),
      isNull(schema.metaWhatsAppTemplates.deletedAt),
    ))
    : [];
  const byName = new Map(rows.map((row) => [row.name, row]));
  return {
    settings,
    metaConnected: Boolean(credentials),
    canEdit: context.role === "director",
    templates: RECOMMENDED_TEMPLATES.map((template) => {
      const row = byName.get(template.name);
      return {
        name: template.name,
        label: template.label,
        touch: template.touch,
        expectedCategory: template.category,
        status: row?.status ?? "MISSING",
        category: row?.category ?? null,
        quality: row?.quality ?? null,
        rejectedReason: row?.rejectedReason ?? null,
        body: template.body,
        buttons: template.buttons,
      };
    }),
  };
}

/** Submits the recommended templates that are not at Meta yet (or only the given ones). */
export async function submitRecommendedTemplatesAction(names?: string[]) {
  try {
    const context = await requireDirector();
    const current = await getTurboAdminData();
    const wanted = new Set(names?.length ? names : RECOMMENDED_TEMPLATES.map((template) => template.name));
    const toSubmit = RECOMMENDED_TEMPLATES.filter((template) => wanted.has(template.name)
      && ["MISSING", "REJECTED"].includes(current.templates.find((row) => row.name === template.name)?.status ?? "MISSING"));
    if (!toSubmit.length) return { success: true as const, submitted: [], failed: [] };

    const submitted: string[] = [];
    const failed: Array<{ name: string; error: string }> = [];
    for (const template of toSubmit) {
      try {
        await createTenantTemplate(context.tenantId, context.userId, toMetaTemplatePayload(template));
        submitted.push(template.name);
      } catch (error) {
        failed.push({ name: template.name, error: error instanceof Error ? error.message.slice(0, 200) : "Erro na Meta" });
      }
    }
    await getDatabase().insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "qualification_turbo",
      entidadeId: context.tenantId,
      acao: `templates_submitted:${submitted.length}:${failed.length}`,
      createdAt: new Date(),
    });
    revalidatePath("/qualificacao/turbo");
    return { success: true as const, submitted, failed };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Não foi possível enviar os templates." };
  }
}

const settingsSchema = z.object({
  enabled: z.boolean(),
  cadence: z.boolean(),
  learn: z.boolean(),
  companyDisplayName: z.string().trim().max(60),
});

export async function updateTurboSettingsAction(input: TurboSettings) {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Configuração inválida." };
  try {
    const context = await requireDirector();
    await saveTurboSettings(context.tenantId, parsed.data);
    await getDatabase().insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "qualification_turbo",
      entidadeId: context.tenantId,
      acao: `settings_updated:${parsed.data.enabled ? "on" : "off"}:${parsed.data.cadence ? "cadence" : "no_cadence"}:${parsed.data.learn ? "learn" : "fixed"}`,
      createdAt: new Date(),
    });
    revalidatePath("/qualificacao/turbo");
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Não foi possível salvar." };
  }
}
