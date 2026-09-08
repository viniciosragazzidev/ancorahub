import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, gt, inArray, lte, sql } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { resolveSystemUserId } from "@/shared/tenant/system-user";
import { enqueueMetaTemplateMessage, processMetaOutboundBatch } from "@/features/communication-channels/outbound-service";
import { buildLeadAssignmentConfirmedVariables, buildLeadOfferVariables } from "@/features/communication-channels/templates";
import { enqueueLeadEffectTx } from "@/features/leads/webhooks/services/lead-effect-outbox";

import { normalizePhone } from "@/shared/utils/phone";

function samePhone(left: string, right: string) {
  const a = normalizePhone(left);
  const b = normalizePhone(right);
  return Boolean(a && b) && (a === b || a.endsWith(b) || b.endsWith(a) || a.slice(-11) === b.slice(-11));
}

function readLeadFormValue(formData: unknown, keys: string[]) {
  if (!formData || typeof formData !== "object" || Array.isArray(formData)) return null;
  const record = formData as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

export type LeadOfferStatus = "PENDING" | "SENT" | "DELIVERED" | "READ" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "LOST" | "CANCELLED";

export async function createLeadOffersForBrokers(input: {
  tenantId: string;
  leadId: string;
  brokerIds: string[];
  responseTimeoutMinutes?: number;
  requestedBy?: string | null;
}) {
  const db = getDatabase();
  const timeoutMinutes = Math.max(1, Math.min(input.responseTimeoutMinutes ?? 3, 60));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + timeoutMinutes * 60_000);

  // 1. Fetch lead details
  const [lead] = await db
    .select({
      id: schema.leads.id,
      nome: schema.leads.nome,
      branchId: schema.leads.branchId,
      tipo: schema.leads.tipo,
    })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId)))
    .limit(1);

  if (!lead) throw new Error("Lead não encontrado.");

  // Fetch branch & tenant company name
  let branchName = "Unidade Principal";
  if (lead.branchId) {
    const [branch] = await db
      .select({ name: schema.branches.name })
      .from(schema.branches)
      .where(and(eq(schema.branches.id, lead.branchId), eq(schema.branches.tenantId, input.tenantId)))
      .limit(1);
    if (branch) branchName = branch.name;
  }

  const [tenant] = await db.select({ name: schema.tenants.name }).from(schema.tenants).where(eq(schema.tenants.id, input.tenantId)).limit(1);
  const companyName = tenant?.name || "CorreTop";
  const leadTypeLabel = lead.tipo === "pme" ? "PME" : lead.tipo === "pj" ? "Empresarial" : "Pessoa Física";

  // 2. Fetch brokers info
  const brokers = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      phone: schema.brokerProfiles.phone,
    })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
    .leftJoin(
      schema.brokerProfiles,
      and(
        eq(schema.brokerProfiles.userId, schema.user.id),
        eq(schema.brokerProfiles.tenantId, input.tenantId),
      ),
    )
    .where(
      and(
        eq(schema.tenantMemberships.tenantId, input.tenantId),
        eq(schema.tenantMemberships.role, "broker"),
        eq(schema.tenantMemberships.status, "active"),
        inArray(schema.user.id, input.brokerIds),
      ),
    );

  const createdOffers: Array<{ offerId: string; brokerId: string; whatsappMessageId?: string }> = [];

  for (const broker of brokers) {
    const destinationPhone = broker.phone;
    const offerId = randomUUID();
    const claimStatus = await db.transaction(async (tx) => {
      // Serialize offer creation per lead. This is the final guard against two
      // workers creating simultaneous active offers for different brokers.
      const [lockedLead] = await tx
        .select({ id: schema.leads.id, corretorId: schema.leads.corretorId })
        .from(schema.leads)
        .where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId)))
        .for("update")
        .limit(1);

      if (!lockedLead || lockedLead.corretorId) return null;

      const [activeOffer] = await tx
        .select({ id: schema.leadOffers.id })
        .from(schema.leadOffers)
        .where(
          and(
            eq(schema.leadOffers.tenantId, input.tenantId),
            eq(schema.leadOffers.leadId, input.leadId),
            inArray(schema.leadOffers.status, ["PENDING", "SENT", "DELIVERED", "READ"]),
            gt(schema.leadOffers.expiresAt, now),
          ),
        )
        .limit(1);
      if (activeOffer) return null;

      const [alreadyAttempted] = await tx
        .select({ id: schema.leadOffers.id })
        .from(schema.leadOffers)
        .where(
          and(
            eq(schema.leadOffers.tenantId, input.tenantId),
            eq(schema.leadOffers.leadId, input.leadId),
            eq(schema.leadOffers.brokerId, broker.id),
          ),
        )
        .limit(1);
      if (alreadyAttempted) return null;

      await tx.insert(schema.leadOffers).values({
        id: offerId,
        tenantId: input.tenantId,
        leadId: input.leadId,
        brokerId: broker.id,
        status: destinationPhone ? "PENDING" : "CANCELLED",
        offeredAt: now,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      });
      return destinationPhone ? "pending" as const : "unavailable" as const;
    });

    if (!claimStatus) continue;
    if (claimStatus === "unavailable" || !destinationPhone) {
      console.warn(`[createLeadOffersForBrokers] Corretor ${broker.id} (${broker.name}) não possui telefone cadastrado.`);
      if (input.requestedBy) {
        await db.insert(schema.auditLogs).values({
          id: randomUUID(),
          userId: input.requestedBy,
          entidade: "lead_offer",
          entidadeId: offerId,
          acao: "lead_offer_channel_unavailable",
        });
      }
      continue;
    }

    const idempotencyKey = `lead-offer:${input.leadId}:${broker.id}:${now.getTime()}`;
    const brokerName = broker.name || "Corretor(a)";

    // Enqueue approved offer template: novo_lead_
    // The synchronized template may use the lead name, but never receives its phone before acceptance.
    // The lead id is reserved for the text fallback link.
    let outbound: Awaited<ReturnType<typeof enqueueMetaTemplateMessage>>;
    try {
      outbound = await enqueueMetaTemplateMessage({
        tenantId: input.tenantId,
        recipientType: "user",
        recipientId: broker.id,
        destinationPhone,
        purpose: "newLeadAssignment",
        variables: buildLeadOfferVariables({
          corretorNome: brokerName,
          leadNome: lead.nome,
          empresa: companyName,
          tipoLead: leadTypeLabel,
          unidade: branchName,
          tempoResposta: String(timeoutMinutes),
          leadId: lead.id,
        }),
        requestedBy: input.requestedBy,
        idempotencyKey,
      });
    } catch (error) {
      await db
        .update(schema.leadOffers)
        .set({ status: "CANCELLED", updatedAt: new Date() })
        .where(
          and(
            eq(schema.leadOffers.id, offerId),
            eq(schema.leadOffers.tenantId, input.tenantId),
            eq(schema.leadOffers.status, "PENDING"),
          ),
        );
      if (input.requestedBy) {
        await db.insert(schema.auditLogs).values({
          id: randomUUID(),
          userId: input.requestedBy,
          entidade: "lead_offer",
          entidadeId: offerId,
          acao: "lead_offer_enqueue_failed",
        });
      }
      console.error("[createLeadOffersForBrokers] Falha ao enfileirar oferta; tentativa cancelada.", {
        tenantId: input.tenantId,
        leadId: input.leadId,
        brokerId: broker.id,
        error: error instanceof Error ? error.name : "unknown_error",
      });
      continue;
    }

    if (outbound.id) {
      await db
        .update(schema.leadOffers)
        .set({ outboundMessageId: outbound.id, updatedAt: new Date() })
        .where(eq(schema.leadOffers.id, offerId));
    }

    if (input.requestedBy) {
      await db.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: input.requestedBy,
        entidade: "lead_offer",
        entidadeId: offerId,
        acao: "lead_offer_created",
      });
    }

    createdOffers.push({ offerId, brokerId: broker.id, whatsappMessageId: outbound.id });
  }

  // Delivery stays in the durable outbound queue. The scheduler owns retry and
  // provider I/O so offer creation never holds the operational interface open.

  return { created: createdOffers.length, expiresAt, createdOffers };
}

export async function handleLeadOfferWebhookResponse(input: {
  tenantId: string;
  phone: string;
  buttonText?: string;
  buttonPayload?: string;
  providerMessageId?: string;
}) {
  const db = getDatabase();
  const phone = normalizePhone(input.phone);
  if (!phone) return { processed: false, reason: "invalid_phone" };

  // 1. Find broker user by phone number
  const allUsers = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      phone: schema.brokerProfiles.phone,
    })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
    .leftJoin(
      schema.brokerProfiles,
      and(
        eq(schema.brokerProfiles.userId, schema.user.id),
        eq(schema.brokerProfiles.tenantId, input.tenantId),
      ),
    )
    .where(and(eq(schema.tenantMemberships.tenantId, input.tenantId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.jobTitle, "broker")));

  const broker = allUsers.find((u) => u.phone && samePhone(u.phone, phone));
  if (!broker) return { processed: false, reason: "broker_not_found" };

  // 2. Find matching offer for this broker
  let offer: (typeof schema.leadOffers.$inferSelect) | undefined;

  if (input.providerMessageId) {
    const [matchedByMsg] = await db
      .select()
      .from(schema.leadOffers)
      .where(
        and(
          eq(schema.leadOffers.tenantId, input.tenantId),
          eq(schema.leadOffers.brokerId, broker.id),
          eq(schema.leadOffers.whatsappMessageId, input.providerMessageId),
        ),
      )
      .limit(1);
    offer = matchedByMsg;
  }

  if (!offer) {
    const [recentOffer] = await db
      .select()
      .from(schema.leadOffers)
      .where(
        and(
          eq(schema.leadOffers.tenantId, input.tenantId),
          eq(schema.leadOffers.brokerId, broker.id),
          inArray(schema.leadOffers.status, ["PENDING", "SENT", "DELIVERED", "READ"]),
        ),
      )
      .orderBy(sql`${schema.leadOffers.createdAt} DESC`)
      .limit(1);
    offer = recentOffer;
  }

  if (!offer) return { processed: false, reason: "offer_not_found" };

  const rawAction = (input.buttonText || input.buttonPayload || "").toLowerCase().trim();
  const isDecline = rawAction.includes("recusar") || rawAction.includes("decline") || rawAction === "recusar";
  const isAccept = rawAction.includes("aceitar") || rawAction.includes("accept") || rawAction === "aceitar lead";

  if (!isAccept && !isDecline) {
    return { processed: false, reason: "unrecognized_action" };
  }

  // Handle DECLINE
  if (isDecline) {
    const [declined] = await db
      .update(schema.leadOffers)
      .set({ status: "DECLINED", declinedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(schema.leadOffers.id, offer.id),
          eq(schema.leadOffers.tenantId, input.tenantId),
          inArray(schema.leadOffers.status, ["PENDING", "SENT", "DELIVERED", "READ"]),
        ),
      )
      .returning({ id: schema.leadOffers.id });

    if (!declined) return { processed: true, action: "declined", leadId: offer.leadId };

    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: broker.id,
      entidade: "lead_offer",
      entidadeId: offer.id,
      acao: "lead_offer_declined",
    });

    const { enqueueAndProcessLeadDistribution } = await import("./jobs");
    await enqueueAndProcessLeadDistribution({
      tenantId: input.tenantId,
      leadId: offer.leadId,
      source: "offer_declined",
    });

    return { processed: true, action: "declined", leadId: offer.leadId };
  }

  // Handle ACCEPT (Atomic Transaction with Row Locking)
  const result = await db.transaction(async (tx) => {
    const now = new Date();

    // Lock lead
    const [lead] = await tx
      .select({
        id: schema.leads.id,
        nome: schema.leads.nome,
        telefone: schema.leads.telefone,
        tipo: schema.leads.tipo,
        formData: schema.leads.formData,
        corretorId: schema.leads.corretorId,
        branchId: schema.leads.branchId,
        queueId: schema.leads.queueId,
      })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, offer.leadId), eq(schema.leads.tenantId, input.tenantId)))
      .for("update")
      .limit(1);

    if (!lead) return { won: false, reason: "lead_not_found" };

    // Lock current offer
    const [currentOffer] = await tx
      .select()
      .from(schema.leadOffers)
      .where(and(eq(schema.leadOffers.id, offer.id), eq(schema.leadOffers.tenantId, input.tenantId)))
      .for("update")
      .limit(1);

    if (!currentOffer) return { won: false, reason: "offer_not_found" };

    const isExpired = currentOffer.expiresAt <= now;
    const isAlreadyAssigned = Boolean(lead.corretorId);

    if (isExpired || isAlreadyAssigned || !["PENDING", "SENT", "DELIVERED", "READ"].includes(currentOffer.status)) {
      await tx
        .update(schema.leadOffers)
        .set({ status: isExpired ? "EXPIRED" : "LOST", updatedAt: now })
        .where(eq(schema.leadOffers.id, offer.id));

      return { won: false, reason: isExpired ? "expired" : "already_assigned", lead };
    }

    // WINNER CONFIRMED!
    // 1. Assign lead to winning broker
    await tx
      .update(schema.leads)
      .set({
        corretorId: broker.id,
        status: "distributed",
        distributionStatus: "assigned",
        assignedAt: now,
        assignmentSource: "whatsapp_offer_accepted",
        assignmentStrategy: "whatsapp_offer",
        distributionUpdatedAt: now,
      })
      .where(and(eq(schema.leads.id, lead.id), eq(schema.leads.tenantId, input.tenantId)));

    // 2. Update winning offer
    await tx
      .update(schema.leadOffers)
      .set({ status: "ACCEPTED", acceptedAt: now, updatedAt: now })
      .where(eq(schema.leadOffers.id, offer.id));

    // 3. Mark all other pending offers for this lead as LOST
    await tx
      .update(schema.leadOffers)
      .set({ status: "LOST", updatedAt: now })
      .where(
        and(
          eq(schema.leadOffers.tenantId, input.tenantId),
          eq(schema.leadOffers.leadId, lead.id),
          sql`${schema.leadOffers.id} != ${offer.id}`,
          inArray(schema.leadOffers.status, ["PENDING", "SENT", "DELIVERED", "READ"]),
        ),
      );

    await tx
      .update(schema.leadDistributionJobs)
      .set({
        status: "completed",
        completedAt: now,
        lockedAt: null,
        lockedBy: null,
        leaseExpiresAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.leadDistributionJobs.tenantId, input.tenantId),
          eq(schema.leadDistributionJobs.leadId, lead.id),
          inArray(schema.leadDistributionJobs.status, ["pending", "retrying", "processing"]),
        ),
      );

    // 4. Record audit log
    await tx.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: broker.id,
      entidade: "lead_offer",
      entidadeId: offer.id,
      acao: "lead_offer_accepted",
    });
    await enqueueLeadEffectTx(tx, {
      tenantId: input.tenantId,
      leadId: lead.id,
      type: "NOTIFY_LEAD_ASSIGNED",
      idempotencyKey: `lead-assigned:offer:${offer.id}`,
      payload: {
        branchId: lead.branchId,
        brokerId: broker.id,
        leadName: lead.nome,
        isRedistribution: "false",
        skipBrokerWhatsapp: "true",
      },
    });

    return { won: true, lead, broker };
  });

  if (result.won && result.lead && result.broker) {
    const brokerName = result.broker.name || "Corretor(a)";
    const leadTypeLabel = result.lead.tipo === "pme" ? "PME" : result.lead.tipo === "pj" ? "Empresarial" : "Pessoa Física";
    const interest = readLeadFormValue(result.lead.formData, ["produtoInteresse", "produto_interesse", "planoInteresse", "plano_interesse"])
      ?? "Plano de saúde";
    const dependents = readLeadFormValue(result.lead.formData, ["dependentes", "n_dependentes", "numeroDependentes", "qtdDependentes"])
      ?? "Não informado";

    // Enqueue confirmation template: lead_assignment_confirmed
    if (result.broker.phone) {
      await enqueueMetaTemplateMessage({
        tenantId: input.tenantId,
        recipientType: "user",
        recipientId: result.broker.id,
        destinationPhone: result.broker.phone,
        purpose: "leadAssignmentConfirmed",
        variables: buildLeadAssignmentConfirmedVariables({
          corretorNome: brokerName,
          clienteNome: result.lead.nome,
          clienteTelefone: result.lead.telefone,
          interesse: interest,
          tipo: leadTypeLabel,
          dependentes: dependents,
          leadId: result.lead.id,
        }),
        requestedBy: broker.id,
        idempotencyKey: `lead-confirmed:${result.lead.id}:${result.broker.id}`,
      });
    }

    // Notify other candidate brokers that lead was assigned to someone else
    const losingOffers = await db
      .select({ brokerId: schema.leadOffers.brokerId })
      .from(schema.leadOffers)
      .where(and(eq(schema.leadOffers.tenantId, input.tenantId), eq(schema.leadOffers.leadId, result.lead.id), eq(schema.leadOffers.status, "LOST")));

    for (const losingOffer of losingOffers) {
      const [losingBroker] = await db
        .select({
          id: schema.user.id,
          name: schema.user.name,
          phone: schema.brokerProfiles.phone,
        })
        .from(schema.user)
        .leftJoin(
          schema.brokerProfiles,
          and(
            eq(schema.brokerProfiles.userId, schema.user.id),
            eq(schema.brokerProfiles.tenantId, input.tenantId),
          ),
        )
        .where(eq(schema.user.id, losingOffer.brokerId))
        .limit(1);

      if (losingBroker && losingBroker.phone) {
        await enqueueMetaTemplateMessage({
          tenantId: input.tenantId,
          recipientType: "user",
          recipientId: losingBroker.id,
          destinationPhone: losingBroker.phone,
          purpose: "leadAssignmentUnavailable",
          variables: [losingBroker.name || "Corretor(a)"],
          requestedBy: broker.id,
          idempotencyKey: `lead-unavailable:${result.lead.id}:${losingBroker.id}`,
        });
      }
    }

    void processMetaOutboundBatch(10, input.tenantId).catch(console.error);

    return { processed: true, action: "accepted", won: true, leadId: result.lead.id };
  } else {
    // Send unavailable template to broker who lost the dispute
    const brokerName = broker.name || "Corretor(a)";
    const destPhone = broker.phone || input.phone;

    await enqueueMetaTemplateMessage({
      tenantId: input.tenantId,
      recipientType: "user",
      recipientId: broker.id,
      destinationPhone: destPhone,
      purpose: result.reason === "expired" ? "leadAssignmentExpired" : "leadAssignmentUnavailable",
      variables: [brokerName],
      requestedBy: broker.id,
      idempotencyKey: `lead-dispute-lost:${offer.id}:${Date.now()}`,
    });

    void processMetaOutboundBatch(10, input.tenantId).catch(console.error);

    return { processed: true, action: "accepted", won: false, reason: result.reason };
  }
}

export async function expireOutdatedLeadOffers(tenantId?: string) {
  const db = getDatabase();
  const now = new Date();

  const expiredOffers = await db
    .select({
      id: schema.leadOffers.id,
      tenantId: schema.leadOffers.tenantId,
      leadId: schema.leadOffers.leadId,
      brokerId: schema.leadOffers.brokerId,
    })
    .from(schema.leadOffers)
    .where(
      and(
        tenantId ? eq(schema.leadOffers.tenantId, tenantId) : undefined,
        inArray(schema.leadOffers.status, ["PENDING", "SENT", "DELIVERED", "READ"]),
        lte(schema.leadOffers.expiresAt, now),
      ),
    );

  let expiredCount = 0;

  for (const offer of expiredOffers) {
    const [updated] = await db
      .update(schema.leadOffers)
      .set({ status: "EXPIRED", updatedAt: now })
      .where(
        and(
          eq(schema.leadOffers.id, offer.id),
          eq(schema.leadOffers.tenantId, offer.tenantId),
          inArray(schema.leadOffers.status, ["PENDING", "SENT", "DELIVERED", "READ"]),
        ),
      )
      .returning({ id: schema.leadOffers.id });

    if (updated) {
      expiredCount += 1;

      const [broker] = await db
        .select({
          id: schema.user.id,
          name: schema.user.name,
          phone: schema.brokerProfiles.phone,
        })
        .from(schema.user)
        .leftJoin(
          schema.brokerProfiles,
          and(
            eq(schema.brokerProfiles.userId, schema.user.id),
            eq(schema.brokerProfiles.tenantId, offer.tenantId),
          ),
        )
        .where(eq(schema.user.id, offer.brokerId))
        .limit(1);

      if (broker && broker.phone) {
        await enqueueMetaTemplateMessage({
          tenantId: offer.tenantId,
          recipientType: "user",
          recipientId: broker.id,
          destinationPhone: broker.phone,
          purpose: "leadAssignmentExpired",
          variables: [broker.name || "Corretor(a)"],
      requestedBy: null,
          idempotencyKey: `offer-expired:${offer.id}`,
        });
      }

      const systemUserId = await resolveSystemUserId(offer.tenantId);
      await db.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: systemUserId,
        entidade: "lead_offer",
        entidadeId: offer.id,
        acao: "lead_offer_expired",
      });
    }
  }

  if (expiredCount > 0) {
    void processMetaOutboundBatch(10, tenantId).catch(console.error);
  }

  return { expired: expiredCount };
}
