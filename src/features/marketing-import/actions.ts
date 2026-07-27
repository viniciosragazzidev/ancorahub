"use server";

import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { hasCapability } from "@/shared/auth/permissions";
import { AuthorizationError } from "@/shared/auth/errors";
import { getDatabase, schema } from "@/shared/db";
import { importMetaLeads, computeFileHash, checkExistingImport } from "./service";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const uploadSchema = z.object({
  file: z.instanceof(File)
    .refine((f) => f.size > 0, "Selecione um arquivo.")
    .refine((f) => f.size <= MAX_FILE_BYTES, "O arquivo deve ter no máximo 10 MB.")
    .refine((f) => {
      const name = f.name.toLowerCase();
      return name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv");
    }, "Formato aceito: .xlsx, .xls ou .csv"),
  branchId: z.string().uuid().optional().or(z.literal("")),
});

export interface ImportHistoryItem {
  id: string;
  fileName: string;
  status: string;
  totalRows: number;
  importedCount: number;
  duplicateCount: number;
  invalidCount: number;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: Date;
  userName: string | null;
}

export async function uploadMetaLeadsAction(formData: FormData) {
  try {
    const context = await getRequiredTenantContext();
    if (!hasCapability(context.role, "importar_leads_meta", context.jobTitle)) {
      throw new AuthorizationError("Apenas Diretor e Marketing podem importar leads Meta.");
    }

    const input = uploadSchema.parse({
      file: formData.get("file"),
      branchId: formData.get("branchId") ?? "",
    });

    // Central marketing and directors can choose branch; unit marketing uses own branch
    const isCentralMarketing = context.jobTitle === "marketing" && !context.branchId;
    const branchId = context.role === "director" || isCentralMarketing
      ? (input.branchId || null)
      : context.branchId;

    if (!branchId && context.role !== "director" && !isCentralMarketing) {
      throw new Error("Selecione uma unidade para distribuir os leads.");
    }

    // Compute file hash for dedup
    const buffer = await input.file.arrayBuffer();
    const fileHash = computeFileHash(buffer);

    // Check if file was already imported
    const existingImportId = await checkExistingImport(context.tenantId, fileHash);
    if (existingImportId) {
      // Not a hard error - user can proceed if they confirm
      // For now, we'll still allow re-import
    }

    const result = await importMetaLeads(context, buffer, input.file.name, branchId, fileHash);

    return {
      success: true,
      ...result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido ao importar.",
    };
  }
}

export async function getImportHistoryAction(): Promise<ImportHistoryItem[]> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  return db.select({
    id: schema.marketingImports.id,
    fileName: schema.marketingImports.fileName,
    status: schema.marketingImports.status,
    totalRows: schema.marketingImports.totalRows,
    importedCount: schema.marketingImports.importedCount,
    duplicateCount: schema.marketingImports.duplicateCount,
    invalidCount: schema.marketingImports.invalidCount,
    durationMs: schema.marketingImports.durationMs,
    errorMessage: schema.marketingImports.errorMessage,
    createdAt: schema.marketingImports.createdAt,
    userName: schema.user.name,
  })
    .from(schema.marketingImports)
    .leftJoin(schema.user, eq(schema.marketingImports.userId, schema.user.id))
    .where(eq(schema.marketingImports.tenantId, context.tenantId))
    .orderBy(desc(schema.marketingImports.createdAt))
    .limit(50);
}

export async function getLastImportAction(): Promise<ImportHistoryItem | null> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const [last] = await db.select({
    id: schema.marketingImports.id,
    fileName: schema.marketingImports.fileName,
    status: schema.marketingImports.status,
    totalRows: schema.marketingImports.totalRows,
    importedCount: schema.marketingImports.importedCount,
    duplicateCount: schema.marketingImports.duplicateCount,
    invalidCount: schema.marketingImports.invalidCount,
    durationMs: schema.marketingImports.durationMs,
    errorMessage: schema.marketingImports.errorMessage,
    createdAt: schema.marketingImports.createdAt,
    userName: schema.user.name,
  })
    .from(schema.marketingImports)
    .leftJoin(schema.user, eq(schema.marketingImports.userId, schema.user.id))
    .where(eq(schema.marketingImports.tenantId, context.tenantId))
    .orderBy(desc(schema.marketingImports.createdAt))
    .limit(1);

  return last ?? null;
}
