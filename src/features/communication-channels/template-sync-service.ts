import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, notInArray, isNull, sql } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { decryptChannelSecret } from "./secret-crypto";
import { getMetaCloudServerConfig } from "./meta-cloud-config";
import { META_CLOUD_PROVIDER } from "./types";
import {
  createWabaMessageTemplate,
  deleteWabaMessageTemplateByName,
  fetchWabaMessageTemplates,
  sendMetaCloudTemplateTest,
  type MetaGraphTemplateComponent,
  type MetaGraphTemplateItem,
  type MetaTemplateCategory,
} from "./meta-graph-templates-client";
import { META_WHATSAPP_TEMPLATE_PURPOSES, type MetaWhatsAppTemplatePurpose } from "./templates";

export type EventKey =
  | "BROKER_WELCOME"
  | "LEAD_ASSIGNMENT"
  | "LEAD_OFFER"
  | "LEAD_ASSIGNMENT_CONFIRMED"
  | "LEAD_ASSIGNMENT_UNAVAILABLE"
  | "LEAD_ASSIGNMENT_EXPIRED"
  | "QUOTE_READY"
  | "TASK_REMINDER"
  | "CLIENT_NOTICE";

export const CRM_EVENT_LABEL_MAP: Record<EventKey, string> = {
  BROKER_WELCOME: "Cadastro de Corretor / Primeiro Acesso",
  LEAD_ASSIGNMENT: "Novo Lead Atribuído",
  LEAD_OFFER: "Oferta de Lead para Aceite",
  LEAD_ASSIGNMENT_CONFIRMED: "Confirmação de Aceite pelo Corretor",
  LEAD_ASSIGNMENT_UNAVAILABLE: "Lead Indisponível / Já Resgatado",
  LEAD_ASSIGNMENT_EXPIRED: "Expiração de Fila de Plantão",
  QUOTE_READY: "Cotação / Proposta Concluída",
  TASK_REMINDER: "Lembrete de Tarefa Comercial",
  CLIENT_NOTICE: "Aviso Geral ao Cliente",
};

export async function resolveMetaChannelCredentials(tenantId: string) {
  const db = getDatabase();
  const [channel] = await db
    .select({
      id: schema.communicationChannels.id,
      wabaId: schema.communicationChannels.wabaId,
      phoneNumberId: schema.communicationChannels.phoneNumberId,
      displayPhoneNumber: schema.communicationChannels.displayPhoneNumber,
      accessTokenCiphertext: schema.communicationChannels.accessTokenCiphertext,
      status: schema.communicationChannels.status,
      registrationStatus: schema.communicationChannels.registrationStatus,
    })
    .from(schema.communicationChannels)
    .where(
      and(
        eq(schema.communicationChannels.tenantId, tenantId),
        inArray(schema.communicationChannels.provider, [META_CLOUD_PROVIDER, "meta_cloud_api", "meta_cloud"]),
        eq(schema.communicationChannels.status, "active"),
      ),
    )
    .orderBy(desc(schema.communicationChannels.isDefault), desc(schema.communicationChannels.createdAt))
    .limit(1);

  if (!channel || !channel.wabaId || !channel.accessTokenCiphertext) {
    throw new Error("Nenhum canal corporativo ativo do WhatsApp foi configurado para este tenant.");
  }

  const encryptionKey =
    process.env.META_WHATSAPP_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.INVITATION_TOKEN_ENCRYPTION_KEY?.trim() ||
    getMetaCloudServerConfig().tokenEncryptionKey;
  if (!encryptionKey) {
    throw new Error("Chave de criptografia de tokens do WhatsApp não configurada.");
  }

  const accessToken = decryptChannelSecret(channel.accessTokenCiphertext, encryptionKey);
  return {
    channelId: channel.id,
    wabaId: channel.wabaId,
    phoneNumberId: channel.phoneNumberId,
    displayPhoneNumber: channel.displayPhoneNumber,
    accessToken,
  };
}

function parseComponents(components: MetaGraphTemplateComponent[] = []) {
  let headerType = "NONE";
  let bodyText = "";
  let footerText = "";
  const variables: string[] = [];
  const buttons: any[] = [];

  for (const c of components) {
    if (c.type === "HEADER") {
      headerType = c.format || "TEXT";
      if (c.text) bodyText += c.text + " ";
    } else if (c.type === "BODY") {
      if (c.text) {
        bodyText += c.text;
        const matches = c.text.match(/\{\{(\d+|[a-zA-Z0-9_]+)\}\}/g);
        if (matches) {
          matches.forEach((m) => {
            const v = m.replace(/[\{\}]/g, "");
            if (!variables.includes(v)) variables.push(v);
          });
        }
      }
    } else if (c.type === "FOOTER") {
      footerText = c.text || "";
    } else if (c.type === "BUTTONS" && c.buttons) {
      c.buttons.forEach((b) => buttons.push(b));
    }
  }

  return { headerType, bodyText: bodyText.trim(), footerText, variables, buttons };
}

export async function syncTenantTemplates(tenantId: string) {
  const db = getDatabase();
  const credentials = await resolveMetaChannelCredentials(tenantId);
  const { data: remoteTemplates } = await fetchWabaMessageTemplates(
    credentials.wabaId,
    credentials.accessToken,
  );

  const now = new Date();
  const remoteMetaIds = new Set<string>();

  for (const t of remoteTemplates) {
    remoteMetaIds.add(t.name);
    const parsed = parseComponents(t.components);

    const [existing] = await db
      .select({ id: schema.metaWhatsAppTemplates.id })
      .from(schema.metaWhatsAppTemplates)
      .where(
        and(
          eq(schema.metaWhatsAppTemplates.tenantId, tenantId),
          eq(schema.metaWhatsAppTemplates.wabaId, credentials.wabaId),
          eq(schema.metaWhatsAppTemplates.name, t.name),
          eq(schema.metaWhatsAppTemplates.language, t.language),
        ),
      )
      .limit(1);

    const values = {
      tenantId,
      wabaId: credentials.wabaId,
      metaTemplateId: t.id,
      name: t.name,
      language: t.language,
      category: t.category as MetaTemplateCategory,
      status: t.status,
      qualityRating: t.quality_score?.score ?? "UNKNOWN",
      componentsJson: (t.components as any) ?? [],
      headerType: parsed.headerType,
      bodyText: parsed.bodyText,
      footerText: parsed.footerText,
      variablesJson: parsed.variables,
      buttonsJson: parsed.buttons,
      origin: existing ? undefined : "META",
      rejectedReason: t.rejected_reason ?? null,
      lastSyncedAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    if (existing) {
      await db
        .update(schema.metaWhatsAppTemplates)
        .set(values)
        .where(eq(schema.metaWhatsAppTemplates.id, existing.id));
    } else {
      await db.insert(schema.metaWhatsAppTemplates).values({
        id: randomUUID(),
        ...values,
        createdAt: now,
      });
    }
  }

  // Mark local templates not returned by Meta as soft deleted
  if (remoteMetaIds.size > 0) {
    const names = Array.from(remoteMetaIds);
    await db
      .update(schema.metaWhatsAppTemplates)
      .set({ deletedAt: now, status: "DELETED", updatedAt: now })
      .where(
        and(
          eq(schema.metaWhatsAppTemplates.tenantId, tenantId),
          eq(schema.metaWhatsAppTemplates.wabaId, credentials.wabaId),
          isNull(schema.metaWhatsAppTemplates.deletedAt),
          notInArray(schema.metaWhatsAppTemplates.name, names)
        ),
      );
  }

  return { syncedCount: remoteTemplates.length, syncedAt: now };
}

export async function listTenantTemplates(
  tenantId: string,
  filters?: { status?: string; category?: string; search?: string },
) {
  const db = getDatabase();
  const conditions = [
    eq(schema.metaWhatsAppTemplates.tenantId, tenantId),
    isNull(schema.metaWhatsAppTemplates.deletedAt),
  ];

  if (filters?.status && filters.status !== "ALL") {
    conditions.push(eq(schema.metaWhatsAppTemplates.status, filters.status));
  }
  if (filters?.category && filters.category !== "ALL") {
    conditions.push(eq(schema.metaWhatsAppTemplates.category, filters.category));
  }

  const templates = await db
    .select()
    .from(schema.metaWhatsAppTemplates)
    .where(and(...conditions))
    .orderBy(sql`${schema.metaWhatsAppTemplates.name} ASC`);

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.bodyText && t.bodyText.toLowerCase().includes(q)),
    );
  }

  return templates;
}

export async function createTenantTemplateInMeta(
  tenantId: string,
  userId: string,
  input: {
    name: string;
    language: string;
    category: MetaTemplateCategory;
    components: MetaGraphTemplateComponent[];
  },
) {
  const db = getDatabase();
  const credentials = await resolveMetaChannelCredentials(tenantId);
  const formattedName = input.name.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");

  if (!formattedName) throw new Error("Nome de template inválido. Use caracteres alfanuméricos e _.");

  const metaResult = await createWabaMessageTemplate(
    credentials.wabaId,
    credentials.accessToken,
    {
      name: formattedName,
      language: input.language || "pt_BR",
      category: input.category,
      components: input.components,
    },
  );

  const parsed = parseComponents(input.components);
  const id = randomUUID();
  const now = new Date();

  await db.insert(schema.metaWhatsAppTemplates).values({
    id,
    tenantId,
    wabaId: credentials.wabaId,
    metaTemplateId: metaResult.id,
    name: formattedName,
    language: input.language || "pt_BR",
    category: input.category,
    status: metaResult.status || "PENDING",
    componentsJson: input.components as any,
    headerType: parsed.headerType,
    bodyText: parsed.bodyText,
    footerText: parsed.footerText,
    variablesJson: parsed.variables,
    buttonsJson: parsed.buttons,
    origin: "CRM",
    lastSyncedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId,
    entidade: "meta_whatsapp_template",
    entidadeId: id,
    acao: "criou_template_meta",
  });

  return { id, metaTemplateId: metaResult.id, name: formattedName, status: metaResult.status || "PENDING" };
}

export async function deleteTenantTemplateFromMeta(
  tenantId: string,
  userId: string,
  templateId: string,
) {
  const db = getDatabase();
  const [template] = await db
    .select()
    .from(schema.metaWhatsAppTemplates)
    .where(
      and(
        eq(schema.metaWhatsAppTemplates.id, templateId),
        eq(schema.metaWhatsAppTemplates.tenantId, tenantId),
      ),
    )
    .limit(1);

  if (!template) throw new Error("Template não encontrado.");

  // Check active usage bindings before deleting
  const [activeUsage] = await db
    .select({ id: schema.metaWhatsAppTemplateUsages.id, eventKey: schema.metaWhatsAppTemplateUsages.eventKey })
    .from(schema.metaWhatsAppTemplateUsages)
    .where(
      and(
        eq(schema.metaWhatsAppTemplateUsages.templateId, templateId),
        eq(schema.metaWhatsAppTemplateUsages.tenantId, tenantId),
        eq(schema.metaWhatsAppTemplateUsages.active, true),
      ),
    )
    .limit(1);

  if (activeUsage) {
    const eventName = CRM_EVENT_LABEL_MAP[activeUsage.eventKey as EventKey] || activeUsage.eventKey;
    throw new Error(`Não é possível excluir o template pois ele está ativo no evento '${eventName}'. Remova o vínculo primeiro.`);
  }

  const credentials = await resolveMetaChannelCredentials(tenantId);
  await deleteWabaMessageTemplateByName(credentials.wabaId, credentials.accessToken, template.name);

  const now = new Date();
  await db
    .update(schema.metaWhatsAppTemplates)
    .set({ deletedAt: now, status: "DELETED", updatedAt: now })
    .where(eq(schema.metaWhatsAppTemplates.id, templateId));

  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId,
    entidade: "meta_whatsapp_template",
    entidadeId: templateId,
    acao: "excluiu_template_meta",
  });

  return { success: true };
}

export async function sendTenantTemplateTestMessage(
  tenantId: string,
  userId: string,
  templateId: string,
  destinationPhone: string,
  variables?: string[],
) {
  const db = getDatabase();
  const [template] = await db
    .select()
    .from(schema.metaWhatsAppTemplates)
    .where(
      and(
        eq(schema.metaWhatsAppTemplates.id, templateId),
        eq(schema.metaWhatsAppTemplates.tenantId, tenantId),
      ),
    )
    .limit(1);

  if (!template) throw new Error("Template não encontrado.");
  if (template.status !== "APPROVED") {
    throw new Error("Apenas templates em status 'APPROVED' podem ser enviados para teste.");
  }

  const credentials = await resolveMetaChannelCredentials(tenantId);
  if (!credentials.phoneNumberId) throw new Error("Número de telefone não configurado na conexão.");

  const components: any[] = [];
  if (variables && variables.length > 0) {
    const rawComponents = (template.componentsJson as any[]) || [];
    const bodyComp = rawComponents.find((c: any) => c.type === "BODY" || c.type === "body");
    const namedParams = bodyComp?.example?.body_text_named_params as Array<{ param_name: string }> | undefined;

    if (namedParams && namedParams.length > 0) {
      components.push({
        type: "body",
        parameters: variables.map((v, i) => ({
          type: "text",
          parameter_name: namedParams[i]?.param_name || String(i + 1),
          text: v,
        })),
      });
    } else {
      components.push({
        type: "body",
        parameters: variables.map((v) => ({ type: "text", text: v })),
      });
    }
  }

  const response = await sendMetaCloudTemplateTest(
    credentials.phoneNumberId,
    credentials.accessToken,
    destinationPhone,
    template.name,
    template.language,
    components,
  );

  const wamid = response.messages?.[0]?.id;

  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId,
    entidade: "meta_whatsapp_template",
    entidadeId: templateId,
    acao: "enviou_teste_template_meta",
  });

  return { success: true, wamid };
}

/** Dynamic Event-to-Template Resolver with Built-in Legacy Fallbacks */
export class WhatsAppTemplateResolver {
  static async resolveTemplateForEvent(
    tenantId: string,
    purpose: MetaWhatsAppTemplatePurpose | string,
  ): Promise<{ name: string; language: string; isCustom: boolean }> {
    // Broker assignment and offer acceptance have fixed operational contracts.
    // They cannot inherit tenant bindings because qualification targets the lead,
    // while these templates target the broker with different payloads.
    if (purpose === "brokerLeadNotification" || purpose === "leadAssignmentConfirmed") {
      const template = META_WHATSAPP_TEMPLATE_PURPOSES[purpose];
      return { ...template, isCustom: false };
    }

    const db = getDatabase();

    // Map purpose string to eventKey
    let eventKey: EventKey | null = null;
    if (purpose === "brokerInvitation") eventKey = "BROKER_WELCOME";
    else if (purpose === "newLeadAssignment") eventKey = "LEAD_OFFER";
    else if (purpose === "leadAssignmentConfirmed") eventKey = "LEAD_ASSIGNMENT_CONFIRMED";
    else if (purpose === "leadAssignmentUnavailable") eventKey = "LEAD_ASSIGNMENT_UNAVAILABLE";
    else if (purpose === "leadAssignmentExpired") eventKey = "LEAD_ASSIGNMENT_EXPIRED";
    else if (purpose === "taskReminder") eventKey = "TASK_REMINDER";
    else if (purpose === "clientNotice") eventKey = "CLIENT_NOTICE";

    try {
      if (eventKey) {
        const [usage] = await db
          .select({
            templateName: schema.metaWhatsAppTemplates.name,
            language: schema.metaWhatsAppTemplates.language,
            status: schema.metaWhatsAppTemplates.status,
          })
          .from(schema.metaWhatsAppTemplateUsages)
          .innerJoin(
            schema.metaWhatsAppTemplates,
            eq(schema.metaWhatsAppTemplateUsages.templateId, schema.metaWhatsAppTemplates.id),
          )
          .where(
            and(
              eq(schema.metaWhatsAppTemplateUsages.tenantId, tenantId),
              eq(schema.metaWhatsAppTemplateUsages.eventKey, eventKey),
              eq(schema.metaWhatsAppTemplateUsages.active, true),
              eq(schema.metaWhatsAppTemplates.status, "APPROVED"),
              isNull(schema.metaWhatsAppTemplates.deletedAt),
            ),
          )
          .limit(1);

        if (usage) {
          return { name: usage.templateName, language: usage.language, isCustom: true };
        }
      }

      const fallback = META_WHATSAPP_TEMPLATE_PURPOSES[purpose as MetaWhatsAppTemplatePurpose];
      if (fallback) {
        const [synced] = await db
          .select({ name: schema.metaWhatsAppTemplates.name, language: schema.metaWhatsAppTemplates.language })
          .from(schema.metaWhatsAppTemplates)
          .where(
            and(
              eq(schema.metaWhatsAppTemplates.tenantId, tenantId),
              eq(schema.metaWhatsAppTemplates.name, fallback.name),
              isNull(schema.metaWhatsAppTemplates.deletedAt),
            ),
          )
          .limit(1);

        if (synced) {
          return { name: synced.name, language: synced.language, isCustom: false };
        }
      }
    } catch {
      // Ignora erro se tabelas meta_whatsapp_templates ou meta_whatsapp_template_usages nao existirem no DB
    }

    // Built-in legacy fallback guarantee with dynamic language detection from synced WABA templates
    const fallback = META_WHATSAPP_TEMPLATE_PURPOSES[purpose as MetaWhatsAppTemplatePurpose];
    if (fallback) {
      return { name: fallback.name, language: fallback.language, isCustom: false };
    }

    return { name: String(purpose), language: "pt_BR", isCustom: false };
  }
}
