"use server";


import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { AuthorizationError } from "@/shared/auth/errors";
import {
  getQualificationTenantSettings,
  updateQualificationTenantSettings,
  setQualificationEnabled,
  type UpdateTenantSettingsInput,
} from "./tenant-settings-service";
import {
  addTestNumber,
  getTenantTestNumbers,
  removeTestNumber,
  type AddTestNumberInput,
} from "./test-numbers-service";
import {
  resetQualificationSessionMemory,
  type ResetMemoryInput,
} from "./memory-reset-service";
import {
  sendWhatsAppTestMessage,
  type SendWhatsAppTestMessageInput,
} from "./whatsapp-diagnostic-service";
import {
  getFollowUpRules,
  saveFollowUpRule,
  deleteFollowUpRule,
  type FollowUpRuleInput,
} from "./followup-service";
import {
  getToolPermissions,
  updateToolPermission,
  type UpdateToolPermissionInput,
} from "./tool-governance-service";
import {
  getDestinationRules,
  saveDestinationRule,
  getBrokerEligibilityProfiles,
  saveBrokerEligibilityProfile,
  type DestinationRuleInput,
  type BrokerEligibilityInput,
} from "./destination-routing-service";
import { getQualificationStats } from "./stats-service";
import { acknowledgeAlert } from "./alerts-service";

function assertAdminRole(role: string | null | undefined) {
  if (role !== "director" && role !== "manager") {
    throw new AuthorizationError("Apenas diretores e gestores podem acessar a qualificação.");
  }
}

export async function fetchQualificationSettingsAction() {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  return getQualificationTenantSettings(context.tenantId);
}

export async function updateQualificationSettingsAction(input: UpdateTenantSettingsInput) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const result = await updateQualificationTenantSettings(context.tenantId, context.userId, input);
  return result;
}

export async function toggleQualificationEnabledAction(enabled: boolean) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  return setQualificationEnabled(context.tenantId, context.userId, enabled);
}

export async function fetchTestNumbersAction() {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  return getTenantTestNumbers(context.tenantId);
}

export async function addTestNumberAction(input: AddTestNumberInput) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const result = await addTestNumber(context.tenantId, context.userId, input);
  return result;
}

export async function removeTestNumberAction(id: string) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const result = await removeTestNumber(context.tenantId, context.userId, id);
  return result;
}

export async function resetMemoryAction(input: ResetMemoryInput) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const result = await resetQualificationSessionMemory(context.tenantId, context.userId, input);
  return result;
}

export async function sendWhatsAppTestMessageAction(input: SendWhatsAppTestMessageInput) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const result = await sendWhatsAppTestMessage(context.tenantId, context.userId, input);
  return result;
}

export async function fetchFollowUpRulesAction() {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  return getFollowUpRules(context.tenantId);
}

export async function saveFollowUpRuleAction(input: FollowUpRuleInput) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const result = await saveFollowUpRule(context.tenantId, context.userId, input);
  return result;
}

export async function deleteFollowUpRuleAction(ruleId: string) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const result = await deleteFollowUpRule(context.tenantId, context.userId, ruleId);
  return result;
}

export async function fetchToolPermissionsAction() {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  return getToolPermissions(context.tenantId);
}

export async function updateToolPermissionAction(input: UpdateToolPermissionInput) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const result = await updateToolPermission(context.tenantId, context.userId, input);
  return result;
}

export async function fetchDestinationRulesAction() {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  return getDestinationRules(context.tenantId);
}

export async function saveDestinationRuleAction(input: DestinationRuleInput) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const result = await saveDestinationRule(context.tenantId, context.userId, input);
  return result;
}

export async function fetchBrokerEligibilityProfilesAction() {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  return getBrokerEligibilityProfiles(context.tenantId);
}

export async function saveBrokerEligibilityProfileAction(input: BrokerEligibilityInput) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const result = await saveBrokerEligibilityProfile(context.tenantId, context.userId, input);
  return result;
}

export async function fetchQualificationStatsAction() {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  return getQualificationStats(context.tenantId);
}

export async function acknowledgeAlertAction(alertId: string) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const result = await acknowledgeAlert(context.tenantId, context.userId, alertId);
  return result;
}

export async function fetchMetaTemplatesAction() {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const { listTenantTemplates, syncTenantTemplates } = await import("@/features/communication-channels/template-sync-service");
  const { getDatabase, schema } = await import("@/shared/db");
  const { and, eq, isNull } = await import("drizzle-orm");

  const db = getDatabase();

  // Purge synthetic placeholder templates with wabaId = "waba_default"
  await db
    .delete(schema.metaWhatsAppTemplates)
    .where(
      and(
        eq(schema.metaWhatsAppTemplates.tenantId, context.tenantId),
        eq(schema.metaWhatsAppTemplates.wabaId, "waba_default")
      )
    )
    .catch(() => undefined);

  // Automatically sync real templates from Meta Graph API
  await syncTenantTemplates(context.tenantId).catch((err) => {
    console.warn("[fetchMetaTemplatesAction] auto-sync error:", err);
  });

  // Fetch all active usages for tenant
  const activeUsages = await db
    .select({
      templateId: schema.metaWhatsAppTemplateUsages.templateId,
      eventKey: schema.metaWhatsAppTemplateUsages.eventKey,
    })
    .from(schema.metaWhatsAppTemplateUsages)
    .where(
      and(
        eq(schema.metaWhatsAppTemplateUsages.tenantId, context.tenantId),
        eq(schema.metaWhatsAppTemplateUsages.active, true)
      )
    );

  const defaultUsage = activeUsages.find((u) => u.eventKey === "FIRST_CONTACT");
  const templates = await listTenantTemplates(context.tenantId);

  return templates.map((t) => {
    const assignedSituations = activeUsages
      .filter((u) => u.templateId === t.id)
      .map((u) => u.eventKey);

    return {
      ...t,
      assignedSituations,
      isDefault: defaultUsage ? t.id === defaultUsage.templateId : t.name === "lead_first_contact",
    };
  });
}

export async function setMetaTemplateSituationsAction(templateId: string, eventKeys: string[]) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const { getDatabase, schema } = await import("@/shared/db");
  const { and, eq, inArray } = await import("drizzle-orm");
  const { randomUUID } = await import("node:crypto");

  const db = getDatabase();
  const now = new Date();

  // 1. Fetch current active usages for this template
  const currentUsages = await db
    .select({
      id: schema.metaWhatsAppTemplateUsages.id,
      eventKey: schema.metaWhatsAppTemplateUsages.eventKey,
    })
    .from(schema.metaWhatsAppTemplateUsages)
    .where(
      and(
        eq(schema.metaWhatsAppTemplateUsages.tenantId, context.tenantId),
        eq(schema.metaWhatsAppTemplateUsages.templateId, templateId),
        eq(schema.metaWhatsAppTemplateUsages.active, true)
      )
    );

  const currentEventKeys = currentUsages.map((u) => u.eventKey);

  // 2. Deactivate usages that are no longer selected for this template
  const toDeactivate = currentEventKeys.filter((key) => !eventKeys.includes(key));
  if (toDeactivate.length > 0) {
    await db
      .update(schema.metaWhatsAppTemplateUsages)
      .set({ active: false, updatedAt: now })
      .where(
        and(
          eq(schema.metaWhatsAppTemplateUsages.tenantId, context.tenantId),
          eq(schema.metaWhatsAppTemplateUsages.templateId, templateId),
          inArray(schema.metaWhatsAppTemplateUsages.eventKey, toDeactivate)
        )
      );
  }

  // 3. Upsert / Activate usages for selected eventKeys
  for (const eventKey of eventKeys) {
    const [existingForEvent] = await db
      .select({ id: schema.metaWhatsAppTemplateUsages.id, templateId: schema.metaWhatsAppTemplateUsages.templateId })
      .from(schema.metaWhatsAppTemplateUsages)
      .where(
        and(
          eq(schema.metaWhatsAppTemplateUsages.tenantId, context.tenantId),
          eq(schema.metaWhatsAppTemplateUsages.eventKey, eventKey)
        )
      )
      .limit(1);

    if (existingForEvent) {
      await db
        .update(schema.metaWhatsAppTemplateUsages)
        .set({
          templateId,
          active: true,
          updatedAt: now,
        })
        .where(eq(schema.metaWhatsAppTemplateUsages.id, existingForEvent.id));
    } else {
      await db.insert(schema.metaWhatsAppTemplateUsages).values({
        id: `usage_${randomUUID()}`,
        tenantId: context.tenantId,
        eventKey,
        templateId,
        active: true,
        variableMappingsJson: {},
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // 4. Audit Log
  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: context.userId,
    entidade: "meta_whatsapp_template_usage",
    entidadeId: templateId,
    acao: "vinculou_situacoes_template_meta",
  });

  return { success: true };
}

export async function setDefaultMetaTemplateAction(templateId: string) {
  return setMetaTemplateSituationsAction(templateId, ["FIRST_CONTACT"]);
}

export async function deleteMetaTemplateAction(templateId: string) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const { getDatabase, schema } = await import("@/shared/db");
  const { and, eq } = await import("drizzle-orm");

  const db = getDatabase();
  await db
    .update(schema.metaWhatsAppTemplates)
    .set({ deletedAt: new Date(), status: "DELETED", updatedAt: new Date() })
    .where(
      and(
        eq(schema.metaWhatsAppTemplates.tenantId, context.tenantId),
        eq(schema.metaWhatsAppTemplates.id, templateId)
      )
    );

  return { success: true };
}

export async function syncMetaTemplatesAction() {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const { syncTenantTemplates } = await import("@/features/communication-channels/template-sync-service");
  await syncTenantTemplates(context.tenantId).catch(() => undefined);
  return { success: true };
}

/* ─── Modelos Livres (Janela de 24 Horas / Sem Aprovação) ─── */

export async function fetchFreeMessageTemplatesAction() {
  const context = await getRequiredTenantContext();
  const { getDatabase, schema } = await import("@/shared/db");
  const { and, desc, eq } = await import("drizzle-orm");

  const db = getDatabase();
  const rows = await db
    .select({
      id: schema.messageTemplates.id,
      name: schema.messageTemplates.name,
      category: schema.messageTemplates.category,
      content: schema.messageTemplates.content,
      variables: schema.messageTemplates.variables,
      active: schema.messageTemplates.active,
      createdAt: schema.messageTemplates.createdAt,
      updatedAt: schema.messageTemplates.updatedAt,
    })
    .from(schema.messageTemplates)
    .where(
      and(
        eq(schema.messageTemplates.tenantId, context.tenantId),
        eq(schema.messageTemplates.active, true)
      )
    )
    .orderBy(desc(schema.messageTemplates.updatedAt));

  return rows;
}

export async function saveFreeMessageTemplateAction(input: {
  id?: string;
  name: string;
  category: string;
  content: string;
}) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const { getDatabase, schema } = await import("@/shared/db");
  const { and, eq } = await import("drizzle-orm");
  const { randomUUID } = await import("node:crypto");

  const name = input.name.trim();
  const category = input.category.trim() || "geral";
  const content = input.content.trim();

  if (!name || name.length < 2) {
    throw new Error("Nome do modelo deve ter pelo menos 2 caracteres.");
  }

  if (!content || content.length < 3) {
    throw new Error("Conteúdo da mensagem deve ter pelo menos 3 caracteres.");
  }

  // Extract variables {{variable}}
  const varMatches = content.match(/\{\{([^}]+)\}\}/g) || [];
  const variables = Array.from(new Set(varMatches.map((v) => v.replace(/[\{\}]/g, "").trim())));

  const db = getDatabase();
  const now = new Date();

  if (input.id) {
    const [existing] = await db
      .select({ id: schema.messageTemplates.id })
      .from(schema.messageTemplates)
      .where(
        and(
          eq(schema.messageTemplates.id, input.id),
          eq(schema.messageTemplates.tenantId, context.tenantId)
        )
      )
      .limit(1);

    if (!existing) {
      throw new Error("Modelo não encontrado.");
    }

    await db
      .update(schema.messageTemplates)
      .set({
        name,
        category,
        content,
        variables,
        updatedAt: now,
      })
      .where(eq(schema.messageTemplates.id, existing.id));

    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "message_template",
      entidadeId: existing.id,
      acao: "atualizou_modelo_mensagem_livre",
    });

    return { success: true, id: existing.id };
  } else {
    const newId = randomUUID();
    await db.insert(schema.messageTemplates).values({
      id: newId,
      tenantId: context.tenantId,
      name,
      category,
      content,
      variables,
      active: true,
      createdBy: context.userId,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "message_template",
      entidadeId: newId,
      acao: "criou_modelo_mensagem_livre",
    });

    return { success: true, id: newId };
  }
}

export async function deleteFreeMessageTemplateAction(templateId: string) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const { getDatabase, schema } = await import("@/shared/db");
  const { and, eq } = await import("drizzle-orm");
  const { randomUUID } = await import("node:crypto");

  const db = getDatabase();
  await db
    .update(schema.messageTemplates)
    .set({ active: false, updatedAt: new Date() })
    .where(
      and(
        eq(schema.messageTemplates.id, templateId),
        eq(schema.messageTemplates.tenantId, context.tenantId)
      )
    );

  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: context.userId,
    entidade: "message_template",
    entidadeId: templateId,
    acao: "removeu_modelo_mensagem_livre",
  });

  return { success: true };
}

export async function fetchSituationalPlaybooksAction() {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const { getTenantPlaybooks } = await import("./playbooks-storage");
  return getTenantPlaybooks(context.tenantId);
}

export async function saveSituationalPlaybooksAction(playbooks: any[]) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const { saveTenantPlaybooks } = await import("./playbooks-storage");
  const { SituationalPlaybookItemSchema } = await import("./situations-catalog");
  const { getDatabase, schema } = await import("@/shared/db");
  const { randomUUID } = await import("node:crypto");

  const validated = playbooks.map((p) => SituationalPlaybookItemSchema.parse(p));
  await saveTenantPlaybooks(context.tenantId, validated);

  const db = getDatabase();
  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: context.userId,
    entidade: "ai_qualification_configs",
    entidadeId: context.tenantId,
    acao: "atualizou_roteiros_situacionais_ia",
  });

  return { success: true };
}

export async function resetSituationalPlaybooksAction() {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const { saveTenantPlaybooks } = await import("./playbooks-storage");
  const { getDefaultPlaybooks } = await import("./situations-catalog");
  const { getDatabase, schema } = await import("@/shared/db");
  const { randomUUID } = await import("node:crypto");

  const defaults = getDefaultPlaybooks();
  await saveTenantPlaybooks(context.tenantId, defaults);

  const db = getDatabase();
  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: context.userId,
    entidade: "ai_qualification_configs",
    entidadeId: context.tenantId,
    acao: "restaurou_roteiros_situacionais_ia_padrao",
  });

  return { success: true, playbooks: defaults };
}

