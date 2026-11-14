import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { schema } from "@/shared/db";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";

const root = path.resolve(__dirname, "../../..");
const sqlPath = path.join(root, "drizzle", "0231_broker_prior_clients.sql");

describe("DEC-187: migration 0231 e schema", () => {
  it("o journal tem a 0231 logo depois da 0230, com o .sql correspondente", () => {
    const journal = JSON.parse(readFileSync(path.join(root, "drizzle", "meta", "_journal.json"), "utf8")) as { entries: { idx: number; tag: string }[] };
    const tags = journal.entries.map((entry) => entry.tag);
    expect(tags.at(-1)).toBe("0231_broker_prior_clients");
    expect(tags.at(-2)).toBe("0230_erp_operational");
    expect(journal.entries.at(-1)!.idx).toBe(journal.entries.at(-2)!.idx + 1);
    expect(existsSync(sqlPath)).toBe(true);
  });

  it("é aditiva: lead_id anulável, origem com CHECK e tabela de contratos sem venda, valor ou comissão", () => {
    const sql = readFileSync(sqlPath, "utf8");
    expect(sql).toMatch(/ALTER TABLE clients ALTER COLUMN lead_id DROP NOT NULL/);
    expect(sql).toMatch(/source text NOT NULL DEFAULT 'sale'/);
    expect(sql).toMatch(/source = 'sale' AND lead_id IS NOT NULL\) OR \(source = 'prior_portfolio' AND lead_id IS NULL/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS client_prior_contracts/);
    const table = sql.slice(sql.indexOf("CREATE TABLE IF NOT EXISTS client_prior_contracts"), sql.indexOf(");", sql.indexOf("CREATE TABLE IF NOT EXISTS client_prior_contracts")));
    expect(table).not.toMatch(/sale_id|value|commission|comiss/i);
    // Nada destrutivo fora do bloco de reversão comentado.
    const active = sql.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n");
    expect(active).not.toMatch(/DROP TABLE|DROP COLUMN|DELETE FROM/i);
  });

  it("o schema Drizzle de contratos anteriores não tem venda, valor nem comissão", () => {
    const columns = Object.keys(getTableColumns(schema.clientPriorContracts));
    expect(columns).toEqual(expect.arrayContaining(["tenantId", "clientId", "brokerId", "productType", "carrierName", "coverageStartDate", "renewalDate", "status"]));
    expect(columns.some((column) => /sale|value|commission/i.test(column))).toBe(false);
    // O objeto canônico de clients continua sem as colunas novas (inserts de venda não dependem da 0231).
    expect(Object.keys(getTableColumns(schema.clients))).not.toContain("source");
  });

  it("a chave do Super-admin é global e nasce desligada", () => {
    expect(FEATURE_FLAGS.BROKER_PRIOR_CLIENTS).toMatchObject({ key: "feature_broker_prior_clients_enabled", scope: "global", defaultValue: "false" });
  });
});
