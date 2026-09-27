import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { getMessageEventByKey } from "@/features/communication-channels/message-event-catalog";
import { teamNoticeByKey } from "@/features/team-notices/catalog";
import { getTenantChannelRouting } from "@/features/waha-cadence/tenant-channel-routing";
import { getDatabase, schema } from "@/shared/db";
import { channelValidity, MESSAGE_KIND_LABEL, type ChannelValidity, type MessageKind, type MessageUsage } from "./catalog";

export type LibraryMessage = {
  id: string;
  kind: MessageKind;
  kindLabel: string;
  name: string;
  status: string;
  category: string | null;
  text: string;
  variables: string[];
  validity: ChannelValidity[];
  usages: MessageUsage[];
};

function push(map: Map<string, MessageUsage[]>, id: string | null | undefined, usage: MessageUsage) {
  if (!id) return;
  const list = map.get(id) ?? [];
  if (!list.some((item) => item.label === usage.label)) list.push(usage);
  map.set(id, list);
}

const eventLabel = (key: string) => getMessageEventByKey(key)?.label ?? key;

/** Where each free message and Meta template is used, by message id. */
export async function getMessageUsages(tenantId: string) {
  const db = getDatabase();
  const [notices, legacyRouting, policies, templateUsages, followUps] = await Promise.all([
    db.select({ key: schema.teamNoticeSettings.noticeKey, freeMessageId: schema.teamNoticeSettings.freeMessageId, enabled: schema.teamNoticeSettings.enabled })
      .from(schema.teamNoticeSettings).where(eq(schema.teamNoticeSettings.tenantId, tenantId)),
    getTenantChannelRouting(tenantId),
    db.select({ eventKey: schema.communicationEventMessagePolicies.eventKey, metaTemplateId: schema.communicationEventMessagePolicies.metaTemplateId, freeMessageId: schema.communicationEventMessagePolicies.freeMessageTemplateId })
      .from(schema.communicationEventMessagePolicies)
      .where(and(eq(schema.communicationEventMessagePolicies.tenantId, tenantId), eq(schema.communicationEventMessagePolicies.active, true))),
    db.select({ eventKey: schema.metaWhatsAppTemplateUsages.eventKey, templateId: schema.metaWhatsAppTemplateUsages.templateId })
      .from(schema.metaWhatsAppTemplateUsages)
      .where(and(eq(schema.metaWhatsAppTemplateUsages.tenantId, tenantId), eq(schema.metaWhatsAppTemplateUsages.active, true))),
    db.select({ name: schema.aiQualificationFollowUpRules.name, templateId: schema.aiQualificationFollowUpRules.templateId, enabled: schema.aiQualificationFollowUpRules.enabled })
      .from(schema.aiQualificationFollowUpRules)
      .where(eq(schema.aiQualificationFollowUpRules.tenantId, tenantId))
      .catch(() => []),
  ]);

  const usages = new Map<string, MessageUsage[]>();
  const noticeKeysWithRow = new Set(notices.map((notice) => notice.key));
  for (const notice of notices) {
    push(usages, notice.freeMessageId, { area: "team_notice", label: `Aviso da equipe: ${teamNoticeByKey(notice.key)?.label ?? notice.key}${notice.enabled ? "" : " (desligado)"}` });
  }
  // Company-number routing saved before the team notices existed still counts until the notice is saved.
  for (const [key, messageId] of Object.entries(legacyRouting.events)) {
    if (!noticeKeysWithRow.has(key)) push(usages, messageId, { area: "team_notice", label: `Aviso da equipe: ${teamNoticeByKey(key)?.label ?? key}` });
  }
  for (const policy of policies) {
    push(usages, policy.freeMessageId, { area: "situation", label: `Situação: ${eventLabel(policy.eventKey)}` });
    push(usages, policy.metaTemplateId, { area: "situation", label: `Situação: ${eventLabel(policy.eventKey)}` });
  }
  for (const usage of templateUsages) push(usages, usage.templateId, { area: "situation", label: `Situação: ${eventLabel(usage.eventKey)}` });
  for (const rule of followUps) push(usages, rule.templateId, { area: "follow_up", label: `Follow-up: ${rule.name}${rule.enabled ? "" : " (desligado)"}` });
  return usages;
}

/** Every message of the tenant with kind, validity per channel and where it is used. */
export async function getMessageLibrary(tenantId: string): Promise<LibraryMessage[]> {
  const db = getDatabase();
  const [usages, freeMessages, metaTemplates, quickReplies] = await Promise.all([
    getMessageUsages(tenantId),
    db.select({ id: schema.messageTemplates.id, name: schema.messageTemplates.name, category: schema.messageTemplates.category, content: schema.messageTemplates.content, variables: schema.messageTemplates.variables, active: schema.messageTemplates.active })
      .from(schema.messageTemplates).where(eq(schema.messageTemplates.tenantId, tenantId)),
    db.select({ id: schema.metaWhatsAppTemplates.id, name: schema.metaWhatsAppTemplates.name, category: schema.metaWhatsAppTemplates.category, status: schema.metaWhatsAppTemplates.status, bodyText: schema.metaWhatsAppTemplates.bodyText, language: schema.metaWhatsAppTemplates.language })
      .from(schema.metaWhatsAppTemplates).where(and(eq(schema.metaWhatsAppTemplates.tenantId, tenantId), isNull(schema.metaWhatsAppTemplates.deletedAt))),
    db.select({ id: schema.aiQuickReplyTemplates.id, ruleKey: schema.aiQuickReplyTemplates.ruleKey, templateKey: schema.aiQuickReplyTemplates.templateKey, body: schema.aiQuickReplyTemplates.body, active: schema.aiQuickReplyTemplates.active })
      .from(schema.aiQuickReplyTemplates).where(eq(schema.aiQuickReplyTemplates.tenantId, tenantId))
      .catch(() => []),
  ]);

  const variablesOf = (text: string) => [...new Set([...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((match) => match[1]))];
  const rows: LibraryMessage[] = [
    ...freeMessages.filter((message) => message.active).map((message) => ({
      id: message.id, kind: "free_message" as const, kindLabel: MESSAGE_KIND_LABEL.free_message, name: message.name,
      status: "Ativa", category: message.category, text: message.content,
      variables: Array.isArray(message.variables) && message.variables.length ? message.variables.map(String) : variablesOf(message.content),
      validity: channelValidity("free_message"), usages: usages.get(message.id) ?? [],
    })),
    ...metaTemplates.map((template) => ({
      id: template.id, kind: "meta_template" as const, kindLabel: MESSAGE_KIND_LABEL.meta_template, name: `${template.name} (${template.language})`,
      status: template.status === "APPROVED" ? "Aprovado" : template.status === "REJECTED" ? "Rejeitado" : template.status === "PENDING" ? "Em análise" : template.status,
      category: template.category, text: template.bodyText ?? "", variables: variablesOf(template.bodyText ?? ""),
      validity: channelValidity("meta_template"), usages: usages.get(template.id) ?? [],
    })),
    ...quickReplies.filter((reply) => reply.active).map((reply) => ({
      id: reply.id, kind: "quick_reply" as const, kindLabel: MESSAGE_KIND_LABEL.quick_reply, name: reply.templateKey,
      status: "Ativa", category: null, text: reply.body, variables: variablesOf(reply.body),
      validity: channelValidity("quick_reply"), usages: [{ area: "ai" as const, label: `IA: resposta automática (${reply.ruleKey})` }],
    })),
  ];
  return rows.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, "pt-BR"));
}
