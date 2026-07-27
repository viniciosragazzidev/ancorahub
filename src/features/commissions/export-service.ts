import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";

export type ExportParams = {
  tenantId: string;
  startMonth: string;
  endMonth: string;
  branchId?: string;
  brokerId?: string;
};

export type CommissionExportRow = {
  corretor: string;
  filial: string;
  lead: string;
  plano: string;
  operadora: string;
  dataVenda: string;
  mesReferencia: string;
  percentual: number;
  valor: number;
  status: string;
  dataPagamento: string | null;
};

export async function getCommissionExportData(params: ExportParams): Promise<CommissionExportRow[]> {
  const db = getDatabase();

  const conditions = [
    eq(schema.sales.tenantId, params.tenantId),
    sql`${schema.commissionSchedule.referenceMonth} >= ${params.startMonth}`,
    sql`${schema.commissionSchedule.referenceMonth} <= ${params.endMonth}`,
  ];

  if (params.branchId) {
    conditions.push(eq(schema.leads.branchId, params.branchId));
  }
  if (params.brokerId) {
    conditions.push(eq(schema.sales.brokerId, params.brokerId));
  }

  const rows = await db
    .select({
      corretor: schema.user.name,
      filial: schema.branches.name,
      lead: schema.leads.nome,
      planName: schema.carrierPlans.name,
      carrierName: schema.carriers.name,
      saleDate: schema.sales.saleDate,
      referenceMonth: schema.commissionSchedule.referenceMonth,
      percentage: schema.commissionSchedule.percentage,
      amount: schema.commissionSchedule.amount,
      status: schema.commissionSchedule.status,
      paidAt: schema.commissionSchedule.paidAt,
    })
    .from(schema.commissionSchedule)
    .innerJoin(schema.sales, eq(schema.commissionSchedule.saleId, schema.sales.id))
    .innerJoin(schema.user, eq(schema.sales.brokerId, schema.user.id))
    .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
    .leftJoin(schema.branches, eq(schema.leads.branchId, schema.branches.id))
    .leftJoin(schema.carrierPlans, eq(schema.sales.carrierPlanId, schema.carrierPlans.id))
    .leftJoin(schema.carriers, eq(schema.carrierPlans.carrierId, schema.carriers.id))
    .where(and(...conditions))
    .orderBy(desc(schema.sales.saleDate), schema.commissionSchedule.monthNumber);

  return rows.map((row) => ({
    corretor: row.corretor,
    filial: row.filial ?? "—",
    lead: row.lead,
    plano: row.planName ?? "—",
    operadora: row.carrierName ?? "—",
    dataVenda: formatDate(row.saleDate),
    mesReferencia: row.referenceMonth,
    percentual: Number(row.percentage),
    valor: Number(row.amount),
    status: row.status === "paid" ? "Pago" : row.status === "cancelled" ? "Cancelado" : "Pendente",
    dataPagamento: row.paidAt ? formatDate(row.paidAt) : null,
  }));
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function generateCsv(rows: CommissionExportRow[]): string {
  const headers = [
    "Corretor",
    "Filial",
    "Lead",
    "Plano",
    "Operadora",
    "Data Venda",
    "Mês Referência",
    "% Aplicado",
    "Valor (R$)",
    "Status",
    "Data Pagamento",
  ];

  const lines = [headers.join(";")];

  for (const row of rows) {
    lines.push(
      [
        escapeCsvField(row.corretor),
        escapeCsvField(row.filial),
        escapeCsvField(row.lead),
        escapeCsvField(row.plano),
        escapeCsvField(row.operadora),
        row.dataVenda,
        row.mesReferencia,
        String(row.percentual).replace(".", ","),
        String(row.valor).replace(".", ","),
        row.status,
        row.dataPagamento ?? "—",
      ].join(";"),
    );
  }

  return lines.join("\n");
}

function escapeCsvField(value: string): string {
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
