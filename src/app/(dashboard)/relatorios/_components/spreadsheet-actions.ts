"use server";

import "server-only";

import { randomUUID, createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import * as XLSX from "xlsx";

import { requireAnyRole } from "@/shared/auth/authorization";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { parseCsv } from "@/shared/utils/csv";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SpreadsheetActionState = { success?: boolean; error?: string };

export type ImportedSpreadsheet = {
  id: string;
  name: string;
  description: string | null;
  columns: { key: string; label: string; type: "string" | "number" | "date" }[];
  rowCount: number;
  publicToken: string | null;
  publicCreatedAt: string | null;
  createdAt: string;
};

export type SpreadsheetData = {
  spreadsheet: ImportedSpreadsheet;
  rows: Record<string, unknown>[];
};

export type DelimiterOption = "," | ";" | "\t" | "|";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inferColumnType(values: unknown[]): "string" | "number" | "date" {
  const nonNull = values.filter((v) => v != null && v !== "");
  if (nonNull.length === 0) return "string";

  // Check if all values are numbers
  const allNumbers = nonNull.every(
    (v) => typeof v === "number" || (!isNaN(Number(v)) && v !== ""),
  );
  if (allNumbers) return "number";

  // Check if all values look like dates
  const datePattern = /^\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/;
  const allDates = nonNull.every(
    (v) => typeof v === "string" && datePattern.test(v),
  );
  if (allDates) return "date";

  return "string";
}

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

// ─── Server Actions ───────────────────────────────────────────────────────────

const importInput = z.object({
  name: z.string().trim().min(1, "Informe um nome para a planilha.").max(200),
  fileBase64: z.string().min(1, "Selecione um arquivo."),
  fileExtension: z.string().optional(),
  delimiter: z.string().optional(),
});

export async function importSpreadsheetAction(
  _prev: SpreadsheetActionState,
  formData: FormData,
): Promise<SpreadsheetActionState & { spreadsheet?: ImportedSpreadsheet }> {
  const parsed = importInput.safeParse({
    name: formData.get("name"),
    fileBase64: formData.get("fileBase64"),
    fileExtension: formData.get("fileExtension"),
    delimiter: formData.get("delimiter"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const context = await getRequiredTenantContext();
    requireAnyRole(context, ["director", "manager"]);

    const buffer = Buffer.from(parsed.data.fileBase64, "base64");
    let jsonData: Record<string, unknown>[];

    // If CSV with custom delimiter, parse manually
    if (
      parsed.data.fileExtension?.toLowerCase() === "csv" &&
      parsed.data.delimiter &&
      parsed.data.delimiter !== ","
    ) {
      const text = buffer.toString("utf-8");
      jsonData = parseCsv(text, parsed.data.delimiter);
    } else {
      // Use SheetJS for XLSX/XLS or standard CSV
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return { error: "O arquivo não contém nenhuma planilha." };
      }
      const sheet = workbook.Sheets[sheetName];
      jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: null,
      });
    }

    if (jsonData.length === 0) {
      return { error: "A planilha está vazia." };
    }

    if (jsonData.length > 50_000) {
      return { error: "A planilha tem mais de 50.000 linhas. Importe um arquivo menor." };
    }

    // Extract columns from first row
    const firstRow = jsonData[0];
    const columnKeys = Object.keys(firstRow);
    if (columnKeys.length === 0) {
      return { error: "A planilha não tem colunas identificáveis." };
    }

    const columns = columnKeys.map((key) => {
      const values = jsonData.map((row) => row[key]);
      return {
        key,
        label: key,
        type: inferColumnType(values),
      };
    });

    // Validate data fits within reasonable limits
    const jsonSize = JSON.stringify(jsonData).length;
    if (jsonSize > 10 * 1024 * 1024) {
      return { error: "Os dados são muito grandes (máx. 10 MB após importação)." };
    }

    const db = getDatabase();
    const id = randomUUID();
    const now = new Date();

    await db.insert(schema.importedSpreadsheets).values({
      id,
      tenantId: context.tenantId,
      createdBy: context.userId,
      name: parsed.data.name,
      description: null,
      columns: columns as any,
      data: jsonData as any,
      rowCount: jsonData.length,
      createdAt: now,
      updatedAt: now,
    });

    revalidatePath("/relatorios");

    return {
      success: true,
      spreadsheet: {
        id,
        name: parsed.data.name,
        description: null,
        columns,
        rowCount: jsonData.length,
        publicToken: null,
        publicCreatedAt: null,
        createdAt: now.toISOString(),
      },
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Erro ao importar planilha.",
    };
  }
}

export async function getSpreadsheetsAction(): Promise<
  { spreadsheets: ImportedSpreadsheet[] }
> {
  const context = await getRequiredTenantContext();
  requireAnyRole(context, ["director", "manager"]);

  const db = getDatabase();
  const rows = await db
    .select({
      id: schema.importedSpreadsheets.id,
      name: schema.importedSpreadsheets.name,
      description: schema.importedSpreadsheets.description,
      columns: schema.importedSpreadsheets.columns,
      rowCount: schema.importedSpreadsheets.rowCount,
      publicToken: schema.importedSpreadsheets.publicToken,
      publicCreatedAt: schema.importedSpreadsheets.publicCreatedAt,
      createdAt: schema.importedSpreadsheets.createdAt,
    })
    .from(schema.importedSpreadsheets)
    .where(eq(schema.importedSpreadsheets.tenantId, context.tenantId))
    .orderBy(schema.importedSpreadsheets.createdAt);

  return {
    spreadsheets: rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      columns: row.columns as ImportedSpreadsheet["columns"],
      rowCount: row.rowCount,
      publicToken: row.publicToken,
      publicCreatedAt: row.publicCreatedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export async function getSpreadsheetDataAction(
  id: string,
): Promise<SpreadsheetActionState & { data?: SpreadsheetData }> {
  try {
    const context = await getRequiredTenantContext();
    requireAnyRole(context, ["director", "manager"]);

    const db = getDatabase();
    const [row] = await db
      .select({
        id: schema.importedSpreadsheets.id,
        name: schema.importedSpreadsheets.name,
        description: schema.importedSpreadsheets.description,
        columns: schema.importedSpreadsheets.columns,
        data: schema.importedSpreadsheets.data,
        rowCount: schema.importedSpreadsheets.rowCount,
        publicToken: schema.importedSpreadsheets.publicToken,
        publicCreatedAt: schema.importedSpreadsheets.publicCreatedAt,
        createdAt: schema.importedSpreadsheets.createdAt,
      })
      .from(schema.importedSpreadsheets)
      .where(
        and(
          eq(schema.importedSpreadsheets.id, id),
          eq(schema.importedSpreadsheets.tenantId, context.tenantId),
        ),
      )
      .limit(1);

    if (!row) return { error: "Planilha não encontrada." };

    return {
      success: true,
      data: {
        spreadsheet: {
          id: row.id,
          name: row.name,
          description: row.description,
          columns: row.columns as ImportedSpreadsheet["columns"],
          rowCount: row.rowCount,
          publicToken: row.publicToken,
          publicCreatedAt: row.publicCreatedAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
        },
        rows: row.data as Record<string, unknown>[],
      },
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Erro ao carregar planilha.",
    };
  }
}

export async function deleteSpreadsheetAction(
  id: string,
): Promise<SpreadsheetActionState> {
  try {
    const context = await getRequiredTenantContext();
    requireAnyRole(context, ["director", "manager"]);

    const db = getDatabase();
    await db
      .delete(schema.importedSpreadsheets)
      .where(
        and(
          eq(schema.importedSpreadsheets.id, id),
          eq(schema.importedSpreadsheets.tenantId, context.tenantId),
        ),
      );

    revalidatePath("/relatorios");
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Erro ao excluir planilha.",
    };
  }
}

export async function renameSpreadsheetAction(
  _prev: SpreadsheetActionState,
  formData: FormData,
): Promise<SpreadsheetActionState> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Informe um nome." };

  try {
    const context = await getRequiredTenantContext();
    requireAnyRole(context, ["director", "manager"]);

    const db = getDatabase();
    await db
      .update(schema.importedSpreadsheets)
      .set({ name, updatedAt: new Date() })
      .where(
        and(
          eq(schema.importedSpreadsheets.id, id),
          eq(schema.importedSpreadsheets.tenantId, context.tenantId),
        ),
      );

    revalidatePath("/relatorios");
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Erro ao renomear planilha.",
    };
  }
}

export async function generatePublicLinkAction(
  _prev: SpreadsheetActionState & { publicToken?: string },
  formData: FormData,
): Promise<SpreadsheetActionState & { publicToken?: string }> {
  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    const context = await getRequiredTenantContext();
    requireAnyRole(context, ["director", "manager"]);

    const publicToken = randomUUID().replace(/-/g, "").slice(0, 16);
    const passwordHash = password ? hashPassword(password) : null;

    const db = getDatabase();
    await db
      .update(schema.importedSpreadsheets)
      .set({
        publicToken,
        publicPasswordHash: passwordHash,
        publicCreatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.importedSpreadsheets.id, id),
          eq(schema.importedSpreadsheets.tenantId, context.tenantId),
        ),
      );

    revalidatePath("/relatorios");
    return { success: true, publicToken };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Erro ao gerar link público.",
    };
  }
}

export async function revokePublicLinkAction(
  id: string,
): Promise<SpreadsheetActionState> {
  try {
    const context = await getRequiredTenantContext();
    requireAnyRole(context, ["director", "manager"]);

    const db = getDatabase();
    await db
      .update(schema.importedSpreadsheets)
      .set({
        publicToken: null,
        publicPasswordHash: null,
        publicCreatedAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.importedSpreadsheets.id, id),
          eq(schema.importedSpreadsheets.tenantId, context.tenantId),
        ),
      );

    revalidatePath("/relatorios");
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Erro ao revogar link público.",
    };
  }
}
