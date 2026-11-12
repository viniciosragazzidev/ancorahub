import "server-only";

import { randomUUID } from "node:crypto";

import { and, asc, eq, gt, inArray, isNull, lte, sql } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

import { gatewayAgentModel, decideTurn, type AgentModel } from "./agent";
import { prepareDealAudio } from "./audio";
import { AUTO_SALE_LIMITS, type DealFacts, type ManagerCallReason } from "./contracts";
import { pdfCount } from "./dispatch";
import { readAutoSaleFlags } from "./flag";
import { followUpNeedsTemplate, nextFollowUpAt, stepForNow } from "./follow-up";
import { isWithinSendWindow, nextSendWindowStart } from "./guardrails";
import { activePromotionLines, AUDIO_DECLINE_MESSAGE, followUpMessage, imageCaption, pdfCaption, quoteMessages } from "./quote-messages";
import { catalogToday, createOfferForDeal, QuoteUnavailableError } from "./quote-service";
import { listOffers, listTurns, type DealRow } from "./repository";
import { activePromotions, brokerageInfo, callManager, cancelPendingOutgoing, dealRuntime, endDealBySystem, moveLeadForStage, queueOutgoing, recordTurn, type OutgoingItem } from "./service";
import { planTurn, QUESTION_FOR } from "./turn-engine";
import { quoteLinkMessage } from "./public-link";
import { missingForQuote } from "./facts";

const NO_CHEAPER_MESSAGE = "Essa já é a opção mais em conta para o seu perfil. Quer que eu te explique o que cada uma cobre?";

/** Avisa só o gestor da negociação, sem mudar o estado (ex.: áudio que não deu para ouvir). */
async function notifyManagerOnly(deal: DealRow, title: string, message: string) {
  await getDatabase().insert(schema.notifications).values({ id: randomUUID(), tenantId: deal.tenantId, recipientUserId: deal.chosenBy, leadId: deal.leadId, type: "auto_sale_notice", title, message }).catch(() => undefined);
}

/**
 * Um turno do agente sobre a rajada do cliente (§6 a §8). Reivindica a negociação com o prazo visto
 * (revisão do plano: webhook e job não respondem duas vezes) e, se chegou mensagem nova no meio, cancela
 * o que acabou de preparar e rearma a rajada.
 */
export async function runDealTurn(seen: DealRow, options: { model?: AgentModel; now?: Date } = {}) {
  const db = getDatabase();
  const now = options.now ?? new Date();
  const [deal] = await db.update(schema.autoSaleDeals).set({ replyDueAt: null, updatedAt: now })
    .where(and(eq(schema.autoSaleDeals.id, seen.id), eq(schema.autoSaleDeals.status, "active"), seen.replyDueAt ? eq(schema.autoSaleDeals.replyDueAt, seen.replyDueAt) : isNull(schema.autoSaleDeals.replyDueAt)))
    .returning();
  if (!deal) return { status: "skipped" as const };
  const flags = await readAutoSaleFlags(deal.tenantId);
  if (!flags.enabled || !flags.global) return { status: "disabled" as const };
  if (deal.mode !== "simulation" && !isWithinSendWindow(now, flags.settings)) {
    await db.update(schema.autoSaleDeals).set({ replyDueAt: nextSendWindowStart(now, flags.settings) }).where(eq(schema.autoSaleDeals.id, deal.id));
    return { status: "deferred" as const };
  }
  const [owner] = await db.select({ corretorId: schema.leads.corretorId }).from(schema.leads).where(and(eq(schema.leads.id, deal.leadId), eq(schema.leads.tenantId, deal.tenantId))).limit(1);
  if (owner?.corretorId) {
    await endDealBySystem(deal, "assigned_elsewhere");
    return { status: "assigned_elsewhere" as const };
  }
  const startedAt = new Date();
  const inbound = await db.select().from(schema.autoSaleTurns)
    .where(and(eq(schema.autoSaleTurns.dealId, deal.id), eq(schema.autoSaleTurns.direction, "in"), isNull(schema.autoSaleTurns.processedAt)))
    .orderBy(asc(schema.autoSaleTurns.createdAt));
  if (!inbound.length) return { status: "nothing" as const };

  // Áudio liberado na negociação (D6): vira texto; o que não deu para ouvir pede para escrever e avisa o gestor.
  const texts: string[] = [];
  let audioDeclined = false;
  let mediaReceived = false;
  let transcriptionCost = 0;
  for (const turn of inbound) {
    if (turn.kind === "audio" && turn.providerMessageId) {
      const outcome = await prepareDealAudio({ tenantId: deal.tenantId, leadId: deal.leadId, dealId: deal.id, dealCreatedAt: deal.createdAt, providerMessageId: turn.providerMessageId, settings: flags.settings });
      if (outcome.kind === "transcribed") { texts.push(outcome.text); transcriptionCost += outcome.costUsd; await db.update(schema.autoSaleTurns).set({ body: outcome.text }).where(eq(schema.autoSaleTurns.id, turn.id)); }
      else audioDeclined = true;
    } else if (turn.kind.startsWith("media:")) mediaReceived = true;
    else if (turn.body?.trim()) texts.push(turn.body.trim());
  }
  const markProcessed = () => db.update(schema.autoSaleTurns).set({ processedAt: new Date() }).where(inArray(schema.autoSaleTurns.id, inbound.map((turn) => turn.id)));
  if (transcriptionCost > 0) await db.update(schema.autoSaleDeals).set({ transcriptionCostUsd: sql`${schema.autoSaleDeals.transcriptionCostUsd} + ${transcriptionCost}` }).where(eq(schema.autoSaleDeals.id, deal.id));

  // Documento ou foto do cliente depois do pedido de documentos: chama o gestor.
  if (mediaReceived && (deal.stage === "documents" || deal.stage === "closing")) {
    await markProcessed();
    await callManager(deal, "documents_received");
    return { status: "manager" as const };
  }
  if (!texts.length) {
    await markProcessed();
    if (audioDeclined) {
      const turnId = await recordTurn(deal, { direction: "out", kind: "audio_declined", body: AUDIO_DECLINE_MESSAGE });
      await queueOutgoing(deal, [{ kind: "text", body: AUDIO_DECLINE_MESSAGE }], turnId);
      await notifyManagerOnly(deal, "Venda Automatizada: áudio não ouvido", "O cliente mandou um áudio que não deu para ouvir. A assistente pediu para escrever.");
    }
    return { status: "no_text" as const };
  }

  const offers = (await listOffers(deal.tenantId, deal.id)).map((offer) => offer.snapshot);
  const runtime = dealRuntime(deal);
  const today = catalogToday();
  const promotions = await activePromotions(deal.tenantId, today);
  const brokerage = await brokerageInfo(deal.tenantId);
  const history = (await listTurns(deal.tenantId, deal.id, 24)).filter((turn) => (turn.direction === "in" || turn.direction === "out") && turn.body && !inbound.some((item) => item.id === turn.id)).map((turn) => ({ direction: turn.direction as "in" | "out", body: turn.body! }));
  const model = options.model ?? gatewayAgentModel({ tenantId: deal.tenantId, userId: deal.chosenBy, leadId: deal.leadId });
  const facts = deal.facts as DealFacts;
  const { decision, model: modelName } = await decideTurn(model, { facts, stage: deal.stage, offers, promotions: activePromotionLines(promotions), history, inbound: texts, brokerageName: brokerage.name, mode: deal.mode }).catch(() => ({ decision: null, model: null }));
  const plan = planTurn({ stage: deal.stage, facts, misunderstoodCount: deal.misunderstoodCount, offers, hasActivePromotion: promotions.length > 0, networkSourced: runtime.networkSourced }, texts, decision);
  const turnId = await recordTurn(deal, {
    direction: "system", kind: "decision", body: null, intent: plan.intent, objection: plan.objection, facts: plan.facts, model: modelName,
    decision: { action: plan.action, quote: plan.quote, callManager: plan.callManager, stop: plan.stop, injection: plan.injection, stage: plan.stage }, guard: plan.violations.length ? plan.violations : null,
  });
  await markProcessed();
  await db.update(schema.autoSaleDeals).set({ facts: plan.facts, misunderstoodCount: plan.misunderstoodCount, limits: { ...runtime, guardBlocks: runtime.guardBlocks + (plan.violations.length ? 1 : 0) }, updatedAt: new Date() }).where(eq(schema.autoSaleDeals.id, deal.id));
  const current = { ...deal, facts: plan.facts };

  if (plan.stop === "opt_out") {
    await endDealBySystem(current, "opt_out");
    return { status: "opt_out" as const };
  }

  const items: OutgoingItem[] = plan.messages.map((body) => ({ kind: "text", body }));
  let stage = plan.stage;
  let managerReason: ManagerCallReason | null = plan.callManager;
  if (plan.quote) {
    try {
      const created = await createOfferForDeal({ deal: { id: deal.id, tenantId: deal.tenantId, leadId: deal.leadId, mode: deal.mode, facts: plan.facts }, kind: plan.quote, previous: offers.at(-1) ?? null, customerName: plan.facts.firstName ?? "cliente", brokerage, promotions });
      const quoteTexts = quoteMessages(created.snapshot);
      if (flags.settings.quoteLink) {
        // Link da página pública (pedido de 12/11): sai como texto em qualquer canal, inclusive WAHA; o PDF fica na página.
        const question = quoteTexts.pop()!;
        for (const body of quoteTexts) items.push({ kind: "text", body });
        items.push({ kind: "text", body: quoteLinkMessage(created.publicUrl), offerId: created.snapshot.id });
        items.push({ kind: "text", body: question });
      } else {
        for (const body of quoteTexts) items.push({ kind: "text", body });
        created.images.forEach((image, index) => {
          const plan_ = created.snapshot.plans.find((item) => item.id === image.planId);
          if (plan_) items.push({ kind: "image", body: imageCaption(plan_, index, created.snapshot.plans.length), mediaKey: image.key, mediaMime: "image/png", offerId: created.snapshot.id });
        });
        if ((await pdfCount(deal.id)) < AUTO_SALE_LIMITS.pdfPerDeal) items.push({ kind: "document", body: pdfCaption(), mediaKey: created.pdf.key, mediaFilename: created.pdf.filename, mediaMime: "application/pdf", offerId: created.snapshot.id });
      }
      await db.update(schema.autoSaleDeals).set({ firstQuoteAt: deal.firstQuoteAt ?? new Date(), limits: { ...runtime, networkSourced: created.networkSourced } }).where(eq(schema.autoSaleDeals.id, deal.id));
    } catch (error) {
      const code = error instanceof QuoteUnavailableError ? error.code : "catalog_unavailable";
      if (!(error instanceof QuoteUnavailableError)) console.error("[auto-sale] quote_failed", { dealId: deal.id, error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
      if (code === "missing_facts") items.push({ kind: "text", body: QUESTION_FOR[missingForQuote(plan.facts)[0] ?? "ages"] });
      else if (code === "no_cheaper") items.push({ kind: "text", body: NO_CHEAPER_MESSAGE });
      else managerReason = "price_off_catalog";
      stage = deal.stage;
    }
  }

  const queued = await queueOutgoing(deal, managerReason && !plan.callManager ? [] : items, turnId);
  if (managerReason) {
    if (!plan.callManager) await queueOutgoing(deal, [{ kind: "text", body: "Vou confirmar isso e já te retorno." }], `${turnId}-hold`);
    await callManager(current, managerReason);
  } else {
    const offerNow = plan.quote ? new Date() : null;
    const quotedAt = offerNow ?? deal.firstQuoteAt;
    await db.update(schema.autoSaleDeals).set({
      stage,
      documentsRequestedAt: plan.action === "request_documents" ? deal.documentsRequestedAt ?? new Date() : deal.documentsRequestedAt,
      followUpStep: plan.quote ? 0 : deal.followUpStep,
      nextFollowUpAt: quotedAt ? nextFollowUpAt({ step: plan.quote ? 0 : deal.followUpStep, quotedAt, lastCustomerMessageAt: deal.lastCustomerMessageAt, window: flags.settings }) : null,
      updatedAt: new Date(),
    }).where(eq(schema.autoSaleDeals.id, deal.id));
    await moveLeadForStage(deal, stage);
  }

  // Corrida: chegou mensagem do cliente enquanto o turno rodava. O que foi preparado ficou velho.
  const [newer] = await db.select({ id: schema.autoSaleTurns.id }).from(schema.autoSaleTurns)
    .where(and(eq(schema.autoSaleTurns.dealId, deal.id), eq(schema.autoSaleTurns.direction, "in"), isNull(schema.autoSaleTurns.processedAt), gt(schema.autoSaleTurns.createdAt, startedAt))).limit(1);
  if (newer && queued.length && !managerReason) {
    await db.update(schema.autoSaleOutbox).set({ status: "cancelled", holdReason: "Superada por mensagem nova do cliente", updatedAt: new Date() })
      .where(and(inArray(schema.autoSaleOutbox.id, queued), inArray(schema.autoSaleOutbox.status, ["draft", "approved"])));
    await db.update(schema.autoSaleDeals).set({ replyDueAt: new Date(Date.now() + flags.settings.burstWaitSeconds * 1000) }).where(and(eq(schema.autoSaleDeals.id, deal.id), eq(schema.autoSaleDeals.status, "active")));
    return { status: "superseded" as const };
  }
  return { status: managerReason ? "manager" as const : "replied" as const, action: plan.action };
}

/** Follow-ups vencidos (§10): mensagem sem preço; fora da janela da Meta, fica retida esperando template. */
export async function runDueFollowUps(now = new Date(), limit = 5) {
  const db = getDatabase();
  const due = await db.select().from(schema.autoSaleDeals)
    .where(and(eq(schema.autoSaleDeals.status, "active"), lte(schema.autoSaleDeals.nextFollowUpAt, now), isNull(schema.autoSaleDeals.replyDueAt))).limit(limit);
  let queued = 0;
  for (const deal of due) {
    const flags = await readAutoSaleFlags(deal.tenantId);
    if (!flags.enabled || !flags.global) continue;
    const claimed = await db.update(schema.autoSaleDeals).set({ nextFollowUpAt: null, updatedAt: now })
      .where(and(eq(schema.autoSaleDeals.id, deal.id), eq(schema.autoSaleDeals.nextFollowUpAt, deal.nextFollowUpAt!))).returning({ id: schema.autoSaleDeals.id });
    if (!claimed.length) continue;
    const step = stepForNow(deal.followUpStep, deal.lastCustomerMessageAt, now);
    if (step >= 4) { await callManager(deal, "stage_timeout"); continue; }
    const offers = (await listOffers(deal.tenantId, deal.id)).map((offer) => offer.snapshot);
    const body = followUpMessage(step, offers.at(-1) ?? null, deal.facts as DealFacts, await activePromotions(deal.tenantId, catalogToday()));
    const turnId = await recordTurn(deal, { direction: "out", kind: `follow_up_${step}`, body });
    const ids = await queueOutgoing(deal, [{ kind: "text", body }], turnId);
    if (deal.channel === "meta" && followUpNeedsTemplate(step)) {
      await db.update(schema.autoSaleOutbox).set({ status: "held", holdReason: "Fora da janela de 24 h: precisa do template venda_retomada_cotacao aprovado." }).where(inArray(schema.autoSaleOutbox.id, ids));
    }
    await db.update(schema.autoSaleDeals).set({ followUpStep: step + 1, nextFollowUpAt: nextFollowUpAt({ step: step + 1, quotedAt: deal.firstQuoteAt, lastCustomerMessageAt: deal.lastCustomerMessageAt ?? deal.firstQuoteAt, window: flags.settings }), updatedAt: now })
      .where(eq(schema.autoSaleDeals.id, deal.id));
    queued += 1;
  }
  return { queued };
}

/** Gestor sem ação além do prazo (revisão do plano): devolve o lead à distribuição e libera a vaga. */
export async function closeIdleDeals(now = new Date()) {
  const db = getDatabase();
  const open = await db.select().from(schema.autoSaleDeals).where(inArray(schema.autoSaleDeals.status, ["paused", "waiting_manager"]));
  let closed = 0;
  for (const deal of open) {
    const { settings } = await readAutoSaleFlags(deal.tenantId);
    if (now.getTime() - deal.updatedAt.getTime() < settings.idleManagerHours * 3_600_000) continue;
    await endDealBySystem(deal, "manager_idle");
    await getDatabase().insert(schema.notifications).values({ id: randomUUID(), tenantId: deal.tenantId, recipientUserId: deal.chosenBy, leadId: deal.leadId, type: "auto_sale_notice", title: "Venda Automatizada encerrada", message: "A negociação ficou sem decisão além do prazo e o lead voltou para a distribuição." }).catch(() => undefined);
    closed += 1;
  }
  return { closed };
}

export { cancelPendingOutgoing };
