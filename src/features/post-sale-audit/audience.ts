import "server-only";

import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, notExists, or, sql } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { notStatusBroadcastSql } from "@/features/conversations/status-broadcast";
import { channelLeadIntakeKey, parseChannelLeadIntake } from "@/features/communication-channels/channel-lead-intake";
import { getSystemSettings } from "@/features/system-settings/queries";
import { META_CLOUD_PROVIDER } from "@/features/communication-channels/types";
import { evaluatePostSaleEligibility, isPostSaleOptedOut, pickPostSaleSourceMessage, POST_SALE_EXCLUSION_LABELS, POST_SALE_SURVEY_COOLDOWN_DAYS, type PostSaleExclusionReason, type PostSaleAudience, pickPostSaleCompanyWaha, isPostSaleWahaNumberAllowed, choosePostSaleSource, type PostSaleDefaultSourceState } from "./rules";
import { isApprovedPostSaleMetaTemplate } from "./template-contract";

const META_PROVIDERS = [META_CLOUD_PROVIDER, "meta_cloud_api"];
const WAHA_STATUSES = ["active", "ready"];
const META_TEMPLATE_NAME = "pos_venda_apresentacao";

export type PostSaleRecipient = {
  leadId: string;
  name: string;
  phone: string;
  brokerId: string;
  queueId: string | null;
  branchId: string | null;
  channelType: "waha" | "meta";
  channelRef: string;
};

export type PostSaleAudiencePreview = {
  totalSelected: number;
  totalEligible: number;
  canStart: boolean;
  excluded: Record<PostSaleExclusionReason, number>;
  examples: Array<{ leadId: string; name: string; channelType: "waha" | "meta" }>;
  recipients: PostSaleRecipient[];
  skippedRecipients: Array<{
    leadId: string;
    brokerId: string;
    phone: string;
    channelType: "waha" | "meta" | null;
    channelRef: string | null;
    reason: PostSaleExclusionReason;
  }>;
};

type LeadRow = {
  leadId: string;
  name: string;
  phone: string;
  currentBrokerId: string | null;
  queueId: string | null;
  branchId: string | null;
  createdAt: Date;
};

type Source = { type: "waha" | "meta"; ref: string } | null;

function dayStart(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function dayEnd(value: string) {
  return new Date(`${value}T23:59:59.999Z`);
}

function isMetaProvider(provider: string) {
  return META_PROVIDERS.includes(provider as (typeof META_PROVIDERS)[number]);
}

function sourceFromMessage(message: { provider: string; communicationChannelId: string | null; wahaNumberId: string | null }): Source {
  if (isMetaProvider(message.provider) && message.communicationChannelId) return { type: "meta", ref: message.communicationChannelId };
  if (message.provider === "waha" && message.wahaNumberId) return { type: "waha", ref: message.wahaNumberId };
  return null;
}

async function candidateLeadIds(context: TenantContext, audience: PostSaleAudience) {
  const db = getDatabase();
  if (audience.kind === "lead") return [audience.leadId];
  if (audience.kind === "leadIds") return [...new Set(audience.leadIds)];
  if (audience.kind === "broker") {
    if (context.role === "manager" && !context.branchId) return [];
    if (context.role === "manager") {
      const [broker] = await db.select({ userId: schema.tenantMemberships.userId })
        .from(schema.tenantMemberships)
        .where(and(
          eq(schema.tenantMemberships.tenantId, context.tenantId),
          eq(schema.tenantMemberships.userId, audience.brokerId),
          eq(schema.tenantMemberships.role, "broker"),
          eq(schema.tenantMemberships.status, "active"),
          eq(schema.tenantMemberships.branchId, context.branchId!),
        )).limit(1);
      if (!broker) return [];
    }
    const [current, events, attempts] = await Promise.all([
      db.select({ leadId: schema.leads.id }).from(schema.leads).where(and(eq(schema.leads.tenantId, context.tenantId), eq(schema.leads.corretorId, audience.brokerId))),
      db.selectDistinct({ leadId: schema.leadDistributionEvents.leadId }).from(schema.leadDistributionEvents).where(and(
        eq(schema.leadDistributionEvents.tenantId, context.tenantId),
        or(eq(schema.leadDistributionEvents.previousOwnerId, audience.brokerId), eq(schema.leadDistributionEvents.newOwnerId, audience.brokerId)),
      )),
      db.selectDistinct({ leadId: schema.leadAssignmentAttempts.leadId }).from(schema.leadAssignmentAttempts).where(and(
        eq(schema.leadAssignmentAttempts.tenantId, context.tenantId),
        eq(schema.leadAssignmentAttempts.brokerId, audience.brokerId),
      )),
    ]);
    return [...new Set([...current, ...events, ...attempts].map((row) => row.leadId))];
  }
  return [];
}

async function selectCandidates(context: TenantContext, audience: PostSaleAudience): Promise<LeadRow[]> {
  const db = getDatabase();
  if (context.role === "manager" && !context.branchId) return [];
  const ids = audience.kind === "filters" ? null : await candidateLeadIds(context, audience);
  if (ids && !ids.length) return [];

  const userBranchId = context.role === "manager" ? context.branchId : undefined;
  const requestedBranchId = audience.kind === "filters" ? audience.branchId : undefined;
  if (userBranchId && requestedBranchId && requestedBranchId !== userBranchId) return [];
  const branchId = userBranchId ?? requestedBranchId;
  const arrivalFrom = audience.kind === "filters" || audience.kind === "broker" ? audience.arrivalFrom : undefined;
  const arrivalTo = audience.kind === "filters" || audience.kind === "broker" ? audience.arrivalTo : undefined;
  const selectedLead = schema.leads;
  const queue = schema.leadQueues;
  const effectiveBranchId = sql<string | null>`coalesce(${selectedLead.branchId}, ${queue.branchId})`;
  const conditions = [
    eq(selectedLead.tenantId, context.tenantId),
    isNull(selectedLead.deletedAt),
    isNull(selectedLead.archivedAt),
    ids ? inArray(selectedLead.id, ids) : undefined,
    branchId ? sql`coalesce(${selectedLead.branchId}, ${queue.branchId}) = ${branchId}` : undefined,
    audience.kind === "filters" && audience.queueId ? eq(selectedLead.queueId, audience.queueId) : undefined,
    audience.kind === "filters" && audience.types.length ? inArray(selectedLead.tipo, audience.types) : undefined,
    audience.kind === "filters" && audience.statuses.length ? inArray(selectedLead.status, audience.statuses) : undefined,
    arrivalFrom ? gte(selectedLead.createdAt, dayStart(arrivalFrom)) : undefined,
    arrivalTo ? lte(selectedLead.createdAt, dayEnd(arrivalTo)) : undefined,
  ];
  if (audience.kind === "filters" && audience.branchId && context.role === "manager" && audience.branchId !== context.branchId) return [];
  return db.select({
    leadId: selectedLead.id,
    name: selectedLead.nome,
    phone: selectedLead.telefone,
    currentBrokerId: selectedLead.corretorId,
    queueId: selectedLead.queueId,
    branchId: effectiveBranchId,
    createdAt: selectedLead.createdAt,
  }).from(selectedLead)
    .leftJoin(queue, and(eq(queue.id, selectedLead.queueId), eq(queue.tenantId, selectedLead.tenantId)))
    .where(and(...conditions))
    .orderBy(asc(selectedLead.createdAt), asc(selectedLead.id));
}

export async function resolvePostSaleAudience(context: TenantContext, audience: PostSaleAudience, now = new Date()): Promise<PostSaleAudiencePreview> {
  const db = getDatabase();
  const leads = await selectCandidates(context, audience);
  const emptyExcluded = Object.fromEntries(Object.keys(POST_SALE_EXCLUSION_LABELS).map((key) => [key, 0])) as Record<PostSaleExclusionReason, number>;
  if (!leads.length) return { totalSelected: 0, totalEligible: 0, canStart: false, excluded: emptyExcluded, examples: [], recipients: [], skippedRecipients: [] };
  const leadIds = leads.map((lead) => lead.leadId);
  const cooldownDate = new Date(now.getTime() - POST_SALE_SURVEY_COOLDOWN_DAYS * 86_400_000);
  const humanCutoff = new Date(now.getTime() - 24 * 3_600_000);

  const [messages, conversations, recentSurveys, optOuts, humanMessages, metaChannels, wahaNumbers] = await Promise.all([
    db.select({
      id: schema.whatsappMessages.id,
      leadId: schema.whatsappMessages.leadId,
      provider: schema.whatsappMessages.provider,
      communicationChannelId: schema.whatsappMessages.communicationChannelId,
      wahaNumberId: schema.whatsappMessages.wahaNumberId,
      direction: schema.whatsappMessages.direction,
      senderRole: schema.whatsappMessages.senderRole,
      sentAt: schema.whatsappMessages.sentAt,
    }).from(schema.whatsappMessages).where(and(
      eq(schema.whatsappMessages.tenantId, context.tenantId),
      inArray(schema.whatsappMessages.leadId, leadIds),
      inArray(schema.whatsappMessages.direction, ["incoming", "inbound", "outgoing", "outbound"]),
      notStatusBroadcastSql(schema.whatsappMessages.messageId),
      or(isNull(schema.whatsappMessages.providerStatus), ne(schema.whatsappMessages.providerStatus, "failed")),
    )).orderBy(asc(schema.whatsappMessages.sentAt), asc(schema.whatsappMessages.id)),
    db.select({ leadId: schema.aiConversations.leadId, status: schema.aiConversations.status, optOutAt: schema.aiConversations.optOutAt, wrongNumberAt: schema.aiConversations.wrongNumberAt, lastActivityAt: schema.aiConversations.lastActivityAt, updatedAt: schema.aiConversations.updatedAt })
      .from(schema.aiConversations).where(and(eq(schema.aiConversations.tenantId, context.tenantId), inArray(schema.aiConversations.leadId, leadIds)))
      .orderBy(desc(schema.aiConversations.updatedAt)),
    db.select({ leadId: schema.postSaleSurveys.leadId, status: schema.postSaleSurveys.status }).from(schema.postSaleSurveys).where(and(
      eq(schema.postSaleSurveys.tenantId, context.tenantId),
      inArray(schema.postSaleSurveys.leadId, leadIds),
      inArray(schema.postSaleSurveys.status, ["queued", "sent", "answering", "completed", "no_reply", "opted_out"]),
      or(gte(schema.postSaleSurveys.createdAt, cooldownDate), eq(schema.postSaleSurveys.status, "opted_out")),
    )),
    db.select({ leadId: schema.postSaleOptOuts.leadId }).from(schema.postSaleOptOuts).where(and(
      eq(schema.postSaleOptOuts.tenantId, context.tenantId),
      inArray(schema.postSaleOptOuts.leadId, leadIds),
    )),
    db.select({ leadId: schema.whatsappMessages.leadId }).from(schema.whatsappMessages).where(and(
      eq(schema.whatsappMessages.tenantId, context.tenantId),
      inArray(schema.whatsappMessages.leadId, leadIds),
      inArray(schema.whatsappMessages.direction, ["outgoing", "outbound"]),
      or(isNull(schema.whatsappMessages.senderRole), ne(schema.whatsappMessages.senderRole, "assistant")),
      notExists(db.select({ id: schema.whatsappOutboundMessages.id }).from(schema.whatsappOutboundMessages).where(and(
        eq(schema.whatsappOutboundMessages.tenantId, schema.whatsappMessages.tenantId),
        eq(schema.whatsappOutboundMessages.providerMessageId, schema.whatsappMessages.messageId),
      ))),
      gte(schema.whatsappMessages.sentAt, humanCutoff),
      or(isNull(schema.whatsappMessages.providerStatus), ne(schema.whatsappMessages.providerStatus, "failed")),
    )),
    db.select({ id: schema.communicationChannels.id, tenantId: schema.communicationChannels.tenantId, branchId: schema.communicationChannels.branchId, provider: schema.communicationChannels.provider, status: schema.communicationChannels.status, registrationStatus: schema.communicationChannels.registrationStatus, wabaId: schema.communicationChannels.wabaId, phoneNumberId: schema.communicationChannels.phoneNumberId, accessTokenCiphertext: schema.communicationChannels.accessTokenCiphertext, onboardingMode: schema.communicationChannels.onboardingMode, isDefault: schema.communicationChannels.isDefault })
      .from(schema.communicationChannels).where(and(eq(schema.communicationChannels.tenantId, context.tenantId), inArray(schema.communicationChannels.provider, META_PROVIDERS))),
    db.select({ id: schema.wahaNumbers.id, tenantId: schema.wahaNumbers.tenantId, branchId: schema.wahaNumbers.branchId, scope: schema.wahaNumbers.scope, status: schema.wahaNumbers.status, pausedUntil: schema.wahaNumbers.pausedUntil })
      .from(schema.wahaNumbers).where(and(eq(schema.wahaNumbers.tenantId, context.tenantId), inArray(schema.wahaNumbers.scope, ["tenant", "branch"]))),
  ]);

  const channelSettings = await getSystemSettings(metaChannels.map((channel) => channelLeadIntakeKey(channel.id))).catch(() => []);
  const intakeQueueByChannel = new Map<string, string>();
  for (const setting of channelSettings) {
    const channelId = setting.key.slice("channel_lead_intake_".length);
    const intake = parseChannelLeadIntake(setting.value);
    if (intake.enabled && intake.queueId) intakeQueueByChannel.set(channelId, intake.queueId);
  }
  const wabaIds = [...new Set(metaChannels.map((channel) => channel.wabaId).filter((id): id is string => Boolean(id)))];
  const templates = wabaIds.length ? await db.select({
    wabaId: schema.metaWhatsAppTemplates.wabaId,
    language: schema.metaWhatsAppTemplates.language,
    category: schema.metaWhatsAppTemplates.category,
    bodyText: schema.metaWhatsAppTemplates.bodyText,
    variables: schema.metaWhatsAppTemplates.variablesJson,
    buttons: schema.metaWhatsAppTemplates.buttonsJson,
  })
    .from(schema.metaWhatsAppTemplates).where(and(
      eq(schema.metaWhatsAppTemplates.tenantId, context.tenantId),
      inArray(schema.metaWhatsAppTemplates.wabaId, wabaIds),
      eq(schema.metaWhatsAppTemplates.name, META_TEMPLATE_NAME),
      eq(schema.metaWhatsAppTemplates.status, "APPROVED"),
      isNull(schema.metaWhatsAppTemplates.deletedAt),
    )) : [];
  const approvedWabas = new Set(templates.filter(isApprovedPostSaleMetaTemplate).map((template) => template.wabaId));
  const byChannelId = new Map(metaChannels.map((channel) => [channel.id, channel]));
  const byWahaId = new Map(wahaNumbers.map((number) => [number.id, number]));
  const messagesByLead = new Map<string, typeof messages>();
  for (const message of messages) {
    if (!message.leadId) continue;
    const list = messagesByLead.get(message.leadId) ?? [];
    list.push(message);
    messagesByLead.set(message.leadId, list);
  }
  const conversationsByLead = new Map<string, typeof conversations>();
  for (const conversation of conversations) {
    if (!conversation.leadId) continue;
    const list = conversationsByLead.get(conversation.leadId) ?? [];
    list.push(conversation);
    conversationsByLead.set(conversation.leadId, list);
  }
  const recentSurveyLeadIds = new Set(recentSurveys.map((survey) => survey.leadId));
  const optedOutSurveyLeadIds = new Set(recentSurveys.filter((survey) => survey.status === "opted_out").map((survey) => survey.leadId));
  const durableOptOutLeadIds = new Set(optOuts.map((optOut) => optOut.leadId));
  const humanActiveLeadIds = new Set(humanMessages.map((message) => message.leadId).filter((id): id is string => Boolean(id)));

  type DefaultSourceState = PostSaleDefaultSourceState<NonNullable<Source>>;
  const defaultQueueSources = new Map<string, DefaultSourceState>();
  const resolveDefaultQueueSource = (lead: LeadRow): DefaultSourceState => {
    if (!lead.queueId) return { kind: "none" };
    const cacheKey = `${lead.queueId}:${lead.branchId ?? ""}`;
    const existing = defaultQueueSources.get(cacheKey);
    if (existing !== undefined) return existing;
    const mapped = metaChannels.filter((channel) => intakeQueueByChannel.get(channel.id) === lead.queueId);
    if (mapped.length === 1) {
      const state: DefaultSourceState = { kind: "one", source: { type: "meta", ref: mapped[0].id } };
      defaultQueueSources.set(cacheKey, state);
      return state;
    }
    if (mapped.length > 1) {
      const state: DefaultSourceState = { kind: "ambiguous" };
      defaultQueueSources.set(cacheKey, state);
      return state;
    }
    const branchMeta = metaChannels.filter((channel) => channel.isDefault && (channel.branchId === lead.branchId || channel.branchId === null));
    const branchWaha = wahaNumbers.filter((number) => isPostSaleWahaNumberAllowed(number, lead.branchId));
    const choices = [
      ...branchMeta.map((channel) => ({ type: "meta" as const, ref: channel.id })),
      ...branchWaha.map((number) => ({ type: "waha" as const, ref: number.id })),
    ];
    const state: DefaultSourceState = choices.length === 1 ? { kind: "one", source: choices[0] } : choices.length > 1 ? { kind: "ambiguous" } : { kind: "none" };
    defaultQueueSources.set(cacheKey, state);
    return state;
  };

  const excluded = { ...emptyExcluded };
  const recipients: PostSaleRecipient[] = [];
  const skippedRecipients: PostSaleAudiencePreview["skippedRecipients"] = [];
  for (const lead of leads) {
    const leadMessages = messagesByLead.get(lead.leadId) ?? [];
    const sourceMessage = pickPostSaleSourceMessage(leadMessages);
    const companyWaha = (): Source => {
      const number = pickPostSaleCompanyWaha(wahaNumbers, lead.branchId, now);
      return number ? { type: "waha", ref: number.id } : null;
    };
    // Origin on WAHA without a company number (broker's personal WhatsApp or unknown): company WAHA.
    // Ambiguous queue/unit channels are skipped as source_unavailable; only a missing source falls back.
    const source = choosePostSaleSource<NonNullable<Source>>({
      hasMessage: Boolean(sourceMessage),
      fromMessage: sourceMessage ? sourceFromMessage(sourceMessage) : null,
      messageProvider: sourceMessage?.provider ?? null,
      defaultState: sourceMessage ? null : resolveDefaultQueueSource(lead),
      companyWaha,
    });
    const leadConversations = conversationsByLead.get(lead.leadId) ?? [];
    const optedOut = isPostSaleOptedOut({
      conversationOptOutAt: leadConversations.find((conversation) => conversation.optOutAt)?.optOutAt,
      durableOptOut: durableOptOutLeadIds.has(lead.leadId),
      optedOutSurvey: optedOutSurveyLeadIds.has(lead.leadId),
    });
    const wrongNumber = leadConversations.some((conversation) => Boolean(conversation.wrongNumberAt));
    const humanActive = humanActiveLeadIds.has(lead.leadId) || leadConversations.some((conversation) =>
      ["WAITING_HUMAN", "HUMAN_ACTIVE"].includes(conversation.status)
      && conversation.lastActivityAt >= humanCutoff,
    );
    const metaChannel = source?.type === "meta" ? byChannelId.get(source.ref) : undefined;
    const wahaNumber = source?.type === "waha" ? byWahaId.get(source.ref) : undefined;
    const sourceAvailable = source?.type === "meta"
      ? Boolean(metaChannel && metaChannel.status === "active" && metaChannel.registrationStatus === "registered" && metaChannel.phoneNumberId && metaChannel.accessTokenCiphertext && metaChannel.wabaId)
      : source?.type === "waha"
        ? Boolean(wahaNumber && isPostSaleWahaNumberAllowed(wahaNumber, lead.branchId) && WAHA_STATUSES.includes(wahaNumber.status) && (!wahaNumber.pausedUntil || wahaNumber.pausedUntil <= now))
        : false;
    const templateApproved = source?.type === "meta" && metaChannel?.wabaId ? approvedWabas.has(metaChannel.wabaId) : source?.type === "waha";
    const brokerId = audience.kind === "broker" ? audience.brokerId : lead.currentBrokerId;
    const reason = evaluatePostSaleEligibility({
      phone: lead.phone,
      brokerId,
      optedOut,
      wrongNumber,
      recentSurvey: recentSurveyLeadIds.has(lead.leadId),
      humanActive,
      sourceAvailable,
      templateApproved,
    });
    if (reason) {
      excluded[reason] += 1;
      if ((reason === "source_unavailable" || reason === "template_unapproved") && brokerId) {
        skippedRecipients.push({
          leadId: lead.leadId,
          brokerId,
          phone: lead.phone,
          channelType: source?.type ?? null,
          channelRef: source?.ref ?? null,
          reason,
        });
      }
      continue;
    }
    recipients.push({
      leadId: lead.leadId,
      name: lead.name,
      phone: lead.phone,
      brokerId: brokerId!,
      queueId: lead.queueId,
      branchId: lead.branchId,
      channelType: source!.type,
      channelRef: source!.ref,
    });
  }

  return {
    totalSelected: leads.length,
    totalEligible: recipients.length,
    canStart: recipients.length > 0 && recipients.length <= 300,
    excluded,
    examples: recipients.slice(0, 3).map(({ leadId, name, channelType }) => ({ leadId, name, channelType })),
    recipients,
    skippedRecipients,
  };
}

export function postSaleExclusionLabel(reason: PostSaleExclusionReason) {
  return POST_SALE_EXCLUSION_LABELS[reason];
}
