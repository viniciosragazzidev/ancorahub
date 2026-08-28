import "server-only";

import { and, desc, eq, inArray, isNotNull, or } from "drizzle-orm";

import { enqueueMetaTemplateMessage } from "@/features/communication-channels/outbound-service";
import { getDatabase, schema } from "@/shared/db";
import { resolveSystemUserId } from "@/shared/tenant/system-user";
import { scheduleBrokerLeadNotification } from "./broker-lead-cadence";
import { checkBrokerNotificationCoalesceWindow, enqueueBrokerBatchSummaryNotification } from "./broker-notification-coalescer";

const FALLBACK_PRODUCT_INTEREST = "Plano de saúde";

function readProductInterest(formData: unknown) {
  if (!formData || typeof formData !== "object" || Array.isArray(formData)) return null;
  const record = formData as Record<string, unknown>;
  for (const key of ["produtoInteresse", "produto_interesse", "planoInteresse", "plano_interesse"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function formatBrokerRole(jobTitle: string | null) {
  const normalized = jobTitle?.trim().toLowerCase();
  if (!normalized || normalized === "broker" || normalized === "corretor" || normalized === "corretora") return "Corretor(a)";
  return jobTitle!.trim();
}

export function buildBrokerLeadNotificationVariables(input: {
  cargo: string;
  corretorNome: string;
  leadNome: string;
  produtoInteresse: string;
  leadId: string;
}) {
  return [input.cargo, input.corretorNome, input.leadNome, input.produtoInteresse, input.leadId];
}

/**
 * Queues the approved `new_lead_broker` template after ownership is already
 * durable. A delivery failure never changes the lead assignment.
 */
export async function enqueueBrokerLeadNotification(input: {
  tenantId: string;
  leadId: string;
  brokerId: string;
  idempotencyKey?: string;
}) {
  const db = getDatabase();
  const [lead] = await db
    .select({
      id: schema.leads.id,
      nome: schema.leads.nome,
      planId: schema.leads.planId,
      assignedAt: schema.leads.assignedAt,
      formData: schema.leads.formData,
      legacyPlanName: schema.carrierPlans.name,
      globalPlanName: schema.globalPlans.name,
      tenantPrivatePlanName: schema.tenantPrivatePlans.name,
    })
    .from(schema.leads)
    .leftJoin(schema.carrierPlans, and(eq(schema.leads.planId, schema.carrierPlans.id), eq(schema.carrierPlans.tenantId, input.tenantId)))
    .leftJoin(schema.globalPlans, eq(schema.leads.planId, schema.globalPlans.id))
    .leftJoin(schema.tenantPrivatePlans, and(eq(schema.leads.planId, schema.tenantPrivatePlans.id), eq(schema.tenantPrivatePlans.tenantId, input.tenantId)))
    .where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId), eq(schema.leads.corretorId, input.brokerId)))
    .limit(1);

  if (!lead) throw new Error("Lead não está atribuído ao corretor informado.");

  const [broker] = await db
    .select({
      name: schema.user.name,
      phone: schema.brokerProfiles.phone,
      jobTitle: schema.tenantMemberships.jobTitle,
    })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
    .leftJoin(schema.brokerProfiles, and(eq(schema.brokerProfiles.userId, schema.tenantMemberships.userId), eq(schema.brokerProfiles.tenantId, input.tenantId)))
    .where(and(
      eq(schema.tenantMemberships.tenantId, input.tenantId),
      eq(schema.tenantMemberships.userId, input.brokerId),
      eq(schema.tenantMemberships.status, "active"),
    ))
    .limit(1);

  const destinationPhone = broker?.phone?.trim();
  if (!destinationPhone) return { queued: false as const, reason: "broker_phone_missing" as const };

  const produtoInteresse = lead.legacyPlanName
    ?? lead.globalPlanName
    ?? lead.tenantPrivatePlanName
    ?? readProductInterest(lead.formData)
    ?? FALLBACK_PRODUCT_INTEREST;
  const assignmentVersion = lead.assignedAt?.toISOString() ?? "unversioned";
  const idempotencyKey = input.idempotencyKey
    ? `${input.idempotencyKey}:broker-whatsapp:${input.brokerId}`
    : `lead-assignment:${input.leadId}:${input.brokerId}:${assignmentVersion}:broker-whatsapp`;
  const requestedBy = await resolveSystemUserId(input.tenantId);
  const now = new Date();

  // Check if we should coalesce/batch notifications to prevent WhatsApp spam
  const coalesceCheck = await checkBrokerNotificationCoalesceWindow({
    tenantId: input.tenantId,
    brokerId: input.brokerId,
    now,
  });

  if (coalesceCheck.shouldCoalesce) {
    const summaryOutbound = await enqueueBrokerBatchSummaryNotification({
      tenantId: input.tenantId,
      brokerId: input.brokerId,
      destinationPhone,
    });
    return {
      queued: true as const,
      outboundId: summaryOutbound.id,
      duplicate: summaryOutbound.duplicate,
      coalesced: true as const,
    };
  }
  const [previousNotification] = await db.select({
    scheduledAt: schema.whatsappOutboundMessages.scheduledAt,
    sentAt: schema.whatsappOutboundMessages.sentAt,
    queuedAt: schema.whatsappOutboundMessages.queuedAt,
    createdAt: schema.whatsappOutboundMessages.createdAt,
  }).from(schema.whatsappOutboundMessages).where(and(
    eq(schema.whatsappOutboundMessages.tenantId, input.tenantId),
    eq(schema.whatsappOutboundMessages.recipientId, input.brokerId),
    eq(schema.whatsappOutboundMessages.purpose, "brokerLeadNotification"),
    inArray(schema.whatsappOutboundMessages.status, ["pending", "queued", "processing", "sent", "delivered", "read"]),
    or(isNotNull(schema.whatsappOutboundMessages.scheduledAt), isNotNull(schema.whatsappOutboundMessages.queuedAt)),
  )).orderBy(
    desc(schema.whatsappOutboundMessages.scheduledAt),
    desc(schema.whatsappOutboundMessages.sentAt),
    desc(schema.whatsappOutboundMessages.queuedAt),
    desc(schema.whatsappOutboundMessages.createdAt),
  ).limit(1);
  const previousAt = previousNotification?.scheduledAt
    ?? previousNotification?.sentAt
    ?? previousNotification?.queuedAt
    ?? previousNotification?.createdAt
    ?? null;
  const outbound = await enqueueMetaTemplateMessage({
    tenantId: input.tenantId,
    recipientType: "user",
    recipientId: input.brokerId,
    destinationPhone,
    purpose: "brokerLeadNotification",
    variables: buildBrokerLeadNotificationVariables({
      cargo: formatBrokerRole(broker.jobTitle),
      corretorNome: broker.name?.trim() || "Corretor(a)",
      leadNome: lead.nome,
      produtoInteresse,
      leadId: lead.id,
    }),
    requestedBy,
    idempotencyKey,
    scheduledAt: scheduleBrokerLeadNotification({ now, lastScheduledAt: previousAt }),
  });

  return { queued: true as const, outboundId: outbound.id, duplicate: outbound.duplicate };
}
