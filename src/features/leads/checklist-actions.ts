"use server";

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

/* ─── Types ─── */

export type ChecklistTemplateWithItems = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  items: Array<{
    id: string;
    sortOrder: number;
    question: string;
    answerType: string;
    options: unknown;
    required: boolean;
  }>;
};

/* ─── Schemas ─── */

const itemSchema = z.object({
  question: z.string().trim().min(1, "A pergunta é obrigatória.").max(500),
  answerType: z.enum(["boolean", "rating", "text", "select"]).default("boolean"),
  options: z.array(z.string()).optional(),
  required: z.boolean().default(true),
});

const templateSchema = z.object({
  name: z.string().trim().min(1, "O nome é obrigatório.").max(200),
  description: z.string().trim().max(500).optional(),
  items: z.array(itemSchema).min(1, "Adicione pelo menos uma pergunta."),
});

/* ─── List templates ─── */

export async function listChecklistTemplatesAction(): Promise<ChecklistTemplateWithItems[]> {
  const context = await getRequiredTenantContext();
  if (context.role === "broker") throw new Error("Apenas Gestores e Diretores podem gerenciar checklists.");

  const db = getDatabase();
  const templates = await db
    .select()
    .from(schema.feedbackChecklistTemplates)
    .where(eq(schema.feedbackChecklistTemplates.tenantId, context.tenantId))
    .orderBy(desc(schema.feedbackChecklistTemplates.createdAt));

  if (!templates.length) return [];

  const allTemplateItems = await db
    .select()
    .from(schema.feedbackChecklistItems)
    .where(eq(schema.feedbackChecklistItems.tenantId, context.tenantId))
    .orderBy(asc(schema.feedbackChecklistItems.sortOrder));

  const itemsByTemplate = new Map<string, typeof allTemplateItems>();
  for (const item of allTemplateItems) {
    const list = itemsByTemplate.get(item.templateId) ?? [];
    list.push(item);
    itemsByTemplate.set(item.templateId, list);
  }

  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    active: t.active,
    items: (itemsByTemplate.get(t.id) ?? []).map((i) => ({
      id: i.id,
      sortOrder: i.sortOrder,
      question: i.question,
      answerType: i.answerType,
      options: i.options,
      required: i.required,
    })),
  }));
}

/* ─── Create template ─── */

export type ChecklistFormState = { success?: boolean; error?: string };

export async function createChecklistTemplateAction(
  _prev: ChecklistFormState,
  formData: FormData,
): Promise<ChecklistFormState> {
  const context = await getRequiredTenantContext();
  if (context.role === "broker") return { error: "Apenas Gestores e Diretores podem criar checklists." };

  try {
    const raw = {
      name: formData.get("name"),
      description: String(formData.get("description") ?? "") || undefined,
      items: JSON.parse(String(formData.get("items") ?? "[]")),
    };

    const parsed = templateSchema.safeParse(raw);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

    const db = getDatabase();
    const templateId = randomUUID();
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx.insert(schema.feedbackChecklistTemplates).values({
        id: templateId,
        tenantId: context.tenantId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        active: true,
        createdBy: context.userId,
        createdAt: now,
        updatedAt: now,
      });

      if (parsed.data.items.length) {
        await tx.insert(schema.feedbackChecklistItems).values(
          parsed.data.items.map((item, index) => ({
            id: randomUUID(),
            templateId,
            tenantId: context.tenantId,
            sortOrder: index,
            question: item.question,
            answerType: item.answerType,
            options: item.answerType === "select" ? (item.options ?? []) : null,
            required: item.required,
            createdAt: now,
          })),
        );
      }
    });

    revalidatePath("/settings/feedback-templates");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erro ao criar template." };
  }
}

/* ─── Toggle template active ─── */

export async function toggleChecklistTemplateAction(
  _prev: ChecklistFormState,
  formData: FormData,
): Promise<ChecklistFormState> {
  const context = await getRequiredTenantContext();
  if (context.role === "broker") return { error: "Apenas Gestores e Diretores podem gerenciar checklists." };

  const templateId = String(formData.get("templateId") ?? "");
  try {
    const db = getDatabase();
    const [template] = await db
      .select({ id: schema.feedbackChecklistTemplates.id, active: schema.feedbackChecklistTemplates.active })
      .from(schema.feedbackChecklistTemplates)
      .where(
        and(
          eq(schema.feedbackChecklistTemplates.id, templateId),
          eq(schema.feedbackChecklistTemplates.tenantId, context.tenantId),
        ),
      )
      .limit(1);

    if (!template) return { error: "Template não encontrado." };

    await db
      .update(schema.feedbackChecklistTemplates)
      .set({ active: !template.active, updatedAt: new Date() })
      .where(eq(schema.feedbackChecklistTemplates.id, templateId));

    revalidatePath("/settings/feedback-templates");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erro ao atualizar template." };
  }
}

/* ─── Delete template ─── */

export async function deleteChecklistTemplateAction(
  _prev: ChecklistFormState,
  formData: FormData,
): Promise<ChecklistFormState> {
  const context = await getRequiredTenantContext();
  if (context.role === "broker") return { error: "Apenas Gestores e Diretores podem gerenciar checklists." };

  const templateId = String(formData.get("templateId") ?? "");
  try {
    const db = getDatabase();
    await db
      .delete(schema.feedbackChecklistTemplates)
      .where(
        and(
          eq(schema.feedbackChecklistTemplates.id, templateId),
          eq(schema.feedbackChecklistTemplates.tenantId, context.tenantId),
        ),
      );

    revalidatePath("/settings/feedback-templates");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erro ao excluir template." };
  }
}

/* ─── Get active template (for brokers) ─── */

export async function getActiveChecklistTemplatesAction(): Promise<ChecklistTemplateWithItems[]> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const templates = await db
    .select()
    .from(schema.feedbackChecklistTemplates)
    .where(
      and(
        eq(schema.feedbackChecklistTemplates.tenantId, context.tenantId),
        eq(schema.feedbackChecklistTemplates.active, true),
      ),
    )
    .orderBy(asc(schema.feedbackChecklistTemplates.createdAt))
    .limit(1);

  if (!templates.length) return [];

  const items = await db
    .select()
    .from(schema.feedbackChecklistItems)
    .where(
      and(
        eq(schema.feedbackChecklistItems.templateId, templates[0].id),
        eq(schema.feedbackChecklistItems.tenantId, context.tenantId),
      ),
    )
    .orderBy(asc(schema.feedbackChecklistItems.sortOrder));

  return [
    {
      id: templates[0].id,
      name: templates[0].name,
      description: templates[0].description,
      active: templates[0].active,
      items: items.map((i) => ({
        id: i.id,
        sortOrder: i.sortOrder,
        question: i.question,
        answerType: i.answerType,
        options: i.options,
        required: i.required,
      })),
    },
  ];
}
