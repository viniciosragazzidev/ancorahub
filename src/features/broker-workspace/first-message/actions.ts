"use server";

import { createHash, randomUUID } from "node:crypto";

import { and, count, eq, gte, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { startServiceOnFirstMessage } from "@/features/leads/start-service-on-message";
import { phoneHash } from "@/features/waha-cadence/contract";
import { sendWahaRelayMessage } from "@/features/waha-cadence/relay-client";
import { normalizeWahaUiStatus } from "@/features/waha-cadence/status";
import { buildWhatsAppUrl, normalizeWhatsAppDestination } from "@/lib/whatsapp-url";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { canRevealLightContact } from "../lead-contact-privacy";
import { buildFirstMessage, buildWhatsAppWebUrl, FIRST_MESSAGE_MAX_LENGTH, FIRST_MESSAGES_PER_HOUR } from "./first-message";

const OUTBOUND = ["outgoing", "outbound"];
const AUDIT_ENTITY = "lead_first_message";

export type FirstMessageContext = {
  ok: true;
  leadFirstName: string;
  message: string;
  connected: boolean;
  alreadySent: boolean;
  /** Only once the contact may be shown to the broker (accepted lead). */
  appUrl: string | null;
  webUrl: string | null;
} | { ok: false; error: string };

/** The broker's own lead, accepted, in this tenant (the only case the dialog serves). */
async function loadOwnLead(leadId: string) {
  const context = await getRequiredTenantContext();
  if (context.role !== "broker") return { context, lead: null };
  const [lead] = await getDatabase().select({
    id: schema.leads.id,
    nome: schema.leads.nome,
    telefone: schema.leads.telefone,
    status: schema.leads.status,
    branchId: schema.leads.branchId,
    distributionStatus: schema.leads.distributionStatus,
  }).from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId), eq(schema.leads.corretorId, context.userId), isNull(schema.leads.deletedAt)))
    .limit(1);
  return { context, lead: lead && lead.distributionStatus === "assigned" ? lead : null };
}

async function connectionOf(tenantId: string, userId: string) {
  const [connection] = await getDatabase().select({ sessionName: schema.whatsappConnections.sessionName, status: schema.whatsappConnections.status })
    .from(schema.whatsappConnections)
    .where(and(eq(schema.whatsappConnections.tenantId, tenantId), eq(schema.whatsappConnections.userId, userId)))
    .limit(1);
  const ready = Boolean(connection?.sessionName) && normalizeWahaUiStatus(connection?.status ?? "") === "ready";
  return { ready, sessionName: connection?.sessionName ?? null };
}

async function hasOutboundMessage(tenantId: string, leadId: string) {
  const [row] = await getDatabase().select({ id: schema.whatsappMessages.id }).from(schema.whatsappMessages)
    .where(and(eq(schema.whatsappMessages.tenantId, tenantId), eq(schema.whatsappMessages.leadId, leadId), inArray(schema.whatsappMessages.direction, OUTBOUND)))
    .limit(1);
  return Boolean(row);
}

/** What the dialog needs: the prefilled message, the connection and the fallback links. */
export async function getFirstMessageContextAction(leadId: string): Promise<FirstMessageContext> {
  try {
    const { context, lead } = await loadOwnLead(String(leadId).slice(0, 80));
    if (!lead) return { ok: false, error: "Este lead não está com você." };
    const db = getDatabase();
    const [[broker], [tenant], connection, alreadySent] = await Promise.all([
      db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, context.userId)).limit(1),
      db.select({ name: schema.tenants.name }).from(schema.tenants).where(eq(schema.tenants.id, context.tenantId)).limit(1),
      connectionOf(context.tenantId, context.userId),
      hasOutboundMessage(context.tenantId, lead.id),
    ]);
    const message = buildFirstMessage({ leadName: lead.nome, brokerName: broker?.name ?? null, companyName: tenant?.name ?? null });
    const reveal = canRevealLightContact({ status: lead.status, isCurrentBroker: true });
    const digits = reveal ? normalizeWhatsAppDestination(lead.telefone) : null;
    return {
      ok: true,
      leadFirstName: (lead.nome ?? "").trim().split(/\s+/)[0] ?? "",
      message,
      connected: connection.ready,
      alreadySent,
      appUrl: digits ? buildWhatsAppUrl(lead.telefone, message) : null,
      webUrl: digits ? buildWhatsAppWebUrl(digits, message) : null,
    };
  } catch {
    return { ok: false, error: "Não consegui abrir agora. Tente de novo." };
  }
}

const sendSchema = z.object({ leadId: z.string().min(1).max(80), text: z.string().trim().min(1, "Escreva a mensagem.").max(FIRST_MESSAGE_MAX_LENGTH, "Mensagem muito longa.") });

/**
 * Sends ONLY the first message of the lead through the broker's own WhatsApp.
 * Exception to "the personal connection only syncs" (decision 2026-10-10):
 * once per lead (stable idempotency key + no earlier outbound message), at most
 * FIRST_MESSAGES_PER_HOUR per broker, never to an opted-out number.
 */
export async function sendFirstMessageAction(raw: { leadId: string; text: string }): Promise<{ ok: true; webUrl: string | null } | { ok: false; error: string; code?: "already_sent" | "not_connected" | "rate_limited" }> {
  const input = sendSchema.safeParse(raw);
  if (!input.success) return { ok: false, error: input.error.issues[0]?.message ?? "Confira a mensagem." };
  try {
    const { context, lead } = await loadOwnLead(input.data.leadId);
    if (!lead) return { ok: false, error: "Este lead não está com você." };
    const db = getDatabase();

    if (await hasOutboundMessage(context.tenantId, lead.id)) return { ok: false, code: "already_sent", error: "A primeira mensagem já foi enviada. Continue pelo seu WhatsApp." };

    const [recent] = await db.select({ total: count() }).from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.userId, context.userId), eq(schema.auditLogs.entidade, AUDIT_ENTITY), gte(schema.auditLogs.createdAt, new Date(Date.now() - 3_600_000))));
    if (Number(recent?.total ?? 0) >= FIRST_MESSAGES_PER_HOUR) return { ok: false, code: "rate_limited", error: "Muitas mensagens pelo sistema nesta hora. Para proteger seu número, continue pelo WhatsApp." };

    // Opt-out was stored with either hash (raw digits in the CRM, normalized by the WAHA cadence): check both.
    const hashes = [...new Set([phoneHash(lead.telefone), createHash("sha256").update(lead.telefone.replace(/\D/g, "")).digest("hex")])];
    const [suppression] = await db.select({ id: schema.wahaSuppressions.id }).from(schema.wahaSuppressions).where(inArray(schema.wahaSuppressions.phoneHash, hashes)).limit(1);
    if (suppression) return { ok: false, error: "Este contato pediu para não receber mensagens." };

    const connection = await connectionOf(context.tenantId, context.userId);
    if (!connection.ready || !connection.sessionName) return { ok: false, code: "not_connected", error: "Seu WhatsApp não está conectado." };
    const digits = normalizeWhatsAppDestination(lead.telefone);
    if (!digits || !/^\d{10,15}$/.test(digits)) return { ok: false, error: "O telefone deste lead não é válido para WhatsApp." };

    const sent = await sendWahaRelayMessage({ idempotencyKey: `first-message:${context.tenantId}:${lead.id}`, sessionId: connection.sessionName, destination: digits, body: input.data.text });
    const sentAt = new Date();
    await db.insert(schema.whatsappMessages).values({
      id: randomUUID(),
      tenantId: context.tenantId,
      leadId: lead.id,
      provider: "waha",
      providerStatus: "sent",
      messageId: sent.messageId,
      phone: lead.telefone,
      direction: "outgoing",
      body: input.data.text,
      sentAt,
    }).onConflictDoNothing();
    await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: AUDIT_ENTITY, entidadeId: lead.id, acao: "enviou a primeira mensagem pelo WhatsApp do corretor (sistema)" });
    // The first real message starts the service (distributed -> in contact), as when it is sent from the phone.
    await startServiceOnFirstMessage({ tenantId: context.tenantId, leadId: lead.id, brokerId: context.userId, branchId: lead.branchId, trigger: "first_message" }).catch(() => false);
    revalidatePath(`/leads/${lead.id}`);
    return { ok: true, webUrl: buildWhatsAppWebUrl(digits) };
  } catch (error) {
    console.error("[first-message] send failed", error instanceof Error ? error.message : "unknown_error");
    return { ok: false, error: "O WhatsApp não confirmou o envio. Tente de novo ou abra no WhatsApp." };
  }
}
