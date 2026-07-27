"use server";

import "server-only";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { hasPermission } from "@/shared/auth/permissions";
import { AuthorizationError } from "@/shared/auth/errors";

export type SaleActionState = { success?: boolean; error?: string };

// ─── Mark schedule item as paid ────────────────────────────────────────────

export async function markCommissionPaidAction(
  _previous: SaleActionState,
  formData: FormData,
): Promise<SaleActionState> {
  try {
    const context = await getRequiredTenantContext();
    if (!hasPermission(context.role, "gerenciar_comissoes")) {
      throw new AuthorizationError("Apenas diretores podem marcar comissões como pagas.");
    }

    const scheduleId = formData.get("scheduleId");
    if (!scheduleId || typeof scheduleId !== "string") {
      return { error: "Parcela inválida." };
    }

    const db = getDatabase();

    // Verificar se a parcela pertence ao tenant
    const [item] = await db
      .select({ id: schema.commissionSchedule.id, status: schema.commissionSchedule.status })
      .from(schema.commissionSchedule)
      .innerJoin(schema.sales, eq(schema.commissionSchedule.saleId, schema.sales.id))
      .where(
        and(
          eq(schema.commissionSchedule.id, scheduleId),
          eq(schema.sales.tenantId, context.tenantId),
        ),
      )
      .limit(1);

    if (!item) return { error: "Parcela não encontrada." };
    if (item.status !== "pending") return { error: "Esta parcela já foi paga ou cancelada." };

    const notes = formData.get("notes");
    await db
      .update(schema.commissionSchedule)
      .set({
        status: "paid",
        paidAt: new Date(),
        paidBy: context.userId,
        notes: notes && typeof notes === "string" ? notes.trim() || null : null,
      })
      .where(eq(schema.commissionSchedule.id, scheduleId));

    // Revalidar paths relevantes
    revalidatePath("/vendas");
    revalidatePath(`/vendas/${item.id}`);

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível marcar como paga.",
    };
  }
}

// ─── Mark schedule item as unpaid (revert) ─────────────────────────────────

export async function markCommissionUnpaidAction(
  _previous: SaleActionState,
  formData: FormData,
): Promise<SaleActionState> {
  try {
    const context = await getRequiredTenantContext();
    if (!hasPermission(context.role, "gerenciar_comissoes")) {
      throw new AuthorizationError("Apenas diretores podem reverter pagamentos.");
    }

    const scheduleId = formData.get("scheduleId");
    if (!scheduleId || typeof scheduleId !== "string") {
      return { error: "Parcela inválida." };
    }

    const db = getDatabase();

    const [item] = await db
      .select({ id: schema.commissionSchedule.id, status: schema.commissionSchedule.status })
      .from(schema.commissionSchedule)
      .innerJoin(schema.sales, eq(schema.commissionSchedule.saleId, schema.sales.id))
      .where(
        and(
          eq(schema.commissionSchedule.id, scheduleId),
          eq(schema.sales.tenantId, context.tenantId),
        ),
      )
      .limit(1);

    if (!item) return { error: "Parcela não encontrada." };
    if (item.status !== "paid") return { error: "Esta parcela ainda não foi paga." };

    await db
      .update(schema.commissionSchedule)
      .set({
        status: "pending",
        paidAt: null,
        paidBy: null,
        notes: null,
      })
      .where(eq(schema.commissionSchedule.id, scheduleId));

    revalidatePath("/vendas");
    revalidatePath(`/vendas/${item.id}`);

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível reverter o pagamento.",
    };
  }
}
