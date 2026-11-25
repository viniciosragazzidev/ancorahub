import { beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/pg-proxy";

import type { TenantContext } from "@/shared/auth/types";

const mocks = vi.hoisted(() => ({ database: vi.fn(), context: vi.fn() }));
vi.mock("@/shared/db", async () => ({ schema: await vi.importActual("@/shared/db/schema"), getDatabase: mocks.database }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: mocks.context }));
vi.mock("./service", () => ({ importMetaLeads: vi.fn(), computeFileHash: vi.fn(), checkExistingImport: vi.fn() }));

import { getImportResultsAction } from "./actions";
import { loadImportResults } from "./results-query";

const TENANT = "tenant-a";
const OTHER_TENANT = "tenant-b";
const IMPORT_ID = "import-1";
const director: TenantContext = { tenantId: TENANT, branchId: null, userId: "u1", role: "director", jobTitle: "director" };

const queries: { sql: string; params: unknown[] }[] = [];
const imports = [{ id: IMPORT_ID, tenantId: TENANT }];

function paramFor(query: string, params: unknown[], table: string, column: string) {
  const match = query.match(new RegExp(`"${table}"\\."${column}" = \\$(\\d+)`));
  return match ? params[Number(match[1]) - 1] : undefined;
}

function fakeDb() {
  return drizzle(async (query, params) => {
    queries.push({ sql: query, params });
    if (query.includes('from "marketing_imports"')) {
      const id = paramFor(query, params, "marketing_imports", "id");
      const tenant = paramFor(query, params, "marketing_imports", "tenant_id");
      const found = imports.find((item) => item.id === id && item.tenantId === tenant);
      return { rows: found ? [[found.id, "leads-outubro.xlsx", "completed", 4, 2, 1, 1, null, "2026-11-20T12:00:00.000Z"]] : [] };
    }
    if (query.includes('from "marketing_import_results"')) {
      return { rows: [
        [5, "invalid", "Telefone inválido", "Bruno", "55123", null],
        [2, "created", null, "Ana", "5521999990000", "lead-new"],
        [3, "duplicate", null, "Carla", "5521988887777", null],
      ] };
    }
    if (query.includes('from "leads"')) {
      // Lead antigo (sem linha registrada) e o lead novo, que já está no resultado e não pode repetir.
      return { rows: [["lead-old", "Dora", "5521977776666"], ["lead-new", "Ana", "5521999990000"]] };
    }
    return { rows: [] };
  });
}

beforeEach(() => {
  queries.length = 0;
  vi.clearAllMocks();
  mocks.database.mockImplementation(fakeDb);
  mocks.context.mockResolvedValue(director);
});

describe("consulta do resultado da importação", () => {
  it("lê a importação só dentro da empresa e junta as linhas na ordem da planilha", async () => {
    const detail = await loadImportResults(fakeDb() as never, { tenantId: TENANT }, IMPORT_ID);
    expect(detail?.import.fileName).toBe("leads-outubro.xlsx");
    expect(detail?.rows.map((row) => [row.rowIndex, row.status, row.leadId])).toEqual([
      [2, "created", "lead-new"],
      [3, "duplicate", null],
      [5, "invalid", null],
      [null, "created", "lead-old"],
    ]);
    const header = queries.find((query) => query.sql.includes('from "marketing_imports"'))!;
    expect(paramFor(header.sql, header.params, "marketing_imports", "tenant_id")).toBe(TENANT);
    const leads = queries.find((query) => query.sql.includes('from "leads"'))!;
    expect(paramFor(leads.sql, leads.params, "leads", "tenant_id")).toBe(TENANT);
    expect(leads.sql).toContain("->>'import_id'");
  });

  it("importação de outra empresa não aparece e não consulta as linhas", async () => {
    const detail = await loadImportResults(fakeDb() as never, { tenantId: OTHER_TENANT }, IMPORT_ID);
    expect(detail).toBeNull();
    expect(queries.some((query) => query.sql.includes('from "marketing_import_results"'))).toBe(false);
  });
});

describe("getImportResultsAction", () => {
  it("diretor recebe o resultado", async () => {
    const response = await getImportResultsAction(IMPORT_ID);
    expect(response.ok).toBe(true);
    if (response.ok) expect(response.detail.rows).toHaveLength(4);
  });

  it("quem não importa leads Meta não vê nada e o banco nem é consultado", async () => {
    mocks.context.mockResolvedValue({ ...director, role: "broker", jobTitle: "broker" });
    const response = await getImportResultsAction(IMPORT_ID);
    expect(response).toEqual({ ok: false, error: "Apenas Diretor e Marketing podem ver importações de leads Meta." });
    expect(queries).toHaveLength(0);
  });

  it("importação de outra empresa responde como não encontrada", async () => {
    mocks.context.mockResolvedValue({ ...director, tenantId: OTHER_TENANT });
    expect(await getImportResultsAction(IMPORT_ID)).toEqual({ ok: false, error: "Importação não encontrada." });
  });
});
