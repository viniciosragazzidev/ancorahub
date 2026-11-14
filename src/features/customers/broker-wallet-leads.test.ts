import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

import type { TenantContext } from "@/shared/auth/types";

import { normalizeBrokerWalletFilters } from "./broker-wallet-filters";
import { buildBrokerWalletLeadWhere, toBrokerWalletLeadFilters } from "./broker-wallet-leads";

const broker: TenantContext = { userId: "broker-a", tenantId: "tenant-a", role: "broker", jobTitle: "broker", branchId: "unit-a" };
const compile = (context: TenantContext, filters: Parameters<typeof buildBrokerWalletLeadWhere>[1]) =>
  new PgDialect().sqlToQuery(buildBrokerWalletLeadWhere(context, filters));

describe("Minha carteira: leads do corretor", () => {
  it("usa sempre o tenant e o corretor da sessão e esconde lead excluído", () => {
    for (const view of ["negotiating", "archived"] as const) {
      const query = compile(broker, { view });
      expect(query.sql).toContain('"leads"."tenant_id"');
      expect(query.sql).toContain('"leads"."corretor_id"');
      expect(query.sql).toContain('"leads"."deleted_at" is null');
      expect(query.params).toContain("tenant-a");
      expect(query.params).toContain("broker-a");
      expect(query.params).not.toContain("tenant-b");
    }
  });

  it("Em negociação: só etapas em atendimento e nada arquivado", () => {
    const query = compile(broker, { view: "negotiating" });
    expect(query.sql).toContain('"leads"."archived_at" is null');
    expect(query.sql).toContain('"leads"."status" in');
    for (const stage of ["new", "distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis", "awaiting_reply"]) {
      expect(query.params).toContain(stage);
    }
    expect(query.params).not.toContain("converted");
    expect(query.params).not.toContain("lost");
  });

  it("Em negociação com situação filtra uma etapa só", () => {
    const query = compile(broker, { view: "negotiating", stage: "quote_sent" });
    expect(query.params).toContain("quote_sent");
    expect(query.params).not.toContain("in_contact");
  });

  it("Arquivados: perdidos ou arquivados, separáveis pela situação", () => {
    const all = compile(broker, { view: "archived" });
    expect(all.sql).toContain('"leads"."archived_at" is not null');
    expect(all.params).toContain("lost");
    const lost = compile(broker, { view: "archived", stage: "lost" });
    expect(lost.sql).not.toContain('"leads"."archived_at" is not null');
    const archived = compile(broker, { view: "archived", stage: "archived" });
    expect(archived.sql).toContain('"leads"."archived_at" is not null');
    expect(archived.params).not.toContain("lost");
  });

  it("busca telefone só com consulta numérica de quatro dígitos e filtra a origem à parte", () => {
    expect(compile(broker, { view: "negotiating", query: "Ana" }).sql).not.toContain("regexp_replace");
    const phone = compile(broker, { view: "negotiating", query: "(11) 9876", origin: "webhook" });
    expect(phone.sql).toContain("regexp_replace");
    expect(phone.params).toContain("119876");
    expect(phone.sql).toContain('"leads"."origem" =');
    expect(phone.params).toContain("webhook");
  });

  it("nega para quem não é corretor", () => {
    const query = compile({ ...broker, role: "manager" }, { view: "negotiating" });
    expect(query.sql).toBe("false");
  });

  it("leva a situação só para a visão de onde ela veio", () => {
    const filters = normalizeBrokerWalletFilters({ view: "negotiating", stage: "quote_sent", query: "Ana", origin: "manual", page: 2 });
    expect(toBrokerWalletLeadFilters(filters, "negotiating")).toEqual({ view: "negotiating", page: 2, query: "Ana", origin: "manual", stage: "quote_sent" });
    expect(toBrokerWalletLeadFilters(filters, "archived")).toEqual({ view: "archived", page: 2, query: "Ana", origin: "manual" });
  });
});
