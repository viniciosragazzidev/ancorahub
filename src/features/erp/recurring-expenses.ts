import "server-only";
import { createHash } from "node:crypto";
import { and, eq, inArray, ne, or } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { auditActor, auditErp, hasAgencyScope, requireErpAccess, type ErpTransaction } from "./access";
import { ErpError } from "./contracts";
import { financialTransaction, lockErpTenant, prepareFinancialEntryInTransaction } from "./finance";
import { scopedFinancialEntry, type ErpAccess } from "./records";
import { isRecurringExpensesReady } from "./recurring-flags";
import { canRepeatMonthly, competenceOf, firstRecurringCompetence, planRecurringExpenses } from "./recurring-expenses-core";

const NOT_READY = "A repetição mensal ainda não está disponível nesta empresa. Fale com o administrador.";

/** Mesma regra e mesmo mês dão sempre o mesmo `requestId`: a segunda tentativa cai no índice único e não duplica. */
export function recurringRequestId(ruleId: string, competence: string) {
  const hex = createHash("sha256").update(`erp-recurring:${ruleId}:${competence}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function ruleOf(tx: ErpTransaction, tenantId: string, entryId: string) {
  const rules = schema.erpRecurringExpenses; const runs = schema.erpRecurringExpenseRuns;
  const [rule] = await tx.select({ id: rules.id, status: rules.status }).from(rules)
    .where(and(eq(rules.tenantId, tenantId), eq(rules.status, "active"), or(
      eq(rules.originEntryId, entryId),
      inArray(rules.id, tx.select({ id: runs.recurringId }).from(runs).where(and(eq(runs.tenantId, tenantId), eq(runs.entryId, entryId)))),
    ))).limit(1).for("update");
  return rule ?? null;
}

/** Liga a repetição de uma despesa (diretor ou financeiro, dentro da empresa). Ligar de novo só reativa. */
export async function startRecurringInTransaction(tx: ErpTransaction, auth: ErpAccess, entryId: string, now = new Date()) {
  if (!(await isRecurringExpensesReady(tx))) throw new ErpError(NOT_READY);
  const entry = await scopedFinancialEntry(tx, auth, entryId, true);
  if (!canRepeatMonthly(entry)) throw new ErpError(entry.kind === "expense" ? "Despesa rejeitada não se repete." : "Só despesas podem se repetir todo mês.");
  const tenantId = auth.context.tenantId;
  const active = await ruleOf(tx, tenantId, entry.id);
  if (active) return active.id;
  const startsCompetence = firstRecurringCompetence(entry.competence, competenceOf(now));
  const [rule] = await tx.insert(schema.erpRecurringExpenses)
    .values({ id: crypto.randomUUID(), tenantId, originEntryId: entry.id, status: "active", startsCompetence, createdBy: auth.context.userId })
    .onConflictDoUpdate({
      target: [schema.erpRecurringExpenses.tenantId, schema.erpRecurringExpenses.originEntryId],
      // Reativar não cobra os meses em que a repetição ficou parada.
      set: { status: "active", startsCompetence, stoppedAt: null, stoppedBy: null },
    }).returning({ id: schema.erpRecurringExpenses.id });
  await auditErp(tx, { tenantId, actorId: auth.context.userId, action: "erp.finance.recurring_started", entityType: "erp_financial_entry", entityId: entry.id, metadata: { recurringId: rule.id, startsCompetence } });
  return rule.id;
}

export async function startRecurringExpense(entryId: string) {
  return financialTransaction("erp_prepare_finance", (tx, auth) => startRecurringInTransaction(tx, auth, entryId));
}

/** Prepara a despesa e, se pedido, já liga a repetição na mesma transação. */
export async function prepareFinancialEntryWithRecurrence(raw: unknown, repeatMonthly: boolean) {
  return financialTransaction("erp_prepare_finance", async (tx, auth) => {
    const id = await prepareFinancialEntryInTransaction(tx, auth, raw);
    if (repeatMonthly) await startRecurringInTransaction(tx, auth, id);
    return id;
  });
}

/** "Parar de repetir": vale para a origem ou qualquer mês já gerado. Os meses já gerados ficam como estão. */
export async function stopRecurringInTransaction(tx: ErpTransaction, auth: ErpAccess, entryId: string) {
  if (!(await isRecurringExpensesReady(tx))) throw new ErpError(NOT_READY);
  const entry = await scopedFinancialEntry(tx, auth, entryId, true);
  const rule = await ruleOf(tx, auth.context.tenantId, entry.id);
  if (!rule) return { id: entry.id, stopped: false };
  await tx.update(schema.erpRecurringExpenses).set({ status: "stopped", stoppedAt: new Date(), stoppedBy: auth.context.userId })
    .where(and(eq(schema.erpRecurringExpenses.tenantId, auth.context.tenantId), eq(schema.erpRecurringExpenses.id, rule.id)));
  await auditErp(tx, { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: "erp.finance.recurring_stopped", entityType: "erp_financial_entry", entityId: entry.id, metadata: { recurringId: rule.id } });
  return { id: entry.id, stopped: true };
}

export async function stopRecurringExpense(entryId: string) {
  return financialTransaction("erp_prepare_finance", (tx, auth) => stopRecurringInTransaction(tx, auth, entryId));
}

/** Lê as regras ativas da empresa e devolve o que falta gerar até o mês atual. */
async function pendingPlans(db: ErpTransaction | ReturnType<typeof getDatabase>, tenantId: string, current: string) {
  const rules = schema.erpRecurringExpenses; const runs = schema.erpRecurringExpenseRuns; const entries = schema.erpFinancialEntries;
  const active = await db.select({ rule: rules, origin: entries }).from(rules)
    .innerJoin(entries, and(eq(entries.tenantId, tenantId), eq(entries.id, rules.originEntryId)))
    .where(and(eq(rules.tenantId, tenantId), eq(rules.status, "active"), ne(entries.status, "rejected")));
  if (!active.length) return [];
  const [done, closed] = await Promise.all([
    db.select({ recurringId: runs.recurringId, competence: runs.competence }).from(runs)
      .where(and(eq(runs.tenantId, tenantId), inArray(runs.recurringId, active.map(({ rule }) => rule.id)))),
    db.select({ competence: schema.erpClosings.competence }).from(schema.erpClosings)
      .where(and(eq(schema.erpClosings.tenantId, tenantId), eq(schema.erpClosings.status, "closed"))),
  ]);
  const closedSet = new Set(closed.map((row) => row.competence));
  return active.map(({ rule, origin }) => ({
    rule, origin,
    plan: planRecurringExpenses({ rule, origin, current, closed: closedSet, generated: new Set(done.filter((row) => row.recurringId === rule.id).map((row) => row.competence)) }),
  })).filter((item) => item.plan.length);
}

/**
 * Gera, sob demanda ao abrir Despesas, os meses que viraram desde a última abertura. Sem job agendado.
 * Idempotente por despesa-origem + mês: trava da empresa, conferência dos meses já gerados, `requestId` determinístico
 * e índice único em `erp_recurring_expense_runs`. Cada mês nasce "A conferir" e segue evidência e aprovação.
 */
export async function generateDueRecurringExpenses(now = new Date()) {
  const auth = await requireErpAccess("finance", "erp_view_finance");
  const db = getDatabase();
  if (!hasAgencyScope(auth) || !(await isRecurringExpensesReady(db))) return 0;
  const tenantId = auth.context.tenantId; const current = competenceOf(now);
  if (!(await pendingPlans(db, tenantId, current)).length) return 0;
  return db.transaction(async (tx) => {
    await lockErpTenant(tx, tenantId);
    let created = 0;
    for (const { rule, origin, plan } of await pendingPlans(tx, tenantId, current)) {
      for (const item of plan) {
        const requestId = recurringRequestId(rule.id, item.competence);
        const [inserted] = await tx.insert(schema.erpFinancialEntries).values({
          id: crypto.randomUUID(), tenantId, kind: "expense", reference: item.reference, requestId, saleId: null, branchId: origin.branchId,
          beneficiaryId: origin.beneficiaryId, ownerId: origin.ownerId, description: origin.description, amountCents: origin.amountCents,
          dueOn: item.dueOn, competence: item.competence, createdBy: rule.createdBy,
        }).onConflictDoNothing().returning({ id: schema.erpFinancialEntries.id });
        let entryId = inserted?.id;
        if (!entryId) {
          const [existing] = await tx.select({ id: schema.erpFinancialEntries.id }).from(schema.erpFinancialEntries)
            .where(and(eq(schema.erpFinancialEntries.tenantId, tenantId), eq(schema.erpFinancialEntries.requestId, requestId))).limit(1);
          // A referência foi usada por outro lançamento: este mês fica para conferência manual, sem duplicar.
          if (!existing) continue;
          entryId = existing.id;
        }
        const [run] = await tx.insert(schema.erpRecurringExpenseRuns).values({ id: crypto.randomUUID(), tenantId, recurringId: rule.id, competence: item.competence, entryId })
          .onConflictDoNothing().returning({ id: schema.erpRecurringExpenseRuns.id });
        if (!run || !inserted) continue;
        created += 1;
        await auditErp(tx, { tenantId, actorId: auditActor(auth.context), action: "erp.finance.recurring_generated", entityType: "erp_financial_entry", entityId: entryId, metadata: { recurringId: rule.id, originEntryId: origin.id, competence: item.competence, amountCents: origin.amountCents } });
      }
    }
    return created;
  });
}

/** Para a tela: nunca derruba a lista se a geração falhar; o próximo acesso tenta de novo. */
export async function generateDueRecurringExpensesSafely() {
  try { return await generateDueRecurringExpenses(); }
  catch (error) {
    console.error("erp.recurring_generation_failed", { errorType: error instanceof Error ? error.name : "unknown" });
    return 0;
  }
}
