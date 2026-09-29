"use server";

import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { hasPermission } from "@/shared/auth/permissions";
import { AuthorizationError } from "@/shared/auth/errors";

export type SaleActionState = { success?: boolean; error?: string };
export type BulkExportState = { csvData?: string; count?: number; error?: string };

// ─── Bulk export sales as CSV ──────────────────────────────────────────────

export async function bulkExportSalesAction(
  _prev: BulkExportState,
  formData: FormData,
): Promise<BulkExportState> {
  try {
    const context = await getRequiredTenantContext();

    const saleIdsRaw = formData.getAll("saleId");
    const saleIds = saleIdsRaw.filter(Boolean).map(String);

    if (saleIds.length === 0) return { error: "Nenhuma venda selecionada." };

    const db = getDatabase();

    // Fetch selected sales with scope filtering
    const conditions = [
      inArray(schema.sales.id, saleIds),
      eq(schema.sales.tenantId, context.tenantId),
    ];

    if (context.role === "broker") {
      conditions.push(eq(schema.sales.brokerId, context.userId));
    } else if (context.role === "manager" && context.branchId) {
      conditions.push(eq(schema.leads.branchId, context.branchId));
    }

    const rows = await db
      .select({
        leadName: schema.leads.nome,
        clientName: schema.clients.nome,
        brokerName: schema.user.name,
        branchName: schema.branches.name,
        planName: schema.carrierPlans.name,
        carrierName: schema.carriers.name,
        saleDate: schema.sales.saleDate,
        saleValue: schema.sales.saleValue,
        status: schema.sales.status,
      })
      .from(schema.sales)
      .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
      .leftJoin(schema.clients, eq(schema.sales.clientId, schema.clients.id))
      .innerJoin(schema.user, eq(schema.sales.brokerId, schema.user.id))
      .leftJoin(schema.branches, eq(schema.leads.branchId, schema.branches.id))
      .leftJoin(schema.carrierPlans, eq(schema.sales.carrierPlanId, schema.carrierPlans.id))
      .leftJoin(schema.carriers, eq(schema.carrierPlans.carrierId, schema.carriers.id))
      .where(and(...conditions));

    // Generate CSV
    const headers = ["Lead/Cliente","Cliente","Corretor","Filial","Plano","Operadora","Data","Valor","Status"];
    const csvLines = [headers.join(";")];

    const statusLabels: Record<string, string> = {
      active: "Ativa",
      cancelled: "Cancelada",
    };

    for (const row of rows) {
      const val = Number(row.saleValue);
      csvLines.push([
        escapeCsv(row.leadName),
        escapeCsv(row.clientName ?? "—"),
        escapeCsv(row.brokerName ?? "—"),
        escapeCsv(row.branchName ?? "—"),
        escapeCsv(row.planName ?? "—"),
        escapeCsv(row.carrierName ?? "—"),
        formatDateShort(row.saleDate),
        val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        statusLabels[row.status] ?? row.status,
      ].join(";"));
    }

    return {
      csvData: csvLines.join("\n"),
      count: rows.length,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Erro ao exportar vendas.",
    };
  }
}

function escapeCsv(value: string): string {
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDateShort(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" }).format(date);
}

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


    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível reverter o pagamento.",
    };
  }
}
