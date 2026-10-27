import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", async () => {
  const schema = await import("@/shared/db/schema");
  return { getDatabase: vi.fn(), schema };
});

import { buildDistributionFailureQuery, buildFirstOfferAtSql, buildWhatsAppQueueQuery } from "./loaders";
import type { LiveScope } from "./types";

const dialect = new PgDialect();
const NOW = new Date("2026-10-27T13:00:00.000Z");
const director: LiveScope = { tenantId: "tenant-a", role: "director", branchId: null, userId: "director-a", key: "director-a", canOpenQualification: true };

describe("consultas da faixa viva", () => {
  it("limita a fila a 7 dias e detecta falhas de hoje mesmo quando a mensagem foi criada antes da meia-noite", () => {
    const query = dialect.sqlToQuery(buildWhatsAppQueueQuery(director, NOW));
    expect(query.sql).toContain("w.tenant_id");
    expect(query.sql).toContain("w.created_at >=");
    expect(query.sql).toContain("w.failed_at >=");
    expect(query.params).toContain("2026-10-20T13:00:00.000Z");
    expect(query.params).toContain("2026-10-26T01:00:00.000Z");
    expect(query.params).toContain("2026-10-27T03:00:00.000Z");
  });

  it("seleciona a primeira oferta com subconsulta limitada, sem agregar todas as mensagens", () => {
    const query = dialect.sqlToQuery(buildFirstOfferAtSql(director, NOW));
    expect(query.sql.toLowerCase()).toContain("order by \"lead_offers\".\"expires_at\" asc");
    expect(query.sql.toLowerCase()).toContain("limit 1");
    expect(query.sql.toLowerCase()).not.toContain("array_agg");
    expect(query.params).toContain("tenant-a");
  });

  it("usa o timestamp real de falha em 24 h e um limite indexado amplo de criação", () => {
    const scope: LiveScope = { ...director, role: "manager", branchId: "branch-a" };
    const query = dialect.sqlToQuery(buildDistributionFailureQuery(scope, NOW));
    expect(query.sql).toContain("j.tenant_id =");
    expect(query.sql).toContain("j.created_at >=");
    expect(query.sql).toContain("j.updated_at >=");
    expect(query.sql).toContain("o.tenant_id =");
    expect(query.sql).toContain("o.created_at >=");
    expect(query.sql).toContain("o.failed_at >=");
    expect(query.sql).toContain("l.branch_id =");
    expect(query.params).toContain("tenant-a");
    expect(query.params).toContain("branch-a");
    expect(query.params).toContain("2026-09-27T13:00:00.000Z");
    expect(query.params).toContain("2026-10-26T13:00:00.000Z");
  });
});
