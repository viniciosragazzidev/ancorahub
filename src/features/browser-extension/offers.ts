import "server-only";

import { and, asc, eq, gt, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDatabase, schema } from "@/shared/db";
import type { TenantContext } from "@/shared/auth/types";
import { handleLeadOfferWebhookResponse } from "@/features/lead-distribution/offers";
import { isBrokerRunningInDuty } from "@/features/lead-distribution/active-queue-duty-roster";
import { resolveLeadAcceptOutcome } from "@/features/leads/accept-offer-outcome";
import { loadBrokerGreetingSafe } from "@/features/leads/broker-greeting-server";
import { buildWhatsAppUrl, normalizeWhatsAppDestination } from "@/lib/whatsapp-url";
import { extensionAuditMetadata, type ExtensionAuditIdentity } from "./audit";
import { extensionTemperature, extensionTemperatureSchema } from "./payload";
import { maskPhone } from "./schemas";

export const extensionOfferIdSchema = z.string().uuid();
export const extensionOfferPayloadSchema = z.object({
  id: z.string(), expiresAt: z.string().datetime(), plantao: z.string().nullable(),
  temperatura: extensionTemperatureSchema, primeiroNome: z.string(), phoneMasked: z.string(), foraDoPlantao: z.boolean(),
}).strict();
const ACTIVE = ["PENDING", "SENT", "DELIVERED", "READ"];

export async function listExtensionOffers(context: TenantContext) {
  const rows = await getDatabase().select({
    id: schema.leadOffers.id, expiresAt: schema.leadOffers.expiresAt, dutyScheduleId: schema.leadOffers.dutyScheduleId,
    dutyName: schema.unitDutySchedules.name,
    name: schema.leads.nome, phone: schema.leads.telefone, qualificationStatus: schema.leads.qualificationStatus,
  }).from(schema.leadOffers)
    .innerJoin(schema.leads, and(eq(schema.leads.id, schema.leadOffers.leadId), eq(schema.leads.tenantId, context.tenantId)))
    .leftJoin(schema.unitDutySchedules, and(eq(schema.unitDutySchedules.id, schema.leadOffers.dutyScheduleId), eq(schema.unitDutySchedules.tenantId, context.tenantId)))
    .where(and(eq(schema.leadOffers.tenantId, context.tenantId), eq(schema.leadOffers.brokerId, context.userId),
      inArray(schema.leadOffers.status, ACTIVE), gt(schema.leadOffers.expiresAt, new Date()),
      isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt)))
    .orderBy(asc(schema.leadOffers.expiresAt));
  const dutyStatus = new Map(await Promise.all([...new Set(rows.flatMap((row) => row.dutyScheduleId ? [row.dutyScheduleId] : []))]
    // This field is advisory; a lookup failure must not hide offers or claim the broker is off duty.
    .map(async (dutyScheduleId) => [dutyScheduleId, await isBrokerRunningInDuty({
      tenantId: context.tenantId, brokerId: context.userId, dutyScheduleId,
    }).catch(() => true)] as const)));
  return rows.map((row) => extensionOfferPayloadSchema.parse({
    id: row.id, expiresAt: row.expiresAt.toISOString(), plantao: row.dutyName,
    temperatura: extensionTemperature(row.qualificationStatus),
    primeiroNome: row.name.trim().split(/\s+/)[0] || "Lead", phoneMasked: maskPhone(row.phone),
    foraDoPlantao: row.dutyScheduleId ? !dutyStatus.get(row.dutyScheduleId) : false,
  }));
}

async function findOwnOffer(context: TenantContext, offerId: string) {
  const [offer] = await getDatabase().select({
    id: schema.leadOffers.id, leadId: schema.leadOffers.leadId, status: schema.leadOffers.status,
  }).from(schema.leadOffers).where(and(eq(schema.leadOffers.id, offerId), eq(schema.leadOffers.tenantId, context.tenantId),
    eq(schema.leadOffers.brokerId, context.userId))).limit(1);
  return offer;
}

export async function respondToExtensionOffer(context: TenantContext, session: ExtensionAuditIdentity, offerId: string, action: "accept" | "decline") {
  const offer = await findOwnOffer(context, offerId);
  if (!offer) return { status: 404, body: { success: false, error: "NOT_FOUND", message: "Este lead não está mais disponível para você." } };
  const result = await handleLeadOfferWebhookResponse({
    tenantId: context.tenantId, brokerId: context.userId, offerId,
    buttonText: action === "accept" ? "aceitar" : "recusar",
    audit: { action: action === "accept" ? "extension.offer.accepted" : "extension.offer.declined", metadata: extensionAuditMetadata(session) },
  });
  if (action === "decline") {
    const declined = result.processed && result.action === "declined";
    const repeated = result.reason === "already_resolved" && (await findOwnOffer(context, offerId))?.status === "DECLINED";
    if (declined || repeated) {
      return { status: 200, body: { success: true, offerId, action: "declined", alreadyDeclined: Boolean(repeated),
        contaComoPulo: !repeated, message: repeated ? "Esta oferta já foi recusada." : "Oferta recusada. A recusa conta como pulo do plantão." } };
    }
    return { status: 409, body: { success: false, error: result.reason ?? "UNAVAILABLE", message: result.reason === "expired"
      ? "O prazo para aceitar este lead terminou." : "Esta oferta já foi respondida ou não está mais disponível." } };
  }
  if (!result.won && result.reason !== "already_accepted") {
    const outcome = resolveLeadAcceptOutcome(result, null, context.userId);
    return { status: 409, body: { success: false, error: result.reason ?? "UNAVAILABLE",
      message: outcome.ok ? "Este lead não está mais disponível para você." : outcome.error } };
  }
  // Re-check both the exact accepted offer and current ownership. Owning the lead via a different
  // offer never authorizes this offer's phone response, even on an idempotent retry.
  const [winner] = await getDatabase().select({
    id: schema.leads.id, nome: schema.leads.nome, telefone: schema.leads.telefone,
  }).from(schema.leads).innerJoin(schema.leadOffers, and(eq(schema.leadOffers.leadId, schema.leads.id),
    eq(schema.leadOffers.tenantId, context.tenantId), eq(schema.leadOffers.id, offerId),
    eq(schema.leadOffers.brokerId, context.userId), eq(schema.leadOffers.status, "ACCEPTED")))
    .where(and(eq(schema.leads.id, offer.leadId), eq(schema.leads.tenantId, context.tenantId), eq(schema.leads.corretorId, context.userId),
      isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt))).limit(1);
  if (!winner) return { status: 409, body: { success: false, error: "UNAVAILABLE", message: "Este lead não está mais disponível para você." } };
  const greeting = await loadBrokerGreetingSafe({ tenantId: context.tenantId, leadId: winner.id, brokerUserId: context.userId, leadName: winner.nome });
  return { status: 200, body: { success: true, offerId, leadId: winner.id, action: "accepted", alreadyAccepted: result.reason === "already_accepted",
    phone: normalizeWhatsAppDestination(winner.telefone), greeting, whatsappUrl: buildWhatsAppUrl(winner.telefone, greeting) } };
}
