import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { getDatabase, schema } from "@/shared/db";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getFeatureFlag } from "@/features/system-settings/queries";
import {
  MESSAGE_EVENT_CATALOG,
  MESSAGE_RESOURCE_KINDS,
  buildAutomaticMetaVariableMappings,
  buildMetaProviderVariables,
  getFreeMessageUnknownVariables,
  getMessageEventByKey,
  getMessageEventByPurpose,
  renderEventFreeMessage,
  type MessageResourceKind,
} from "./message-event-catalog";
import { getInternalBrokerNotificationPolicy, getSelectedInternalWahaNumber } from "./internal-notification-policy";
import { META_WHATSAPP_TEMPLATE_PURPOSES } from "./templates";
import { META_CLOUD_PROVIDER } from "./types";

const policyInputSchema = z.object({
  eventKey: z.string().trim().min(1),
  primaryKind: z.enum(MESSAGE_RESOURCE_KINDS),
  metaTemplateId: z.string().trim().min(1).nullable(),
  freeMessageTemplateId: z.string().trim().min(1).nullable(),
  fallbackKind: z.enum(MESSAGE_RESOURCE_KINDS).nullable(),
  active: z.boolean(),
}).superRefine((value, context) => {
  if (value.fallbackKind === value.primaryKind) {
    context.addIssue({ code: "custom", path: ["fallbackKind"], message: "A contingência deve usar um tipo diferente da mensagem principal." });
  }
  if ((value.primaryKind === "meta_template" || value.fallbackKind === "meta_template") && !value.metaTemplateId) {
    context.addIssue({ code: "custom", path: ["metaTemplateId"], message: "Selecione um template Meta aprovado." });
  }
  if ((value.primaryKind === "free_message" || value.fallbackKind === "free_message") && !value.freeMessageTemplateId) {
    context.addIssue({ code: "custom", path: ["freeMessageTemplateId"], message: "Selecione uma mensagem livre ativa." });
  }
});

export type SaveMessagePolicyInput = z.infer<typeof policyInputSchema>;

type MetaResource = {
  id: string;
  name: string;
  language: string;
  status: string;
  bodyText: string | null;
  variables: string[];
};

type FreeResource = {
  id: string;
  name: string;
  category: string;
  content: string;
  variables: string[];
};

export type ResolvedEventMessage = {
  type: "template" | "text";
  templateName: string;
  templateLanguage: string;
  providerVariables?: string[];
  templateVariableNames?: string[];
  renderedBody?: string;
};

export type ResolvedEventMessagePlan = {
  eventKey: string | null;
  policyId: string | null;
  policyVersion: number | null;
  primary: ResolvedEventMessage;
  fallback: ResolvedEventMessage | null;
  preferWahaDirect: boolean;
  serviceWindowOpen: boolean;
};

export function isMissingMessagePolicyTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const databaseError = error as { code?: unknown; cause?: { code?: unknown }; message?: unknown };
  return databaseError.code === "42P01"
    || databaseError.cause?.code === "42P01"
    || (typeof databaseError.message === "string" && /relation .* does not exist/i.test(databaseError.message));
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asStringRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

async function getActiveWabaId(tenantId: string) {
  const [channel] = await getDatabase().select({ wabaId: schema.communicationChannels.wabaId })
    .from(schema.communicationChannels)
    .where(and(
      eq(schema.communicationChannels.tenantId, tenantId),
      inArray(schema.communicationChannels.provider, [META_CLOUD_PROVIDER, "meta_cloud_api", "meta_cloud"]),
      eq(schema.communicationChannels.status, "active"),
      isNull(schema.communicationChannels.branchId),
    ))
    .orderBy(desc(schema.communicationChannels.isDefault), desc(schema.communicationChannels.updatedAt))
    .limit(1);
  return channel?.wabaId ?? null;
}

async function loadMetaResource(tenantId: string, templateId: string | null, requireApproved = true): Promise<MetaResource | null> {
  if (!templateId) return null;
  const wabaId = await getActiveWabaId(tenantId);
  if (!wabaId) return null;
  const conditions = [
    eq(schema.metaWhatsAppTemplates.id, templateId),
    eq(schema.metaWhatsAppTemplates.tenantId, tenantId),
    eq(schema.metaWhatsAppTemplates.wabaId, wabaId),
    isNull(schema.metaWhatsAppTemplates.deletedAt),
  ];
  if (requireApproved) conditions.push(eq(schema.metaWhatsAppTemplates.status, "APPROVED"));
  const [template] = await getDatabase().select({
    id: schema.metaWhatsAppTemplates.id,
    name: schema.metaWhatsAppTemplates.name,
    language: schema.metaWhatsAppTemplates.language,
    status: schema.metaWhatsAppTemplates.status,
    bodyText: schema.metaWhatsAppTemplates.bodyText,
    variables: schema.metaWhatsAppTemplates.variablesJson,
  }).from(schema.metaWhatsAppTemplates).where(and(...conditions)).limit(1);
  return template ? { ...template, variables: asStringArray(template.variables) } : null;
}

async function loadFreeResource(tenantId: string, templateId: string | null): Promise<FreeResource | null> {
  if (!templateId) return null;
  const [template] = await getDatabase().select({
    id: schema.messageTemplates.id,
    name: schema.messageTemplates.name,
    category: schema.messageTemplates.category,
    content: schema.messageTemplates.content,
    variables: schema.messageTemplates.variables,
  }).from(schema.messageTemplates).where(and(
    eq(schema.messageTemplates.id, templateId),
    eq(schema.messageTemplates.tenantId, tenantId),
    eq(schema.messageTemplates.active, true),
  )).limit(1);
  return template ? { ...template, variables: asStringArray(template.variables) } : null;
}

export async function listMessageEventPolicies(tenantId: string) {
  let policies: Array<typeof schema.communicationEventMessagePolicies.$inferSelect> = [];
  try {
    policies = await getDatabase().select().from(schema.communicationEventMessagePolicies)
      .where(eq(schema.communicationEventMessagePolicies.tenantId, tenantId));
  } catch (error) {
    if (!isMissingMessagePolicyTable(error)) throw error;
  }

  const [metaTemplates, freeMessages, globallyEnabled] = await Promise.all([
    getActiveWabaId(tenantId).then(async (wabaId) => wabaId
      ? getDatabase().select({
          id: schema.metaWhatsAppTemplates.id,
          name: schema.metaWhatsAppTemplates.name,
          language: schema.metaWhatsAppTemplates.language,
          category: schema.metaWhatsAppTemplates.category,
          status: schema.metaWhatsAppTemplates.status,
          variables: schema.metaWhatsAppTemplates.variablesJson,
        }).from(schema.metaWhatsAppTemplates).where(and(
          eq(schema.metaWhatsAppTemplates.tenantId, tenantId),
          eq(schema.metaWhatsAppTemplates.wabaId, wabaId),
          isNull(schema.metaWhatsAppTemplates.deletedAt),
        )).orderBy(schema.metaWhatsAppTemplates.name)
      : []),
    getDatabase().select({
      id: schema.messageTemplates.id,
      name: schema.messageTemplates.name,
      category: schema.messageTemplates.category,
      content: schema.messageTemplates.content,
      variables: schema.messageTemplates.variables,
    }).from(schema.messageTemplates).where(and(
      eq(schema.messageTemplates.tenantId, tenantId),
      eq(schema.messageTemplates.active, true),
    )).orderBy(schema.messageTemplates.name),
    getFeatureFlag(FEATURE_FLAGS.MESSAGE_EVENT_POLICIES).then((value) => value !== "false"),
  ]);

  return {
    globallyEnabled,
    events: MESSAGE_EVENT_CATALOG.map((event) => ({
      ...event,
      variables: event.variables.map((variable) => ({ ...variable })),
      policy: policies.find((policy) => policy.eventKey === event.key) ?? null,
    })),
    metaTemplates: metaTemplates.map((template) => ({ ...template, variables: asStringArray(template.variables) })),
    freeMessages: freeMessages.map((message) => ({ ...message, variables: asStringArray(message.variables) })),
  };
}

export async function saveMessageEventPolicy(tenantId: string, userId: string, input: SaveMessagePolicyInput) {
  const parsed = policyInputSchema.parse(input);
  const event = getMessageEventByKey(parsed.eventKey);
  if (!event) throw new Error("A situação não possui um produtor registrado no sistema.");

  const [metaTemplate, freeMessage] = await Promise.all([
    loadMetaResource(tenantId, parsed.metaTemplateId),
    loadFreeResource(tenantId, parsed.freeMessageTemplateId),
  ]);
  if ((parsed.primaryKind === "meta_template" || parsed.fallbackKind === "meta_template") && !metaTemplate) {
    throw new Error("O template Meta precisa estar aprovado e pertencer à WABA ativa desta empresa.");
  }
  if ((parsed.primaryKind === "free_message" || parsed.fallbackKind === "free_message") && !freeMessage) {
    throw new Error("A mensagem livre precisa estar ativa e pertencer a esta empresa.");
  }

  const mappingResult = metaTemplate
    ? buildAutomaticMetaVariableMappings(event, metaTemplate.variables)
    : { valid: true as const, mappings: {} };
  if (!mappingResult.valid) {
    throw new Error(`A variável {{${mappingResult.unknown}}} do template Meta não existe nesta situação.`);
  }
  if (freeMessage) {
    const unknown = getFreeMessageUnknownVariables(event, freeMessage.variables);
    if (unknown.length > 0) throw new Error(`A mensagem livre usa variáveis incompatíveis: ${unknown.map((item) => `{{${item}}}`).join(", ")}.`);
  }

  if (event.windowRule === "corporate_internal" && parsed.primaryKind === "free_message" && parsed.active) {
    const internalPolicy = await getInternalBrokerNotificationPolicy(tenantId);
    const wahaNumber = await getSelectedInternalWahaNumber(tenantId, internalPolicy.wahaNumberId);
    if (!internalPolicy.enabled || !wahaNumber) {
      throw new Error("Para usar mensagem livre como principal neste aviso, ative e selecione um WhatsApp corporativo.");
    }
  }

  const db = getDatabase();
  const now = new Date();
  const [existing] = await db.select({ id: schema.communicationEventMessagePolicies.id, version: schema.communicationEventMessagePolicies.version })
    .from(schema.communicationEventMessagePolicies)
    .where(and(
      eq(schema.communicationEventMessagePolicies.tenantId, tenantId),
      eq(schema.communicationEventMessagePolicies.eventKey, event.key),
    )).limit(1);
  const id = existing?.id ?? randomUUID();
  const version = (existing?.version ?? 0) + 1;
  const values = {
    primaryKind: parsed.primaryKind,
    metaTemplateId: metaTemplate?.id ?? null,
    freeMessageTemplateId: freeMessage?.id ?? null,
    metaVariableMappingsJson: mappingResult.mappings,
    fallbackKind: parsed.fallbackKind,
    active: parsed.active,
    version,
    updatedBy: userId,
    updatedAt: now,
  };
  if (existing) {
    await db.update(schema.communicationEventMessagePolicies).set(values)
      .where(and(eq(schema.communicationEventMessagePolicies.id, id), eq(schema.communicationEventMessagePolicies.tenantId, tenantId)));
  } else {
    await db.insert(schema.communicationEventMessagePolicies).values({
      id,
      tenantId,
      eventKey: event.key,
      ...values,
      createdAt: now,
    });
  }

  if (metaTemplate) {
    await db.insert(schema.metaWhatsAppTemplateUsages).values({
      id: randomUUID(), tenantId, eventKey: event.key, templateId: metaTemplate.id,
      variableMappingsJson: mappingResult.mappings, active: parsed.active, createdAt: now, updatedAt: now,
    }).onConflictDoUpdate({
      target: [schema.metaWhatsAppTemplateUsages.tenantId, schema.metaWhatsAppTemplateUsages.eventKey],
      set: { templateId: metaTemplate.id, variableMappingsJson: mappingResult.mappings, active: parsed.active, updatedAt: now },
    });
  }

  await db.insert(schema.auditLogs).values({
    id: randomUUID(), userId, entidade: "communication_event_message_policy", entidadeId: id,
    acao: `message_policy.updated:${event.key}:v${version}`, createdAt: now,
  });
  return { success: true as const, id, version };
}

export async function isCustomerServiceWindowOpen(input: {
  tenantId: string;
  recipientType: "lead" | "client" | "user";
  recipientId?: string;
  destinationPhone: string;
  now?: Date;
}) {
  if (input.recipientType === "user") return false;
  const now = input.now ?? new Date();
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const recipientCondition = input.recipientType === "lead" && input.recipientId
    ? eq(schema.whatsappMessages.leadId, input.recipientId)
    : input.recipientType === "client" && input.recipientId
      ? eq(schema.whatsappMessages.clientId, input.recipientId)
      : eq(schema.whatsappMessages.phone, input.destinationPhone);
  const [lastInbound] = await getDatabase().select({ id: schema.whatsappMessages.id })
    .from(schema.whatsappMessages)
    .where(and(
      eq(schema.whatsappMessages.tenantId, input.tenantId),
      recipientCondition,
      inArray(schema.whatsappMessages.direction, ["incoming", "inbound"]),
      gte(schema.whatsappMessages.sentAt, cutoff),
    )).orderBy(desc(schema.whatsappMessages.sentAt)).limit(1);
  return Boolean(lastInbound);
}

function makeMetaMessage(event: NonNullable<ReturnType<typeof getMessageEventByPurpose>>, resource: MetaResource, mappings: Record<string, string>, rawVariables: string[]): ResolvedEventMessage {
  const providerVariables = buildMetaProviderVariables(event, rawVariables, resource.variables, mappings);
  const named = resource.variables.length > 0 && resource.variables.every((variable) => !/^\d+$/.test(variable));
  return {
    type: "template",
    templateName: resource.name,
    templateLanguage: resource.language,
    providerVariables,
    templateVariableNames: named ? resource.variables : undefined,
    renderedBody: resource.bodyText
      ? renderEventFreeMessage(event, resource.bodyText, rawVariables)
      : undefined,
  };
}

function makeFreeMessage(event: NonNullable<ReturnType<typeof getMessageEventByPurpose>>, resource: FreeResource, rawVariables: string[]): ResolvedEventMessage {
  return {
    type: "text",
    templateName: "__text__",
    templateLanguage: "pt_BR",
    renderedBody: renderEventFreeMessage(event, resource.content, rawVariables),
  };
}

async function resolveLegacyMetaResource(tenantId: string, eventKey: string, purpose: string): Promise<MetaResource | null> {
  const wabaId = await getActiveWabaId(tenantId);
  if (wabaId) {
    const [usage] = await getDatabase().select({ templateId: schema.metaWhatsAppTemplateUsages.templateId })
      .from(schema.metaWhatsAppTemplateUsages)
      .where(and(
        eq(schema.metaWhatsAppTemplateUsages.tenantId, tenantId),
        eq(schema.metaWhatsAppTemplateUsages.eventKey, eventKey),
        eq(schema.metaWhatsAppTemplateUsages.active, true),
      )).limit(1);
    const configured = await loadMetaResource(tenantId, usage?.templateId ?? null);
    if (configured) return configured;
  }
  const fallback = META_WHATSAPP_TEMPLATE_PURPOSES[purpose as keyof typeof META_WHATSAPP_TEMPLATE_PURPOSES];
  return fallback ? { id: "legacy", name: fallback.name, language: fallback.language, status: "APPROVED", bodyText: null, variables: [] } : null;
}

export async function resolveEventMessagePlan(input: {
  tenantId: string;
  recipientType: "lead" | "client" | "user";
  recipientId?: string;
  destinationPhone: string;
  purpose: string;
  variables: string[];
}) : Promise<ResolvedEventMessagePlan | null> {
  const event = getMessageEventByPurpose(input.purpose);
  if (!event) return null;
  const serviceWindowOpen = await isCustomerServiceWindowOpen(input);
  const policiesEnabled = await getFeatureFlag(FEATURE_FLAGS.MESSAGE_EVENT_POLICIES)
    .then((value) => value !== "false")
    .catch(() => true);
  let policy: typeof schema.communicationEventMessagePolicies.$inferSelect | null = null;
  if (policiesEnabled) {
    try {
      [policy] = await getDatabase().select().from(schema.communicationEventMessagePolicies).where(and(
        eq(schema.communicationEventMessagePolicies.tenantId, input.tenantId),
        eq(schema.communicationEventMessagePolicies.eventKey, event.key),
        eq(schema.communicationEventMessagePolicies.active, true),
      )).limit(1);
    } catch (error) {
      if (!isMissingMessagePolicyTable(error)) throw error;
    }
  }

  const legacyMeta = await resolveLegacyMetaResource(input.tenantId, event.key, input.purpose);
  if (!policy) {
    if (!legacyMeta) return null;
    const auto = buildAutomaticMetaVariableMappings(event, legacyMeta.variables);
    return {
      eventKey: event.key, policyId: null, policyVersion: null,
      primary: makeMetaMessage(event, legacyMeta, auto.valid ? auto.mappings : {}, input.variables),
      fallback: null, preferWahaDirect: false, serviceWindowOpen,
    };
  }

  const [metaResource, freeResource] = await Promise.all([
    loadMetaResource(input.tenantId, policy.metaTemplateId),
    loadFreeResource(input.tenantId, policy.freeMessageTemplateId),
  ]);
  const mappings = asStringRecord(policy.metaVariableMappingsJson);
  const metaMessage = metaResource ? makeMetaMessage(event, metaResource, mappings, input.variables) : null;
  const freeMessage = freeResource ? makeFreeMessage(event, freeResource, input.variables) : null;
  const byKind = (kind: MessageResourceKind | null) => kind === "meta_template" ? metaMessage : kind === "free_message" ? freeMessage : null;
  let primary = byKind(policy.primaryKind);
  let fallback = byKind(policy.fallbackKind as MessageResourceKind | null);
  let preferWahaDirect = false;

  if (event.windowRule === "meta_required_without_window" && !serviceWindowOpen && primary?.type === "text") {
    const automaticMappings = legacyMeta
      ? buildAutomaticMetaVariableMappings(event, legacyMeta.variables)
      : null;
    primary = metaMessage ?? (legacyMeta
      ? makeMetaMessage(event, legacyMeta, automaticMappings?.valid ? automaticMappings.mappings : {}, input.variables)
      : null);
    fallback = null;
  }
  if (event.windowRule === "meta_required_without_window" && !serviceWindowOpen && fallback?.type === "text") fallback = null;

  if (event.windowRule === "corporate_internal" && primary?.type === "text") {
    const internalPolicy = await getInternalBrokerNotificationPolicy(input.tenantId);
    const wahaNumber = await getSelectedInternalWahaNumber(input.tenantId, internalPolicy.wahaNumberId);
    if (internalPolicy.enabled && wahaNumber) preferWahaDirect = true;
    else {
      const automaticMappings = legacyMeta
        ? buildAutomaticMetaVariableMappings(event, legacyMeta.variables)
        : null;
      primary = metaMessage ?? (legacyMeta
        ? makeMetaMessage(event, legacyMeta, automaticMappings?.valid ? automaticMappings.mappings : {}, input.variables)
        : null);
      fallback = null;
    }
  }

  if (!primary && legacyMeta) {
    const auto = buildAutomaticMetaVariableMappings(event, legacyMeta.variables);
    primary = makeMetaMessage(event, legacyMeta, auto.valid ? auto.mappings : {}, input.variables);
  }
  if (!primary) return null;
  return {
    eventKey: event.key,
    policyId: policy.id,
    policyVersion: policy.version,
    primary,
    fallback,
    preferWahaDirect,
    serviceWindowOpen,
  };
}
