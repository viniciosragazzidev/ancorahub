import "server-only";
import { and, eq } from "drizzle-orm";
import { schema } from "@/shared/db";
import { auditErp, type ErpTransaction } from "./access";

/** Keeps the legacy schedule consistent with conferred ERP settlements; never the other way around. */
export async function syncLegacyInstallment(tx: ErpTransaction, tenantId: string, actorId: string, entry: { id: string; originCommissionId: string | null; amountCents: number }, settled: number) {
  if (!entry.originCommissionId) return;
  const [installment] = await tx.select({ id: schema.commissionSchedule.id, status: schema.commissionSchedule.status }).from(schema.commissionSchedule)
    .where(and(eq(schema.commissionSchedule.id, entry.originCommissionId), eq(schema.commissionSchedule.tenantId, tenantId))).limit(1).for("update");
  if (!installment) return;
  if (settled >= entry.amountCents && installment.status === "pending") {
    await tx.update(schema.commissionSchedule).set({ status: "paid", paidAt: new Date(), paidBy: actorId, notes: "Liquidado e conferido no Financeiro (ERP).", updatedAt: new Date() }).where(eq(schema.commissionSchedule.id, installment.id));
    await auditErp(tx, { tenantId, actorId, action: "erp.commissions.legacy_marked_paid", entityType: "commission_schedule", entityId: installment.id, metadata: { entryId: entry.id } });
  } else if (settled < entry.amountCents && installment.status === "paid") {
    await tx.update(schema.commissionSchedule).set({ status: "pending", paidAt: null, paidBy: null, notes: "Estorno conferido no Financeiro (ERP).", updatedAt: new Date() }).where(eq(schema.commissionSchedule.id, installment.id));
    await auditErp(tx, { tenantId, actorId, action: "erp.commissions.legacy_reopened", entityType: "commission_schedule", entityId: installment.id, metadata: { entryId: entry.id } });
  }
}
