"use server";

import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { postgresErrorCode } from "@/shared/db/postgres-errors";

import { OPEN_DEAL_STATUSES, type DealFacts } from "./contracts";
import { readAutoSaleFlags } from "./flag";
import { allowedMoneyFromOffers, checkOutgoingMessages, sanitizeMessage, type GuardViolation } from "./guardrails";
import { getDealDetail, listPromotions, wahaNumbersForLead } from "./queries";
import { getDeal, leadIdsInActiveAutoSale, listOffers } from "./repository";
import { setAutoSaleWatch } from "./watch";
import { assertManager, audit, AutoSaleError, endDeal, handOffToBroker, listBrokersForHandOff, searchLeadsForAutoSale, setDealMode, setDealPaused, startDeal, startNextHotDeal, takeOverDeal } from "./service";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const PATH = "/vendas/automatizada";

async function guarded<T>(work: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    if (error instanceof AutoSaleError) return { ok: false, error: error.message };
    if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Dados inválidos." };
    const code = postgresErrorCode(error);
    console.error("[auto-sale] action_failed", { code, error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    // Regra do banco recusou (ex.: o motivo "auto_sale" da 0228 atualizada) ou tabela ausente: diz o que falta.
    if (code === "23514" || code === "42P01" || code === "42703") return { ok: false, error: "O banco ainda não tem a atualização da Venda Automatizada. Rode o SQL da migração 0228 e tente de novo." };
    return { ok: false, error: "Não foi possível concluir agora. Tente novamente." };
  }
}

async function managerContext() {
  const context = await getRequiredTenantContext();
  assertManager(context);
  const flags = await readAutoSaleFlags(context.tenantId);
  if (!flags.enabled) throw new AutoSaleError("A Venda Automatizada está desligada para esta empresa.");
  return context;
}

const id = z.string().min(1).max(80);

export async function searchAutoSaleLeadsAction(input: unknown) {
  return guarded(async () => {
    const parsed = z.object({ query: z.string().max(80).default(""), onlyHot: z.boolean().default(true) }).parse(input);
    return searchLeadsForAutoSale(await managerContext(), parsed);
  });
}

export async function getAutoSaleChannelsAction(leadId: unknown) {
  return guarded(async () => wahaNumbersForLead(await managerContext(), id.parse(leadId)));
}

export async function startAutoSaleDealAction(input: unknown) {
  return guarded(async () => {
    const parsed = z.object({ leadId: id, channel: z.enum(["meta", "waha"]), wahaNumberId: id.nullable().default(null), mode: z.enum(["simulation", "copilot", "autopilot"]) }).parse(input);
    const result = await startDeal(await managerContext(), parsed);
    revalidatePath(PATH);
    return result;
  });
}

/**
 * "Pegar o próximo quente": havendo lead quente disponível e nenhuma negociação aberta, começa já; senão
 * liga a espera, e a distribuição entrega à Venda Automatizada o próximo lead que ficar quente.
 */
export async function startNextHotDealAction(input: unknown): Promise<Result<{ kind: "started"; dealId: string; leadName: string } | { kind: "watching" }>> {
  return guarded(async () => {
    const parsed = z.object({ mode: z.enum(["simulation", "copilot", "autopilot"]).default("copilot") }).parse(input ?? {});
    const context = await managerContext();
    const hasOpenDeal = (await leadIdsInActiveAutoSale(context.tenantId)).size > 0;
    if (!hasOpenDeal) {
      try {
        const started = await startNextHotDeal(context, parsed);
        revalidatePath(PATH);
        return { kind: "started" as const, ...started };
      } catch (error) {
        if (!(error instanceof AutoSaleError)) throw error;
      }
    }
    await setAutoSaleWatch(context, { armed: true, mode: parsed.mode });
    revalidatePath(PATH);
    return { kind: "watching" as const };
  });
}

export async function stopAutoSaleWatchAction() {
  return guarded(async () => {
    await setAutoSaleWatch(await managerContext(), { armed: false, mode: "copilot" });
    revalidatePath(PATH);
    return undefined;
  });
}

export async function getAutoSaleDealAction(dealId: unknown) {
  return guarded(async () => {
    const detail = await getDealDetail(await managerContext(), id.parse(dealId));
    if (!detail) throw new AutoSaleError("Negociação não encontrada.");
    return detail;
  });
}

/**
 * Copiloto: o gestor aprova (e pode editar) cada mensagem. Texto editado passa de novo pelos guardrails;
 * com violação, só sai com confirmação explícita, auditada.
 */
export async function approveAutoSaleMessageAction(input: unknown): Promise<Result<{ violations?: GuardViolation[] }>> {
  return guarded(async () => {
    const parsed = z.object({ outboxId: id, body: z.string().trim().min(1).max(1000).optional(), confirmOverride: z.boolean().default(false) }).parse(input);
    const context = await managerContext();
    const db = getDatabase();
    const [item] = await db.select().from(schema.autoSaleOutbox).where(and(eq(schema.autoSaleOutbox.id, parsed.outboxId), eq(schema.autoSaleOutbox.tenantId, context.tenantId))).limit(1);
    if (!item || !["draft", "held"].includes(item.status)) throw new AutoSaleError("Esta mensagem já foi enviada ou descartada.");
    const deal = await getDeal(context.tenantId, item.dealId);
    if (!deal || !(OPEN_DEAL_STATUSES as readonly string[]).includes(deal.status)) throw new AutoSaleError("A negociação já foi encerrada.");
    if (context.role === "manager" && deal.chosenBy !== context.userId) throw new AutoSaleError("Só quem escolheu a negociação decide por ela.");
    if (deal.mode === "simulation") throw new AutoSaleError("Em Simulação nada é enviado. Troque o modo para Copiloto.");
    const body = parsed.body !== undefined ? sanitizeMessage(parsed.body) : item.body;
    if (parsed.body !== undefined && item.kind === "text" && body !== item.body) {
      const offers = (await listOffers(context.tenantId, deal.id)).map((offer) => offer.snapshot);
      const facts = deal.facts as DealFacts;
      const violations = checkOutgoingMessages([body ?? ""], { allowedMoney: allowedMoneyFromOffers(offers, [facts.currentPriceCents, facts.budgetCents].filter((value): value is number => typeof value === "number")), hasActivePromotion: true, networkSourced: true })
        .filter((violation) => violation.rule === "price_not_in_snapshot" || violation.rule === "forbidden_promise" || violation.rule === "medical_advice");
      if (violations.length && !parsed.confirmOverride) return { violations };
      if (violations.length) await audit(context.userId, deal.id, "auto_sale.guard_override", { outboxId: item.id, violations });
    }
    const now = new Date();
    await db.update(schema.autoSaleOutbox).set({ status: "approved", body, approvedBy: context.userId, approvedAt: now, holdReason: null, scheduledAt: now, updatedAt: now })
      .where(and(eq(schema.autoSaleOutbox.id, item.id), inArray(schema.autoSaleOutbox.status, ["draft", "held"])));
    await audit(context.userId, deal.id, "auto_sale.message_approved", { outboxId: item.id, edited: body !== item.body, kind: item.kind });
    revalidatePath(PATH);
    return {};
  });
}

export async function discardAutoSaleMessageAction(outboxId: unknown) {
  return guarded(async () => {
    const context = await managerContext();
    const db = getDatabase();
    const updated = await db.update(schema.autoSaleOutbox).set({ status: "cancelled", holdReason: "Descartada pelo gestor", updatedAt: new Date() })
      .where(and(eq(schema.autoSaleOutbox.id, id.parse(outboxId)), eq(schema.autoSaleOutbox.tenantId, context.tenantId), inArray(schema.autoSaleOutbox.status, ["draft", "held"]))).returning({ dealId: schema.autoSaleOutbox.dealId });
    if (updated[0]) await audit(context.userId, updated[0].dealId, "auto_sale.message_discarded", { outboxId });
    revalidatePath(PATH);
    return undefined;
  });
}

export async function updateAutoSaleDealAction(input: unknown) {
  return guarded(async () => {
    const parsed = z.discriminatedUnion("op", [
      z.object({ op: z.literal("pause"), dealId: id }),
      z.object({ op: z.literal("resume"), dealId: id }),
      z.object({ op: z.literal("take_over"), dealId: id }),
      z.object({ op: z.literal("end"), dealId: id, outcome: z.enum(["return_to_distribution", "lost"]) }),
      z.object({ op: z.literal("mode"), dealId: id, mode: z.enum(["simulation", "copilot", "autopilot"]) }),
      z.object({ op: z.literal("hand_off"), dealId: id, brokerId: id }),
    ]).parse(input);
    const context = await managerContext();
    if (parsed.op === "pause" || parsed.op === "resume") await setDealPaused(context, parsed.dealId, parsed.op === "pause");
    else if (parsed.op === "take_over") await takeOverDeal(context, parsed.dealId);
    else if (parsed.op === "end") await endDeal(context, parsed.dealId, parsed.outcome);
    else if (parsed.op === "mode") await setDealMode(context, parsed.dealId, parsed.mode);
    else await handOffToBroker(context, parsed.dealId, parsed.brokerId);
    revalidatePath(PATH);
    return undefined;
  });
}

export async function searchHandOffBrokersAction(query: unknown) {
  return guarded(async () => listBrokersForHandOff(await managerContext(), z.string().max(60).parse(query ?? "")));
}

export async function listAutoSalePromotionsAction() {
  return guarded(async () => listPromotions(await managerContext()));
}

/** Promoções vigentes (D9): só o diretor cadastra; o agente só cita o que está aqui, com a data de fim. */
export async function saveAutoSalePromotionAction(input: unknown) {
  return guarded(async () => {
    const context = await managerContext();
    if (context.role !== "director") throw new AutoSaleError("Só o diretor cadastra promoções.");
    const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
    const parsed = z.discriminatedUnion("op", [
      z.object({ op: z.literal("create"), operator: z.string().trim().min(2).max(80), title: z.string().trim().min(3).max(120), description: z.string().trim().min(3).max(400), startsOn: day, endsOn: day }),
      z.object({ op: z.literal("deactivate"), promotionId: id }),
    ]).parse(input);
    const db = getDatabase();
    if (parsed.op === "create") {
      if (parsed.endsOn < parsed.startsOn) throw new AutoSaleError("O fim precisa ser depois do início.");
      const promotionId = randomUUID();
      await db.insert(schema.autoSalePromotions).values({ id: promotionId, tenantId: context.tenantId, operator: parsed.operator, title: parsed.title, description: parsed.description, startsOn: parsed.startsOn, endsOn: parsed.endsOn, createdBy: context.userId });
      await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "auto_sale_promotion", entidadeId: promotionId, acao: "auto_sale.promotion_created", metadata: { operator: parsed.operator, endsOn: parsed.endsOn } });
    } else {
      await db.update(schema.autoSalePromotions).set({ active: false, updatedAt: new Date() }).where(and(eq(schema.autoSalePromotions.id, parsed.promotionId), eq(schema.autoSalePromotions.tenantId, context.tenantId)));
      await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "auto_sale_promotion", entidadeId: parsed.promotionId, acao: "auto_sale.promotion_deactivated", metadata: {} });
    }
    revalidatePath(PATH);
    return listPromotions(context);
  });
}
