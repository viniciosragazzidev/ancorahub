import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { getDefaultQuickReplyTemplates, isRetiredDefaultBody } from "@/features/ai-agent/quick-reply";
import { getMessageEventByKey } from "@/features/communication-channels/message-event-catalog";
import { effectiveNoticeSetting, teamNoticeByKey } from "@/features/team-notices/catalog";
import { getTenantChannelRouting } from "@/features/waha-cadence/tenant-channel-routing";
import { getDatabase, schema } from "@/shared/db";
import { channelValidity, MESSAGE_KIND_LABEL, QUICK_REPLY_SITUATIONS, textVariables, type ChannelValidity, type MessageKind, type MessageUsage } from "./catalog";

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
  /** AI quick reply: the situation key, its default text and whether the tenant changed it. */
  quickReply?: { ruleKey: string; defaultText: string; customized: boolean };
  /** Meta template details for the drawer. */
  meta?: { rawStatus: string; language: string; headerType: string; footerText: string | null; rejectedReason: string | null; qualityRating: string | null };
};

function push(map: Map<string, MessageUsage[]>, id: string | null | undefined, usage: MessageUsage) {
  if (!id) return;
  const list = map.get(id) ?? [];
  if (!list.some((item) => item.label === usage.label)) list.push(usage);
  map.set(id, list);
}

const eventLabel = (key: string) => getMessageEventByKey(key)?.label ?? key;

/** Where each free message and Meta template is used, by message id, with the channel of each use. */
export async function getMessageUsages(tenantId: string) {
  const db = getDatabase();
  const [notices, legacyRouting, policies, templateUsages, followUps] = await Promise.all([
    db.select({ key: schema.teamNoticeSettings.noticeKey, freeMessageId: schema.teamNoticeSettings.freeMessageId, freeMessageIds: schema.teamNoticeSettings.freeMessageIds, enabled: schema.teamNoticeSettings.enabled, channel: schema.teamNoticeSettings.channel })
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
    const ids = notice.freeMessageIds.length ? notice.freeMessageIds : [notice.freeMessageId];
    // A free message only goes out when the notice uses the company number.
    for (const id of ids) push(usages, id, { area: "team_notice", label: `Aviso da equipe: ${teamNoticeByKey(notice.key)?.label ?? notice.key}${notice.enabled ? "" : " (desligado)"}`, channel: notice.channel === "company_number" ? "company_number" : "meta" });
  }
  // Company-number routing saved before the team notices existed still counts until the notice is saved.
  for (const [key, messageId] of Object.entries(legacyRouting.events)) {
    const notice = teamNoticeByKey(key);
    if (!noticeKeysWithRow.has(key)) push(usages, messageId, { area: "team_notice", label: `Aviso da equipe: ${notice?.label ?? key}`, channel: notice ? (effectiveNoticeSetting(notice, null).channel === "company_number" ? "company_number" : "meta") : undefined });
  }
  for (const policy of policies) {
    push(usages, policy.freeMessageId, { area: "situation", label: `Situação: ${eventLabel(policy.eventKey)}`, channel: "meta" });
    push(usages, policy.metaTemplateId, { area: "situation", label: `Situação: ${eventLabel(policy.eventKey)}`, channel: "meta" });
  }
  for (const usage of templateUsages) push(usages, usage.templateId, { area: "situation", label: `Situação: ${eventLabel(usage.eventKey)}`, channel: "meta" });
  for (const rule of followUps) push(usages, rule.templateId, { area: "follow_up", label: `Follow-up: ${rule.name}${rule.enabled ? "" : " (desligado)"}` });
  return usages;
}

const META_STATUS_LABEL: Record<string, string> = { APPROVED: "Aprovado", REJECTED: "Rejeitado", PENDING: "Em análise", PAUSED: "Pausado", DISABLED: "Desativado" };

/** Every message of the tenant with kind, validity per channel and where it is used. */
export async function getMessageLibrary(tenantId: string): Promise<LibraryMessage[]> {
  const db = getDatabase();
  const [usages, freeMessages, metaTemplates, quickReplyRows] = await Promise.all([
    getMessageUsages(tenantId),
    db.select({ id: schema.messageTemplates.id, name: schema.messageTemplates.name, category: schema.messageTemplates.category, content: schema.messageTemplates.content, variables: schema.messageTemplates.variables, active: schema.messageTemplates.active })
      .from(schema.messageTemplates).where(eq(schema.messageTemplates.tenantId, tenantId)),
    db.select({
      id: schema.metaWhatsAppTemplates.id, name: schema.metaWhatsAppTemplates.name, category: schema.metaWhatsAppTemplates.category, status: schema.metaWhatsAppTemplates.status,
      bodyText: schema.metaWhatsAppTemplates.bodyText, language: schema.metaWhatsAppTemplates.language, headerType: schema.metaWhatsAppTemplates.headerType,
      footerText: schema.metaWhatsAppTemplates.footerText, rejectedReason: schema.metaWhatsAppTemplates.rejectedReason, qualityRating: schema.metaWhatsAppTemplates.qualityRating,
    }).from(schema.metaWhatsAppTemplates).where(and(eq(schema.metaWhatsAppTemplates.tenantId, tenantId), isNull(schema.metaWhatsAppTemplates.deletedAt))),
    db.select({ id: schema.aiQuickReplyTemplates.id, ruleKey: schema.aiQuickReplyTemplates.ruleKey, body: schema.aiQuickReplyTemplates.body, active: schema.aiQuickReplyTemplates.active })
      .from(schema.aiQuickReplyTemplates).where(eq(schema.aiQuickReplyTemplates.tenantId, tenantId))
      .catch(() => []),
  ]);

  // Every situation the AI answers, with the tenant's text when it wrote one
  // (an old default saved untouched counts as not customized, as at runtime).
  const defaults = getDefaultQuickReplyTemplates();
  const quickReplies: LibraryMessage[] = QUICK_REPLY_SITUATIONS.map((situation) => {
    const row = quickReplyRows.find((item) => item.ruleKey === situation.ruleKey && item.active && !isRetiredDefaultBody(item.ruleKey, item.body));
    const defaultText = defaults[situation.ruleKey]?.body ?? "";
    const text = row?.body ?? defaultText;
    return {
      id: `quick_reply:${situation.ruleKey}`, kind: "quick_reply" as const, kindLabel: MESSAGE_KIND_LABEL.quick_reply, name: situation.label,
      status: row ? "Personalizada" : "Padrão", category: null, text, variables: textVariables(text),
      validity: channelValidity("quick_reply"),
      usages: [{ area: "ai" as const, label: `IA: ${situation.label.toLowerCase()}`, channel: "conversation" as const }],
      quickReply: { ruleKey: situation.ruleKey, defaultText, customized: Boolean(row) },
    };
  });

  const rows: LibraryMessage[] = [
    ...freeMessages.filter((message) => message.active).map((message) => ({
      id: message.id, kind: "free_message" as const, kindLabel: MESSAGE_KIND_LABEL.free_message, name: message.name,
      status: "Ativa", category: message.category, text: message.content,
      variables: Array.isArray(message.variables) && message.variables.length ? message.variables.map(String) : textVariables(message.content),
      validity: channelValidity("free_message"), usages: usages.get(message.id) ?? [],
    })),
    ...metaTemplates.map((template) => ({
      id: template.id, kind: "meta_template" as const, kindLabel: MESSAGE_KIND_LABEL.meta_template, name: `${template.name} (${template.language})`,
      status: META_STATUS_LABEL[template.status] ?? template.status,
      category: template.category, text: template.bodyText ?? "", variables: textVariables(template.bodyText ?? ""),
      validity: channelValidity("meta_template"), usages: usages.get(template.id) ?? [],
      meta: { rawStatus: template.status, language: template.language, headerType: template.headerType, footerText: template.footerText, rejectedReason: template.rejectedReason, qualityRating: template.qualityRating },
    })),
    ...quickReplies,
  ];
  return rows.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, "pt-BR"));
}
