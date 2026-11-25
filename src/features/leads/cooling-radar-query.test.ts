import { describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import type { TenantContext } from "@/shared/auth/types";

const database = vi.hoisted(() => {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "from", "leftJoin", "where", "orderBy"]) chain[method] = vi.fn(() => chain);
  chain.limit = vi.fn(async () => []);
  return chain as Record<string, ReturnType<typeof vi.fn>>;
});
vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/db")>()),
  getDatabase: () => database,
}));

import {
  COOLING_LIST_LIMIT,
  buildCoolingLeadsWhere,
  leadLastContactAtSql,
  leadNextOpenTaskDueAtSql,
  listCoolingLeads,
  overdueTaskLeadFilter,
} from "./cooling-radar-query";

const render = (query: Parameters<PgDialect["sqlToQuery"]>[0]) => new PgDialect().sqlToQuery(query);

const base: TenantContext = { userId: "u-1", tenantId: "t-1", role: "director", jobTitle: "director", branchId: null };

describe("consulta do radar Esfriando", () => {
  it("diretor: empresa inteira, só etapas abertas acompanhadas e parados há 1 dia ou mais", () => {
    const query = render(buildCoolingLeadsWhere(base));
    expect(query.params).toContain("t-1");
    expect(query.sql).toContain('"leads"."deleted_at" is null');
    expect(query.sql).toContain('"leads"."archived_at" is null');
    expect(query.sql).toMatch(/"leads"\."status" in \(\$\d+, \$\d+, \$\d+, \$\d+, \$\d+, \$\d+, \$\d+\)/);
    expect(query.params).toEqual(expect.arrayContaining(["distributed", "in_contact", "contacted", "quote_sent", "negotiation", "documentation_pending", "awaiting_reply"]));
    expect(query.params).not.toContain("new");
    expect(query.params).not.toContain("under_analysis");
    expect(query.sql).toContain("interval '1 day'");
    expect(query.sql).not.toContain('"leads"."corretor_id" = ');
  });

  it("corretor: só os leads dele", () => {
    const query = render(buildCoolingLeadsWhere({ ...base, role: "broker", jobTitle: "broker", branchId: "b-1", userId: "broker-9" }));
    expect(query.sql).toContain('"leads"."corretor_id" = ');
    expect(query.params).toContain("broker-9");
  });

  it("gestor: só a unidade dele", () => {
    const query = render(buildCoolingLeadsWhere({ ...base, role: "manager", jobTitle: "manager", branchId: "b-7" }));
    expect(query.sql).toContain('"leads"."branch_id" in');
    expect(query.params).toContain("b-7");
  });

  it("supervisor com escopo de equipe: só os corretores da equipe", () => {
    const query = render(buildCoolingLeadsWhere({ ...base, role: "supervisor", jobTitle: "supervisor", branchId: "b-7", userId: "sup-1", supervisorTeamScope: true }));
    expect(query.sql.toLowerCase()).toContain("supervisor");
    expect(query.params).toContain("sup-1");
  });

  it("aplica os filtros da tela por cima do escopo", () => {
    const query = render(buildCoolingLeadsWhere(base, { extra: sql`marcador_do_filtro = 1` }));
    expect(query.sql).toContain("marcador_do_filtro = 1");
  });

  it("lista com teto e do mais parado para o menos", async () => {
    await listCoolingLeads(base);
    expect(database.limit).toHaveBeenCalledWith(COOLING_LIST_LIMIT);
    const order = render(database.orderBy.mock.calls[0]![0]);
    expect(order.sql).toContain("greatest(");
    expect(order.sql).toContain("asc");
  });
});

describe("colunas e filtro de tarefa", () => {
  it("último contato vem da última mensagem ou do 1º contato", () => {
    const query = render(leadLastContactAtSql);
    expect(query.sql).toContain('"leads"."first_contact_at"');
    expect(query.sql).toContain('max("whatsapp_messages"."sent_at")');
    expect(query.sql).toContain('"whatsapp_messages"."tenant_id" = "leads"."tenant_id"');
  });

  it("retorno marcado: tarefa aberta com prazo no futuro", () => {
    const query = render(leadNextOpenTaskDueAtSql);
    expect(query.sql).toContain('"lead_tasks"."completed_at" is null');
    expect(query.sql).toContain('"lead_tasks"."due_at" > now()');
  });

  it("'Com tarefa atrasada': tarefa aberta com prazo vencido", () => {
    const query = render(overdueTaskLeadFilter());
    expect(query.sql).toContain("exists (select 1 from");
    expect(query.sql).toContain('"lead_tasks"."completed_at" is null');
    expect(query.sql).toContain('"lead_tasks"."due_at" < now()');
    expect(query.sql).toContain('"lead_tasks"."tenant_id" = "leads"."tenant_id"');
  });
});
