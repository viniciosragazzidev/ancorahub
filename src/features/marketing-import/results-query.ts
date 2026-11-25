import "server-only";

import { and, eq, sql } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/tenant-context";
import { schema, type DatabaseExecutor } from "@/shared/db";
import { sortImportRows, type ImportResultDetail, type ImportResultRow, type ImportRowStatus } from "./results";

const KNOWN_STATUS = new Set<ImportRowStatus>(["created", "duplicate", "invalid"]);

/**
 * Resultado linha a linha de uma importação, sempre dentro da empresa de quem pede (mesmo escopo do histórico).
 * Importação de outra empresa ou inexistente devolve null. Leads criados antes de o importador gravar a linha
 * entram pelo `import_id` guardado no lead, sem número de linha.
 */
export async function loadImportResults(db: DatabaseExecutor, context: Pick<TenantContext, "tenantId">, importId: string): Promise<ImportResultDetail | null> {
  const [header] = await db.select({
    id: schema.marketingImports.id,
    fileName: schema.marketingImports.fileName,
    status: schema.marketingImports.status,
    totalRows: schema.marketingImports.totalRows,
    importedCount: schema.marketingImports.importedCount,
    duplicateCount: schema.marketingImports.duplicateCount,
    invalidCount: schema.marketingImports.invalidCount,
    errorMessage: schema.marketingImports.errorMessage,
    createdAt: schema.marketingImports.createdAt,
  })
    .from(schema.marketingImports)
    .where(and(eq(schema.marketingImports.id, importId), eq(schema.marketingImports.tenantId, context.tenantId)))
    .limit(1);
  if (!header) return null;

  const [stored, createdLeads] = await Promise.all([
    db.select({
      rowIndex: schema.marketingImportResults.rowIndex,
      status: schema.marketingImportResults.status,
      message: schema.marketingImportResults.message,
      nome: schema.marketingImportResults.nome,
      telefone: schema.marketingImportResults.telefone,
      leadId: schema.marketingImportResults.leadId,
    })
      .from(schema.marketingImportResults)
      .where(eq(schema.marketingImportResults.importId, header.id)),
    db.select({ id: schema.leads.id, nome: schema.leads.nome, telefone: schema.leads.telefone })
      .from(schema.leads)
      .where(and(eq(schema.leads.tenantId, context.tenantId), sql`${schema.leads.sourceMetadata}->>'import_id' = ${header.id}`)),
  ]);

  const rows: ImportResultRow[] = stored.map((row) => ({
    rowIndex: row.rowIndex,
    status: KNOWN_STATUS.has(row.status as ImportRowStatus) ? (row.status as ImportRowStatus) : "invalid",
    message: row.message,
    nome: row.nome,
    telefone: row.telefone,
    leadId: row.leadId,
  }));
  const known = new Set(rows.map((row) => row.leadId).filter(Boolean));
  for (const lead of createdLeads) {
    if (known.has(lead.id)) continue;
    rows.push({ rowIndex: null, status: "created", message: null, nome: lead.nome, telefone: lead.telefone ?? "", leadId: lead.id });
  }

  return { import: header, rows: sortImportRows(rows) };
}
