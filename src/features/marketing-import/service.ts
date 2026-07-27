import "server-only";

import { randomUUID, createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import * as XLSX from "xlsx";

import { getDatabase, schema } from "@/shared/db";
import type { TenantContext } from "@/shared/auth/tenant-context";
import { chooseAvailableBroker } from "@/features/leads/assignment";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const BATCH_SIZE = 200;
const IMPORT_LOCK_KEY = "IMPORT_META";

// Shared columns for both PF and PME
const sharedColumns = [
  "nome", "email", "telefone", "operadora",
  "nome da campanha", "nome do conjunto de anúncio", "nome do anúncio",
  "id", "data",
] as const;

const pfColumns = [...sharedColumns, "tipo de plano"] as const;
const pmeColumns = [...sharedColumns, "tipo de cnpj"] as const;

type ImportType = "pf" | "pme";

interface RawRow {
  nome: string;
  email: string;
  telefone: string;
  operadora: string;
  campanha: string;
  conjunto: string;
  anuncio: string;
  externalId: string;
  data: string;
  tipoPlano?: string;
  tipoCnpj?: string;
}

interface NormalizedRow {
  nome: string;
  email: string | null;
  telefone: string;
  operadora: string;
  campanha: string;
  conjunto: string;
  anuncio: string;
  externalId: string;
  capturedAt: Date | null;
  tipo: string;
}

export interface ImportResult {
  importId: string;
  imported: number;
  duplicates: number;
  invalid: number;
  durationMs: number;
  errors: Array<{ row: number; message: string }>;
}

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function detectImportType(headers: string[]): ImportType {
  const hasTipoPlano = headers.some((h) => normalizeHeader(h) === "tipo de plano");
  const hasTipoCnpj = headers.some((h) => normalizeHeader(h) === "tipo de cnpj");

  if (hasTipoPlano && hasTipoCnpj) {
    throw new Error("A planilha não pode conter 'Tipo de Plano' e 'Tipo de CNPJ' simultaneamente.");
  }
  if (!hasTipoPlano && !hasTipoCnpj) {
    throw new Error("A planilha precisa conter 'Tipo de Plano' (PF) ou 'Tipo de CNPJ' (PME).");
  }
  return hasTipoPlano ? "pf" : "pme";
}

function validateHeaders(headers: string[], type: ImportType): Map<string, number> {
  const required = type === "pf" ? pfColumns : pmeColumns;
  const headerMap = new Map(headers.map((h, i) => [normalizeHeader(h), i]));

  for (const col of required) {
    if (!headerMap.has(col)) {
      throw new Error(`Campo obrigatório ausente: ${col.charAt(0).toUpperCase() + col.slice(1)}`);
    }
  }
  return headerMap;
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[\s()\-+]/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function parseDate(raw: string): Date | null {
  if (!raw || raw.trim() === "") return null;
  // Try parsing as Excel serial date number first
  const num = Number(raw);
  if (!isNaN(num) && num > 40000 && num < 60000) {
    // Excel serial date
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + num * 86400000);
  }
  // Try ISO/date string
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function validateRow(row: RawRow, index: number, type: ImportType): { normalized: NormalizedRow; errors: string[] } {
  const errors: string[] = [];
  const nome = row.nome.trim();
  const telefone = normalizePhone(row.telefone);
  const email = row.email.trim().toLowerCase() || null;
  const operadora = (row.operadora || "").trim();
  const campanha = (row.campanha || "").trim();
  const conjunto = (row.conjunto || "").trim();
  const anuncio = (row.anuncio || "").trim();
  const externalId = (row.externalId || "").trim();

  if (nome.length < 2) errors.push("Nome deve ter ao menos 2 caracteres");
  if (!/^(?:55)?(?:[1-9]{2})9?\d{8}$/.test(telefone)) errors.push("Telefone inválido");
  if (email && !z.string().email().safeParse(email).success) errors.push("E-mail inválido");
  if (!externalId) errors.push("ID externo é obrigatório");

  tipoValidation(row, type, errors);

  return {
    normalized: {
      nome, email, telefone, operadora, campanha, conjunto, anuncio,
      externalId,
      capturedAt: parseDate(row.data),
      tipo: type === "pf" ? (row.tipoPlano || "").trim() : (row.tipoCnpj || "").trim(),
    },
    errors,
  };
}

function tipoValidation(row: RawRow, type: ImportType, errors: string[]) {
  if (type === "pf" && (!row.tipoPlano || row.tipoPlano.trim().length < 2)) {
    errors.push("Tipo de Plano é obrigatório");
  }
  if (type === "pme" && (!row.tipoCnpj || row.tipoCnpj.trim().length < 2)) {
    errors.push("Tipo de CNPJ é obrigatório");
  }
}

async function checkDuplicate(
  db: ReturnType<typeof getDatabase>,
  tenantId: string,
  row: NormalizedRow,
): Promise<"duplicate" | "new"> {
  // Rule 1: Same tenant + externalLeadId
  if (row.externalId) {
    const existing = await db.select({ id: schema.leads.id })
      .from(schema.leads)
      .where(and(
        eq(schema.leads.tenantId, tenantId),
        eq(schema.leads.externalId, row.externalId),
        eq(schema.leads.sourceChannel, "meta_ads"),
      ))
      .limit(1);
    if (existing.length > 0) return "duplicate";
  }

  // Rule 2: Same phone + same campaign
  if (row.campanha) {
    const existing = await db.select({ id: schema.leads.id })
      .from(schema.leads)
      .where(and(
        eq(schema.leads.tenantId, tenantId),
        eq(schema.leads.telefone, row.telefone),
        eq(schema.leads.sourceCampaign, row.campanha),
      ))
      .limit(1);
    if (existing.length > 0) return "duplicate";
  }

  // Rule 3: Same phone + same day
  if (row.capturedAt) {
    const dayStart = new Date(row.capturedAt);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const existing = await db.select({ id: schema.leads.id })
      .from(schema.leads)
      .where(and(
        eq(schema.leads.tenantId, tenantId),
        eq(schema.leads.telefone, row.telefone),
        sql`${schema.leads.capturedAt} >= ${dayStart.toISOString()}::timestamptz`,
        sql`${schema.leads.capturedAt} < ${dayEnd.toISOString()}::timestamptz`,
      ))
      .limit(1);
    if (existing.length > 0) return "duplicate";
  }

  // Rule 4: Same email + same day
  if (row.email && row.capturedAt) {
    const dayStart = new Date(row.capturedAt);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const existing = await db.select({ id: schema.leads.id })
      .from(schema.leads)
      .where(and(
        eq(schema.leads.tenantId, tenantId),
        eq(schema.leads.email, row.email),
        sql`${schema.leads.capturedAt} >= ${dayStart.toISOString()}::timestamptz`,
        sql`${schema.leads.capturedAt} < ${dayEnd.toISOString()}::timestamptz`,
      ))
      .limit(1);
    if (existing.length > 0) return "duplicate";
  }

  return "new";
}

export function computeFileHash(buffer: ArrayBuffer): string {
  const hash = createHash("sha256");
  hash.update(Buffer.from(buffer));
  return hash.digest("hex");
}

export async function checkExistingImport(tenantId: string, fileHash: string): Promise<string | null> {
  const db = getDatabase();
  const [existing] = await db.select({ id: schema.marketingImports.id })
    .from(schema.marketingImports)
    .where(and(
      eq(schema.marketingImports.tenantId, tenantId),
      eq(schema.marketingImports.fileHash, fileHash),
    ))
    .limit(1);
  return existing?.id ?? null;
}

export async function importMetaLeads(
  context: TenantContext,
  buffer: ArrayBuffer,
  fileName: string,
  branchId: string | null,
  fileHash: string,
): Promise<ImportResult> {
  const startTime = Date.now();
  const db = getDatabase();
  // Create import record
  const importId = randomUUID();
  await db.insert(schema.marketingImports).values({
    id: importId,
    tenantId: context.tenantId,
    userId: context.userId,
    branchId,
    fileName,
    fileHash,
    fileSize: buffer.byteLength,
    status: "processing",
  });

  try {
    // Parse workbook
    const workbook = XLSX.read(buffer, { type: "array" });
    if (workbook.SheetNames.length === 0) {
      throw new Error("A planilha não contém nenhuma aba.");
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (rawData.length === 0) {
      throw new Error("A planilha está vazia.");
    }

    // Validate headers and detect type
    const headers = Object.keys(rawData[0]);
    const type = detectImportType(headers);
    const headerMap = validateHeaders(headers, type);

    // Transform headers to normalized lookup
    const normalizedHeaders = new Map<string, string>();
    for (const key of headers) {
      normalizedHeaders.set(normalizeHeader(key), key);
    }

    // Read all rows into normalized format
    const rows: Array<{ raw: RawRow; index: number }> = [];
    for (let i = 0; i < rawData.length; i++) {
      const raw = rawData[i];
      rows.push({
        raw: {
          nome: String(raw[normalizedHeaders.get("nome") ?? ""] ?? ""),
          email: String(raw[normalizedHeaders.get("email") ?? ""] ?? ""),
          telefone: String(raw[normalizedHeaders.get("telefone") ?? ""] ?? ""),
          operadora: String(raw[normalizedHeaders.get("operadora") ?? ""] ?? ""),
          campanha: String(raw[normalizedHeaders.get("nome da campanha") ?? ""] ?? ""),
          conjunto: String(raw[normalizedHeaders.get("nome do conjunto de anúncio") ?? ""] ?? ""),
          anuncio: String(raw[normalizedHeaders.get("nome do anúncio") ?? ""] ?? ""),
          externalId: String(raw[normalizedHeaders.get("id") ?? ""] ?? ""),
          data: String(raw[normalizedHeaders.get("data") ?? ""] ?? ""),
          tipoPlano: type === "pf" ? String(raw[normalizedHeaders.get("tipo de plano") ?? ""] ?? "") : undefined,
          tipoCnpj: type === "pme" ? String(raw[normalizedHeaders.get("tipo de cnpj") ?? ""] ?? "") : undefined,
        },
        index: i + 2, // Excel rows are 1-indexed + header
      });
    }

    let imported = 0;
    let duplicates = 0;
    const invalid: Array<{ row: number; message: string }> = [];
    let insertBuffer: Array<{ normalized: NormalizedRow; leadId: string; brokerId: string | null }> = [];

    async function flushBuffer(b: Array<{ normalized: NormalizedRow; leadId: string; brokerId: string | null }>) {
      if (b.length === 0) return;
      await db.transaction(async (tx) => {
        for (const item of b) {
          const capturedAt = item.normalized.capturedAt ?? null;
          const sourceMetadata = {
            import_id: importId,
            import_type: type,
            operadora: item.normalized.operadora || undefined,
            campanha: item.normalized.campanha || undefined,
            conjunto: item.normalized.conjunto || undefined,
            anuncio: item.normalized.anuncio || undefined,
            external_id: item.normalized.externalId || undefined,
            tipo: item.normalized.tipo || undefined,
          };

          await tx.insert(schema.leads).values({
            id: item.leadId,
            tenantId: context.tenantId,
            branchId,
            corretorId: item.brokerId,
            nome: item.normalized.nome,
            telefone: item.normalized.telefone,
            email: item.normalized.email,
            origem: "webhook",
            sourceChannel: "meta_ads",
            sourceCampaign: item.normalized.campanha || null,
            sourceAd: item.normalized.anuncio || null,
            sourceMetadata,
            externalId: item.normalized.externalId || null,
            capturedAt,
            status: item.brokerId ? "distributed" : "new",
            distributionStatus: item.brokerId ? "assigned" : "queued",
            assignmentSource: item.brokerId ? "automatic" : null,
            assignmentStrategy: item.brokerId ? "capacity" : null,
            distributionUpdatedAt: new Date(),
            assignedAt: item.brokerId ? new Date() : null,
            consentimentoLgpd: true,
          });

          await tx.insert(schema.leadInteractions).values({
            id: randomUUID(),
            leadId: item.leadId,
            userId: context.userId,
            tipo: "system_alert",
            conteudo: `Lead importado do Meta Ads (${type === "pf" ? "PF" : "PME"}). Campanha: ${item.normalized.campanha || "N/A"}`,
            metadata: sourceMetadata,
          });
        }
      });
    }

    // Process each row
    for (const { raw, index } of rows) {
      const { normalized, errors } = validateRow(raw, index, type);
      if (errors.length > 0) {
        invalid.push({ row: index, message: errors.join("; ") });
        await db.insert(schema.marketingImportResults).values({
          id: randomUUID(),
          importId,
          rowIndex: index,
          status: "invalid",
          message: errors.join("; "),
          externalLeadId: normalized.externalId || null,
          nome: normalized.nome,
          telefone: normalized.telefone,
          email: normalized.email,
        });
        continue;
      }

      // Check duplicates
      const dupResult = await checkDuplicate(db, context.tenantId, normalized);
      if (dupResult === "duplicate") {
        duplicates++;
        await db.insert(schema.marketingImportResults).values({
          id: randomUUID(),
          importId,
          rowIndex: index,
          status: "duplicate",
          externalLeadId: normalized.externalId || null,
          nome: normalized.nome,
          telefone: normalized.telefone,
          email: normalized.email,
        });
        continue;
      }

      // New lead - add to buffer
      const leadId = randomUUID();
      const brokerId = branchId ? await chooseAvailableBroker(context.tenantId, branchId) : null;
      insertBuffer.push({ normalized, leadId, brokerId });
      imported++;

      // Flush buffer when full
      if (insertBuffer.length >= BATCH_SIZE) {
        await flushBuffer(insertBuffer);
        insertBuffer = [];
      }
    }

    // Flush remaining
    await flushBuffer(insertBuffer);
    insertBuffer = [];

    // Update import record
    const durationMs = Date.now() - startTime;
    await db.update(schema.marketingImports).set({
      status: "completed",
      totalRows: rows.length,
      importedCount: imported,
      duplicateCount: duplicates,
      invalidCount: invalid.length,
      durationMs,
      updatedAt: new Date(),
    }).where(eq(schema.marketingImports.id, importId));

    // Audit log
    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "marketing_import",
      entidadeId: importId,
      acao: `marketing_import.completed: ${imported} imported, ${duplicates} duplicates, ${invalid.length} invalid`,
    });

    return { importId, imported, duplicates, invalid: invalid.length, durationMs, errors: invalid };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    await db.update(schema.marketingImports).set({
      status: "failed",
      errorMessage: message,
      durationMs: Date.now() - startTime,
      updatedAt: new Date(),
    }).where(eq(schema.marketingImports.id, importId));

    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "marketing_import",
      entidadeId: importId,
      acao: `marketing_import.failed: ${message}`,
    });

    throw error;
  }
}
