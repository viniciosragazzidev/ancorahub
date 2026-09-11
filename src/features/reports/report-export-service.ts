import { randomUUID } from "node:crypto";

import * as XLSX from "xlsx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { z } from "zod";

import { getSupervisedBrokerIds } from "@/features/team/supervisor-service";
import { hasCapability } from "@/shared/auth/permissions";
import type { TenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { getReportDefinition, type ReportFormat, type ReportId } from "./report-registry";

const MAX_EXPORT_ROWS = 10_000;
const MAX_RANGE_DAYS = 366;

const inputSchema = z.object({
  start: z.coerce.date(),
  end: z.coerce.date(),
  format: z.enum(["xlsx", "csv", "pdf"]).default("xlsx"),
  branchId: z.string().optional(),
});

export type ReportExport = { body: Uint8Array | string; contentType: string; filename: string; rows: number };

function safeCell(value: unknown): string | number | boolean {
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "boolean") return value;
  const text = value instanceof Date ? value.toISOString() : String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function toRows(rows: Record<string, unknown>[]) {
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, safeCell(value)])));
}

function encodeCsv(rows: Record<string, unknown>[]) {
  const normalized = toRows(rows);
  const columns = Object.keys(normalized[0] ?? {});
  const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return `\uFEFF${[columns.join(";"), ...normalized.map((row) => columns.map((column) => quote(row[column])).join(";"))].join("\r\n")}`;
}

function printable(value: unknown) {
  return String(value ?? "").replace(/[\r\n]+/g, " ").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

async function encodePdf(title: string, start: Date, end: Date, rows: Record<string, unknown>[]) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 36;
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const lineHeight = 12;
  const maxChars = 105;
  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  const addPage = () => { page = pdf.addPage([pageWidth, pageHeight]); y = pageHeight - margin; };
  const draw = (text: string, size = 8, isBold = false) => {
    if (y < margin + lineHeight) addPage();
    page.drawText(text.slice(0, maxChars), { x: margin, y, size, font: isBold ? bold : font, color: rgb(0.12, 0.16, 0.22) });
    y -= lineHeight;
  };
  draw(`Relatório ${printable(title)}`, 16, true);
  draw(`Período: ${start.toLocaleDateString("pt-BR")} a ${end.toLocaleDateString("pt-BR")}`, 9);
  draw(`Registros: ${rows.length}`, 9);
  y -= 8;
  for (const [index, row] of rows.entries()) {
    draw(`${index + 1}.`, 8, true);
    for (const [key, value] of Object.entries(row)) {
      const text = `${printable(key)}: ${printable(value)}`;
      for (let offset = 0; offset < text.length; offset += maxChars) draw(text.slice(offset, offset + maxChars), 7);
    }
    y -= 5;
  }
  return new Uint8Array(await pdf.save());
}

function filename(reportId: ReportId, start: Date, end: Date, format: ReportFormat) {
  return `relatorio-${reportId}-${start.toISOString().slice(0, 10)}-a-${end.toISOString().slice(0, 10)}.${format}`;
}

async function supervisedIds(context: TenantContext) {
  if (context.role !== "supervisor") return null;
  return getSupervisedBrokerIds(context.tenantId, context.userId);
}

function scopeFor(context: TenantContext, brokerIds: string[] | null, targetBranchId?: string) {
  if (context.role === "supervisor") return brokerIds?.length ? inArray(schema.leads.corretorId, brokerIds) : eq(schema.leads.id, "__no_supervised_leads__");
  if (context.role === "manager" && context.branchId) return eq(schema.leads.branchId, context.branchId);
  if (context.role === "director" && targetBranchId && targetBranchId !== "all") return eq(schema.leads.branchId, targetBranchId);
  return undefined;
}

export async function generateReport(context: TenantContext, reportId: string, rawInput: unknown): Promise<ReportExport> {
  const definition = getReportDefinition(reportId);
  if (!definition) throw new Error("Tipo de relatório indisponível.");
  if (!hasCapability(context.role, "exportar_relatorios_operacionais", context.jobTitle) || (context.role === "supervisor" && !definition.allowsSupervisor)) {
    throw new Error("Sem permissão para gerar este relatório.");
  }

  const input = inputSchema.parse(rawInput);
  if (context.role === "manager" && input.branchId && context.branchId && input.branchId !== context.branchId) {
    throw new Error("Você só pode gerar relatórios da sua própria unidade.");
  }
  const effectiveBranchId = context.role === "director" ? input.branchId : (context.branchId ?? undefined);

  const days = (input.end.getTime() - input.start.getTime()) / 86_400_000;
  if (input.end < input.start || days > MAX_RANGE_DAYS) throw new Error("Escolha um período de até 366 dias.");

  const db = getDatabase();
  const brokerIds = await supervisedIds(context);
  const leadScope = scopeFor(context, brokerIds, effectiveBranchId);
  const baseLeadWhere = and(eq(schema.leads.tenantId, context.tenantId), leadScope, gte(schema.leads.createdAt, input.start), lte(schema.leads.createdAt, input.end));
  let rows: Record<string, unknown>[];

  switch (definition.id) {
    case "leads":
      rows = await db.select({
        entrada: schema.leads.createdAt, nome: schema.leads.nome, origem: schema.leads.origem, campanha: schema.leads.sourceCampaign,
        status: schema.leads.status, qualificacao: schema.leads.qualificationStatus, score: schema.leads.qualificationScore,
        responsavel: schema.user.name, unidade: schema.branches.name,
      }).from(schema.leads).leftJoin(schema.user, eq(schema.leads.corretorId, schema.user.id)).leftJoin(schema.branches, eq(schema.leads.branchId, schema.branches.id)).where(baseLeadWhere).orderBy(asc(schema.leads.createdAt)).limit(MAX_EXPORT_ROWS);
      break;
    case "qualification":
      rows = await db.select({
        entrada: schema.leads.createdAt, lead: schema.leads.nome, estado: schema.leads.qualificationState,
        resultado: schema.leads.qualificationStatus, score: schema.leads.qualificationScore, concluidaEm: schema.leads.qualificationCompletedAt,
        responsavel: schema.user.name, unidade: schema.branches.name,
      }).from(schema.leads).leftJoin(schema.user, eq(schema.leads.corretorId, schema.user.id)).leftJoin(schema.branches, eq(schema.leads.branchId, schema.branches.id)).where(baseLeadWhere).orderBy(asc(schema.leads.createdAt)).limit(MAX_EXPORT_ROWS);
      break;
    case "sales":
      if (context.role === "supervisor") {
        rows = await db.select({
          fechamento: schema.sales.saleDate, lead: schema.leads.nome, responsavel: schema.user.name, status: schema.sales.status,
          produto: schema.carrierPlans.name,
        }).from(schema.sales).innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id)).leftJoin(schema.user, eq(schema.sales.brokerId, schema.user.id)).leftJoin(schema.carrierPlans, eq(schema.sales.carrierPlanId, schema.carrierPlans.id)).where(and(eq(schema.sales.tenantId, context.tenantId), leadScope, gte(schema.sales.saleDate, input.start), lte(schema.sales.saleDate, input.end))).orderBy(asc(schema.sales.saleDate)).limit(MAX_EXPORT_ROWS);
      } else {
        rows = await db.select({
          fechamento: schema.sales.saleDate, lead: schema.leads.nome, responsavel: schema.user.name, status: schema.sales.status,
          valor: schema.sales.saleValue, produto: schema.carrierPlans.name,
        }).from(schema.sales).innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id)).leftJoin(schema.user, eq(schema.sales.brokerId, schema.user.id)).leftJoin(schema.carrierPlans, eq(schema.sales.carrierPlanId, schema.carrierPlans.id)).where(and(eq(schema.sales.tenantId, context.tenantId), leadScope, gte(schema.sales.saleDate, input.start), lte(schema.sales.saleDate, input.end))).orderBy(asc(schema.sales.saleDate)).limit(MAX_EXPORT_ROWS);
      }
      break;
    case "broker-performance":
      rows = await db.select({
        corretor: schema.user.name, entrada: schema.leads.createdAt, status: schema.leads.status, qualificacao: schema.leads.qualificationStatus,
        score: schema.leads.qualificationScore, primeiroContatoEm: schema.leads.firstContactAt,
      }).from(schema.leads).leftJoin(schema.user, eq(schema.leads.corretorId, schema.user.id)).where(baseLeadWhere).orderBy(asc(schema.leads.createdAt)).limit(MAX_EXPORT_ROWS);
      break;
    case "distribution":
      rows = await db.select({
        data: schema.leadDistributionEvents.createdAt, lead: schema.leads.nome, acao: schema.leadDistributionEvents.action,
        origem: schema.leadDistributionEvents.source, estrategia: schema.leadDistributionEvents.strategy,
        motivo: schema.leadDistributionEvents.reason, unidade: schema.branches.name,
        responsavel: schema.user.name, primeiroContatoEm: schema.leads.firstContactAt,
      }).from(schema.leadDistributionEvents).innerJoin(schema.leads, eq(schema.leadDistributionEvents.leadId, schema.leads.id)).leftJoin(schema.user, eq(schema.leads.corretorId, schema.user.id)).leftJoin(schema.branches, eq(schema.leadDistributionEvents.toBranchId, schema.branches.id)).where(and(eq(schema.leadDistributionEvents.tenantId, context.tenantId), leadScope, gte(schema.leadDistributionEvents.createdAt, input.start), lte(schema.leadDistributionEvents.createdAt, input.end))).orderBy(asc(schema.leadDistributionEvents.createdAt)).limit(MAX_EXPORT_ROWS);
      break;
    case "tasks":
      rows = await db.select({
        criadaEm: schema.leadTasks.createdAt, lead: schema.leads.nome, titulo: schema.leadTasks.title, prioridade: schema.leadTasks.priority,
        vencimento: schema.leadTasks.dueAt, concluidaEm: schema.leadTasks.completedAt, responsavel: schema.user.name,
      }).from(schema.leadTasks).innerJoin(schema.leads, eq(schema.leadTasks.leadId, schema.leads.id)).leftJoin(schema.user, eq(schema.leadTasks.assignedTo, schema.user.id)).where(and(eq(schema.leadTasks.tenantId, context.tenantId), leadScope, gte(schema.leadTasks.createdAt, input.start), lte(schema.leadTasks.createdAt, input.end))).orderBy(asc(schema.leadTasks.createdAt)).limit(MAX_EXPORT_ROWS);
      break;
  }

  if (!rows?.length) throw new Error("Nenhum dado foi encontrado para os filtros selecionados.");
  const normalized = toRows(rows);
  await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "report", entidadeId: definition.id, acao: `report.generated:${definition.id}:${normalized.length}:${input.format}` });
  const exportName = filename(definition.id, input.start, input.end, input.format);
  if (input.format === "csv") return { body: encodeCsv(normalized), contentType: "text/csv; charset=utf-8", filename: exportName, rows: normalized.length };
  if (input.format === "pdf") return { body: await encodePdf(definition.title, input.start, input.end, normalized), contentType: "application/pdf", filename: exportName, rows: normalized.length };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(normalized), "Relatório");
  return { body: new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx" })), contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename: exportName, rows: normalized.length };
}
