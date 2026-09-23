import "server-only";

import { randomUUID } from "node:crypto";
import { and, count, eq, gt, gte, inArray, isNull, lte, ne, sql } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { resolveSystemUserId } from "@/shared/tenant/system-user";
import { enqueueMetaTemplateMessage, processMetaOutboundBatch } from "@/features/communication-channels/outbound-service";
import { buildLeadAssignmentConfirmedVariables, buildLeadOfferVariables } from "@/features/communication-channels/templates";
import { enqueueLeadEffectTx } from "@/features/leads/webhooks/services/lead-effect-outbox";
import { buildDeclinedLeadReleaseUpdate } from "@/features/leads/decline-policy";
import { reserveQueueCapacitySlot } from "./queue-capacity";

import { normalizePhone } from "@/shared/utils/phone";
import { buildPendingLeadOfferLeadUpdate, isBlockingActiveOffer, resolveLeadOfferAcceptance } from "./domain";

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

const ACTIVE_OFFER_STATUSES: LeadOfferStatus[] = ["PENDING", "SENT", "DELIVERED", "READ"];

/** Responses without a provider message id are safe only when unambiguous. */
export function selectUnambiguousActiveOffer<T extends { status: string }>(offers: T[]) {
  const active = offers.filter((offer) => ACTIVE_OFFER_STATUSES.includes(offer.status as LeadOfferStatus));
  return active.length === 1 ? active[0] : null;
}

export async function createLeadOffersForBrokers(input: {
  tenantId: string;
  leadId: string;
  brokerIds: string[];
  responseTimeoutMinutes?: number;
  requestedBy?: string | null;
  expectedCurrentBrokerId?: string | null;
  targetBranchId: string;
  cycleStartedAt?: Date | null;
  queueId?: string | null;
  capacityPerBroker?: number | null;
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
      formData: schema.leads.formData,
    })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId)))
    .limit(1);

  if (!lead) throw new Error("Lead não encontrado.");

  const leadTypeLabel = lead.tipo === "pme" ? "PME" : lead.tipo === "pj" ? "Empresarial" : "Pessoa Física";
  const produtoInteresse = readLeadFormValue(lead.formData, [
    "produtoInteresse", "produto_interesse", "planoInteresse", "plano_interesse", "interesse",
  ]) ?? leadTypeLabel;

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
  let capacityReached = false;

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

      if (!lockedLead || lockedLead.corretorId !== (input.expectedCurrentBrokerId ?? null)) return null;

      const commitOffer = async () => {
      const activeOffers = await tx
        .select({
          id: schema.leadOffers.id,
          status: schema.leadOffers.status,
          offeredAt: schema.leadOffers.offeredAt,
          expiresAt: schema.leadOffers.expiresAt,
          outboundMessageId: schema.leadOffers.outboundMessageId,
        })
        .from(schema.leadOffers)
        .where(
          and(
            eq(schema.leadOffers.tenantId, input.tenantId),
            eq(schema.leadOffers.leadId, input.leadId),
            gt(schema.leadOffers.expiresAt, now),
          ),
        )
        .limit(50);
      // Exclusivity decision shared with the offer-cycle resolver so the
      // claim guard and the rotation never disagree about what blocks a
      // second offer (duplicate-offer bug).
      if (activeOffers.some((offer) => isBlockingActiveOffer(offer, now))) return null;

      const [alreadyAttempted] = await tx
        .select({ id: schema.leadOffers.id })
        .from(schema.leadOffers)
        .where(
          and(
            eq(schema.leadOffers.tenantId, input.tenantId),
            eq(schema.leadOffers.leadId, input.leadId),
            eq(schema.leadOffers.brokerId, broker.id),
            input.cycleStartedAt ? gte(schema.leadOffers.offeredAt, input.cycleStartedAt) : undefined,
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
      if (destinationPhone) {
        const assignmentEventId = randomUUID();
        // The offered broker becomes the provisional owner immediately so the
        // lead appears in the wallet and can be accepted. The source remains
        // `automatic_offer`, allowing decline/expiration to release or rotate
        // this link without treating it as confirmed attendance.
        await tx.update(schema.leads).set(buildPendingLeadOfferLeadUpdate({
          targetBranchId: input.targetBranchId,
          brokerId: broker.id,
          now,
        })).where(and(
          eq(schema.leads.id, input.leadId),
          eq(schema.leads.tenantId, input.tenantId),
          // A concurrent manual assignment or offer acceptance must not be
          // overwritten while this offer is being recorded.
          lockedLead.corretorId === null
            ? isNull(schema.leads.corretorId)
            : eq(schema.leads.corretorId, lockedLead.corretorId),
        ));
        await tx.insert(schema.leadDistributionEvents).values({
          id: assignmentEventId,
          tenantId: input.tenantId,
          leadId: input.leadId,
          fromBranchId: lead.branchId,
          toBranchId: input.targetBranchId,
          previousOwnerId: input.expectedCurrentBrokerId ?? null,
          newOwnerId: broker.id,
          action: "offer_sent",
          source: input.expectedCurrentBrokerId ? "redistribution" : "automatic",
          strategy: "automatic",
          reason: input.expectedCurrentBrokerId
            ? "Responsabilidade provisória transferida ao próximo corretor elegível."
            : "Responsabilidade provisória atribuída ao primeiro corretor elegível.",
          actorId: input.requestedBy ?? broker.id,
          metadata: { offeredBrokerId: broker.id, provisionalOwnership: true },
          createdAt: now,
        });
        if (input.requestedBy) {
          await tx.insert(schema.auditLogs).values({
            id: randomUUID(),
            userId: input.requestedBy,
            entidade: "lead_distribution",
            entidadeId: input.leadId,
            acao: "lead.provisional_owner_assigned",
          });
        }
      }
      return destinationPhone ? "pending" as const : "unavailable" as const;
      };

      if (input.queueId && input.capacityPerBroker !== undefined && input.capacityPerBroker !== null) {
        const reservation = await reserveQueueCapacitySlot({
          capacity: input.capacityPerBroker,
          withLock: async (work) => {
            // Transaction-level lock serializes reservations across concurrent
            // workers, even when they are processing different leads.
            await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.tenantId}), hashtext(${`${input.queueId}:${broker.id}`}))`);
            return work();
          },
          countActive: async () => {
            const [active] = await tx.select({ total: count(schema.leads.id) })
              .from(schema.leads)
              .where(and(
                eq(schema.leads.tenantId, input.tenantId),
                eq(schema.leads.queueId, input.queueId!),
                eq(schema.leads.corretorId, broker.id),
                inArray(schema.leads.status, ["distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"]),
                isNull(schema.leads.deletedAt),
                isNull(schema.leads.archivedAt),
                ne(schema.leads.id, input.leadId),
              ));
            return Number(active?.total ?? 0);
          },
          reserve: commitOffer,
        });
        if (reservation.status === "full") {
          capacityReached = true;
          return null;
        }
        return reservation.value;
      }

      return commitOffer();
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

    // Pending offers use the same approved `new_lead_broker` contract as a
    // confirmed assignment. The lead phone is never included before acceptance;
    // only the dynamic CRM URL button carries the lead id.
    let outbound: Awaited<ReturnType<typeof enqueueMetaTemplateMessage>>;
    try {
      outbound = await enqueueMetaTemplateMessage({
        tenantId: input.tenantId,
        recipientType: "user",
        recipientId: broker.id,
        destinationPhone,
        purpose: "newLeadAssignment",
        variables: buildLeadOfferVariables({
          cargo: "Corretor(a)",
          corretorNome: brokerName,
          leadNome: lead.nome,
          produtoInteresse,
          leadId: lead.id,
        }),
        requestedBy: input.requestedBy,
        idempotencyKey,
      });
    } catch (error) {
      const cancelledAt = new Date();
      await db.transaction(async (tx) => {
        await tx
          .update(schema.leadOffers)
          .set({ status: "CANCELLED", updatedAt: cancelledAt })
          .where(
            and(
              eq(schema.leadOffers.id, offerId),
              eq(schema.leadOffers.tenantId, input.tenantId),
              eq(schema.leadOffers.status, "PENDING"),
            ),
          );
        // Enqueue failure means there is no valid offer for this provisional
        // wallet entry. Release it only if this exact broker/source still owns
        // the lead; a concurrent manual assignment is never overwritten.
        await tx
          .update(schema.leads)
          .set(buildDeclinedLeadReleaseUpdate(cancelledAt))
          .where(and(
            eq(schema.leads.id, input.leadId),
            eq(schema.leads.tenantId, input.tenantId),
            eq(schema.leads.corretorId, broker.id),
            eq(schema.leads.assignmentSource, "automatic_offer"),
            isNull(schema.leads.deletedAt),
          ));
      });
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

      // Deliver the exact offer just created instead of waiting behind an
      // unrelated backlog. The durable outbox remains the source of truth and
      // the cron worker continues to recover transient provider failures.
      const delivery = await processMetaOutboundBatch(1, input.tenantId, outbound.id);
      if (delivery.sent !== 1) {
        console.warn("[createLeadOffersForBrokers] Oferta enfileirada para recuperação do worker.", {
          tenantId: input.tenantId,
          outboundMessageId: outbound.id,
          sent: delivery.sent,
          failed: delivery.failed,
          retried: delivery.retried,
        });
      }
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

  return { created: createdOffers.length, expiresAt, createdOffers, capacityReached };
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
    .where(and(
      eq(schema.tenantMemberships.tenantId, input.tenantId),
      eq(schema.tenantMemberships.role, "broker"),
      eq(schema.tenantMemberships.jobTitle, "broker"),
      eq(schema.tenantMemberships.status, "active"),
      eq(schema.user.active, true),
      eq(schema.user.status, "active"),
    ));

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
    // The offer row stores the outbox id, not the provider wamid. Before
    // falling back to the latest active offer, resolve the reply through the
    // outbox row so accepts/declines land even when context.id is absent.
    if (input.providerMessageId) {
      const [outboundRow] = await db
        .select({ id: schema.whatsappOutboundMessages.id })
        .from(schema.whatsappOutboundMessages)
        .where(and(
          eq(schema.whatsappOutboundMessages.tenantId, input.tenantId),
          eq(schema.whatsappOutboundMessages.providerMessageId, input.providerMessageId),
        ))
        .limit(1);
      if (outboundRow) {
        const [matchedByOutbound] = await db
          .select()
          .from(schema.leadOffers)
          .where(
            and(
              eq(schema.leadOffers.tenantId, input.tenantId),
              eq(schema.leadOffers.brokerId, broker.id),
              eq(schema.leadOffers.outboundMessageId, outboundRow.id),
            ),
          )
          .limit(1);
        offer = matchedByOutbound;
      }
    }
  }

  if (!offer) {
    const activeOffers = await db
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
      .limit(10);
    offer = selectUnambiguousActiveOffer(activeOffers) ?? undefined;
    if (!offer && activeOffers.length > 1) {
      return { processed: false, reason: "ambiguous_offer" };
    }
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
    const declinedAt = new Date();
    const declined = await db.transaction(async (tx) => {
      const [updatedOffer] = await tx
        .update(schema.leadOffers)
        .set({ status: "DECLINED", declinedAt, updatedAt: declinedAt })
        .where(
          and(
            eq(schema.leadOffers.id, offer.id),
            eq(schema.leadOffers.tenantId, input.tenantId),
            inArray(schema.leadOffers.status, ACTIVE_OFFER_STATUSES),
          ),
        )
        .returning({ id: schema.leadOffers.id });

      if (!updatedOffer) return false;

      await tx.update(schema.leads)
        .set(buildDeclinedLeadReleaseUpdate(declinedAt))
        .where(and(
          eq(schema.leads.id, offer.leadId),
          eq(schema.leads.tenantId, input.tenantId),
          eq(schema.leads.corretorId, broker.id),
          eq(schema.leads.assignmentSource, "automatic_offer"),
          isNull(schema.leads.deletedAt),
        ));

      return true;
    });

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
      .where(and(eq(schema.leads.id, offer.leadId), eq(schema.leads.tenantId, input.tenantId), isNull(schema.leads.deletedAt)))
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

    // Accept decision shared with the domain seam. The short grace applies
    // only while this broker still owns the pending offer provisionally.
    const decision = resolveLeadOfferAcceptance(
      { offerStatus: currentOffer.status, expiresAt: currentOffer.expiresAt, leadCorretorId: lead.corretorId, brokerId: broker.id },
      now,
    );
    const winningStatuses = ["PENDING", "SENT", "DELIVERED", "READ"] as const;
    if (decision.isExpired || decision.isAlreadyAssigned || !(winningStatuses as readonly string[]).includes(currentOffer.status)) {
      await tx
        .update(schema.leadOffers)
        .set({ status: decision.isExpired ? "EXPIRED" : "LOST", updatedAt: now })
        .where(eq(schema.leadOffers.id, offer.id));

      return { won: false, reason: decision.isExpired ? "expired" : "already_assigned", lead };
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
        firstContactAt: null,
        serviceStartedAt: null,
        serviceStartedBy: null,
      })
      .where(and(eq(schema.leads.id, lead.id), eq(schema.leads.tenantId, input.tenantId), lead.corretorId === null ? isNull(schema.leads.corretorId) : eq(schema.leads.corretorId, lead.corretorId)));

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
    const city = readLeadFormValue(result.lead.formData, ["cidade", "city", "municipio", "município", "cidade_residencia"])
      ?? "Não informada";

    // Enqueue confirmation template: lead_assignment_confirmed
    if (result.broker.phone) {
      const confirmationOutbound = await enqueueMetaTemplateMessage({
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
          cidade: city,
          leadId: result.lead.id,
        }),
        requestedBy: broker.id,
        idempotencyKey: `lead-confirmed:${result.lead.id}:${result.broker.id}`,
      });
      await processMetaOutboundBatch(1, input.tenantId, confirmationOutbound.id);
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
        const unavailableOutbound = await enqueueMetaTemplateMessage({
          tenantId: input.tenantId,
          recipientType: "user",
          recipientId: losingBroker.id,
          destinationPhone: losingBroker.phone,
          purpose: "leadAssignmentUnavailable",
          variables: [losingBroker.name || "Corretor(a)"],
          requestedBy: broker.id,
          idempotencyKey: `lead-unavailable:${result.lead.id}:${losingBroker.id}`,
        });
        await processMetaOutboundBatch(1, input.tenantId, unavailableOutbound.id);
      }
    }

    return { processed: true, action: "accepted", won: true, leadId: result.lead.id };
  } else {
    // Send unavailable template to broker who lost the dispute
    const brokerName = broker.name || "Corretor(a)";
    const destPhone = broker.phone || input.phone;

    const unavailableOutbound = await enqueueMetaTemplateMessage({
      tenantId: input.tenantId,
      recipientType: "user",
      recipientId: broker.id,
      destinationPhone: destPhone,
      purpose: result.reason === "expired" ? "leadAssignmentExpired" : "leadAssignmentUnavailable",
      variables: [brokerName],
      requestedBy: broker.id,
      idempotencyKey: `lead-dispute-lost:${offer.id}:${Date.now()}`,
    });
    await processMetaOutboundBatch(1, input.tenantId, unavailableOutbound.id);

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
      outboundMessageId: schema.leadOffers.outboundMessageId,
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
    // Deleted leads are terminal: expire silently without notifying the broker
    // or re-entering any distribution flow.
    const [activeLead] = await db
      .select({ id: schema.leads.id })
      .from(schema.leads)
      .where(and(
        eq(schema.leads.id, offer.leadId),
        eq(schema.leads.tenantId, offer.tenantId),
        isNull(schema.leads.deletedAt),
      ))
      .limit(1);
    if (!activeLead) {
      await db
        .update(schema.leadOffers)
        .set({ status: "EXPIRED", updatedAt: now })
        .where(and(eq(schema.leadOffers.id, offer.id), eq(schema.leadOffers.tenantId, offer.tenantId), inArray(schema.leadOffers.status, ACTIVE_OFFER_STATUSES)));
      continue;
    }

    const [updated] = await db
      .update(schema.leadOffers)
      .set({ status: "EXPIRED", updatedAt: now })
      .where(
        and(
          eq(schema.leadOffers.id, offer.id),
          eq(schema.leadOffers.tenantId, offer.tenantId),
          inArray(schema.leadOffers.status, ACTIVE_OFFER_STATUSES),
        ),
      )
      .returning({ id: schema.leadOffers.id });

    if (updated) {
      expiredCount += 1;

      // DEC-049: an expired offer must never be delivered afterwards. Cancel
      // the queued outbox row immediately so the broker does not receive an
      // offer whose accept is already dead ("lead indisponível" symptom).
      await db
        .update(schema.whatsappOutboundMessages)
        .set({
          status: "cancelled",
          providerErrorCode: "OFFER_EXPIRED",
          providerErrorMessage: "Oferta expirou antes do envio.",
          updatedAt: now,
        })
        .where(and(
          eq(schema.whatsappOutboundMessages.tenantId, offer.tenantId),
          eq(schema.whatsappOutboundMessages.id, offer.outboundMessageId ?? "__none__"),
          inArray(schema.whatsappOutboundMessages.status, ["queued", "pending"]),
        ));

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
        const expiredOutbound = await enqueueMetaTemplateMessage({
          tenantId: offer.tenantId,
          recipientType: "user",
          recipientId: broker.id,
          destinationPhone: broker.phone,
          purpose: "leadAssignmentExpired",
          variables: [broker.name || "Corretor(a)"],
          requestedBy: null,
          idempotencyKey: `offer-expired:${offer.id}`,
        });
        await processMetaOutboundBatch(1, offer.tenantId, expiredOutbound.id);
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

  return { expired: expiredCount };
}
