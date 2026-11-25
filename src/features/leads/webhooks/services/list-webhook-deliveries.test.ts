import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ rows: [] as unknown[], calls: { where: [] as unknown[], limit: [] as number[] } }));

vi.mock("@/shared/db", async () => {
  const actual = await vi.importActual<typeof import("@/shared/db/schema")>("@/shared/db/schema");
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "from", "innerJoin", "leftJoin", "orderBy", "groupBy"]) chain[method] = () => chain;
  chain.where = (condition: unknown) => { db.calls.where.push(condition); return chain; };
  chain.limit = (value: number) => { db.calls.limit.push(value); return Promise.resolve(db.rows); };
  chain.then = (resolve: (rows: unknown[]) => unknown) => Promise.resolve(db.rows).then(resolve);
  return { getDatabase: () => chain, schema: actual };
});

import { buildWebhookDeliveryScope, getLastReceivedByCredential, listWebhookDeliveries, WEBHOOK_DELIVERIES_LIMIT } from "./list-webhook-deliveries";

const compile = (condition: SQL) => new PgDialect().sqlToQuery(condition);
const director = { tenantId: "tenant-a", role: "director" as const, branchId: null };
const now = new Date("2026-11-25T15:00:00.000Z");

beforeEach(() => {
  db.rows = [];
  db.calls.where = [];
  db.calls.limit = [];
});

describe("buildWebhookDeliveryScope", () => {
  it("prende o diretor à própria empresa e à fonte pedida", () => {
    const query = compile(buildWebhookDeliveryScope(director, "cred-1"));
    expect(query.sql).toContain('"webhook_deliveries"."tenant_id"');
    expect(query.sql).toContain('"lead_webhook_credentials"."tenant_id"');
    expect(query.params).toEqual(expect.arrayContaining(["tenant-a", "cred-1"]));
    expect(query.params).not.toContain("tenant-b");
    expect(query.sql).not.toContain('"lead_webhook_credentials"."branch_id"');
  });

  it("limita quem tem unidade às fontes daquela unidade", () => {
    const query = compile(buildWebhookDeliveryScope({ tenantId: "tenant-a", role: "manager", branchId: "unit-a" }, "cred-1"));
    expect(query.sql).toContain('"lead_webhook_credentials"."branch_id"');
    expect(query.params).toEqual(expect.arrayContaining(["tenant-a", "cred-1", "unit-a"]));
  });

  it("Só problemas tira as entregas processadas", () => {
    const all = compile(buildWebhookDeliveryScope(director, "cred-1"));
    const problems = compile(buildWebhookDeliveryScope(director, "cred-1", true));
    expect(all.sql).not.toContain('"webhook_deliveries"."status" <>');
    expect(problems.sql).toContain('"webhook_deliveries"."status" <>');
    expect(problems.params).toContain("processed");
  });
});

describe("listWebhookDeliveries", () => {
  it("busca no máximo 50, com o escopo da sessão, e traduz cada linha", async () => {
    db.rows = [
      { id: "d1", status: "processed", errorCode: null, leadId: "lead-1", receivedAt: new Date("2026-11-25T14:58:00.000Z"), leadCreatedAt: new Date("2026-11-25T14:58:00.500Z") },
      { id: "d2", status: "rejected", errorCode: "INVALID_PAYLOAD", leadId: null, receivedAt: new Date("2026-11-25T14:50:00.000Z"), leadCreatedAt: null },
      { id: "d3", status: "processed", errorCode: null, leadId: "lead-old", receivedAt: new Date("2026-11-25T14:40:00.000Z"), leadCreatedAt: new Date("2026-10-01T10:00:00.000Z") },
      { id: "d4", status: "processed", errorCode: null, leadId: "lead-other-tenant", receivedAt: new Date("2026-11-25T14:30:00.000Z"), leadCreatedAt: null },
      { id: "d5", status: "rejected", errorCode: "QUALQUER", leadId: null, receivedAt: new Date("2026-11-25T14:20:00.000Z"), leadCreatedAt: null },
    ];
    const result = await listWebhookDeliveries(director, "cred-1", { now });
    expect(db.calls.limit).toEqual([WEBHOOK_DELIVERIES_LIMIT]);
    expect(WEBHOOK_DELIVERIES_LIMIT).toBe(50);
    expect(compile(db.calls.where[0] as SQL).params).toEqual(expect.arrayContaining(["tenant-a", "cred-1"]));
    expect(result.map((row) => [row.id, row.situation, row.reason, row.leadId])).toEqual([
      ["d1", "entered", null, "lead-1"],
      ["d2", "not_entered", "Dados incompletos ou inválidos, como nome ou telefone", null],
      ["d3", "duplicate", "O contato já era um lead e voltou a chegar", "lead-old"],
      ["d4", "entered", null, null],
      ["d5", "not_entered", "Motivo não informado", null],
    ]);
  });
});

describe("getLastReceivedByCredential", () => {
  it("não consulta sem fontes e mapeia o último recebimento por fonte da empresa", async () => {
    await expect(getLastReceivedByCredential("tenant-a", [])).resolves.toEqual(new Map());
    expect(db.calls.where).toHaveLength(0);
    db.rows = [{ credentialId: "cred-1", lastReceivedAt: new Date("2026-11-25T14:00:00.000Z") }, { credentialId: "cred-2", lastReceivedAt: null }];
    const map = await getLastReceivedByCredential("tenant-a", ["cred-1", "cred-2"]);
    expect(map.get("cred-1")?.toISOString()).toBe("2026-11-25T14:00:00.000Z");
    expect(map.has("cred-2")).toBe(false);
    expect(compile(db.calls.where[0] as SQL).params).toEqual(expect.arrayContaining(["tenant-a", "cred-1", "cred-2"]));
  });
});
