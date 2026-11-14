import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

import type { TenantContext } from "@/shared/auth/types";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";

vi.mock("server-only", () => ({}));

import {
  QUICK_SALE_LIMIT,
  QUICK_SALE_STAGES,
  quickSaleInputSchema,
  quickSaleLeadHref,
  quickSaleOpenDecision,
  quickSaleStageRank,
  type QuickSaleOpenInput,
} from "./quick-sale";
import { buildQuickSaleLeadWhere, quickSaleStageOrder } from "./quick-sale-queries";

const broker: TenantContext = { userId: "broker-a", tenantId: "tenant-a", role: "broker", jobTitle: "broker", branchId: "unit-a" };
const dialect = new PgDialect();

describe("Registrar venda: escopo da consulta", () => {
  it("usa tenant, corretor da sessão e só leads vivos, não arquivados e em negociação", () => {
    const query = dialect.sqlToQuery(buildQuickSaleLeadWhere(broker, ""));
    expect(query.sql).toContain('"leads"."tenant_id"');
    expect(query.sql).toContain('"leads"."corretor_id"');
    expect(query.sql).toContain('"leads"."deleted_at" is null');
    expect(query.sql).toContain('"leads"."archived_at" is null');
    expect(query.params).toContain("tenant-a");
    expect(query.params).toContain("broker-a");
    for (const stage of QUICK_SALE_STAGES) expect(query.params).toContain(stage);
  });

  it("deixa de fora quem ainda não foi aceito e quem já fechou", () => {
    expect(QUICK_SALE_STAGES).not.toContain("new");
    expect(QUICK_SALE_STAGES).not.toContain("distributed");
    expect(QUICK_SALE_STAGES).not.toContain("converted");
    expect(QUICK_SALE_STAGES).not.toContain("lost");
  });

  it("busca nome e, com quatro dígitos, telefone no servidor", () => {
    expect(dialect.sqlToQuery(buildQuickSaleLeadWhere(broker, "Ana")).params).toContain("Ana");
    const phone = dialect.sqlToQuery(buildQuickSaleLeadWhere(broker, "(11) 9876"));
    expect(phone.sql).toContain("regexp_replace");
    expect(phone.params).toContain("119876");
  });

  it("nega para quem não é corretor", () => {
    expect(dialect.sqlToQuery(buildQuickSaleLeadWhere({ ...broker, role: "manager" }, "")).sql).toContain("false");
  });

  it("valida a busca e recusa campos extras", () => {
    expect(quickSaleInputSchema.parse({})).toEqual({ query: "" });
    expect(quickSaleInputSchema.parse({ query: "  Ana  " })).toEqual({ query: "Ana" });
    expect(quickSaleInputSchema.safeParse({ query: "a".repeat(101) }).success).toBe(false);
    expect(quickSaleInputSchema.safeParse({ query: "Ana", tenantId: "tenant-b" }).success).toBe(false);
    expect(QUICK_SALE_LIMIT).toBe(30);
  });
});

describe("Registrar venda: ordenação", () => {
  it("põe os mais adiantados no funil primeiro", () => {
    const shuffled = ["in_contact", "quote_sent", "under_analysis", "awaiting_reply", "negotiation", "documentation_pending"];
    const sorted = [...shuffled].sort((a, b) => quickSaleStageRank(a) - quickSaleStageRank(b));
    expect(sorted).toEqual(["under_analysis", "documentation_pending", "negotiation", "quote_sent", "awaiting_reply", "in_contact"]);
    expect(quickSaleStageRank("lost")).toBe(QUICK_SALE_STAGES.length);
  });

  it("ordena no SQL com posições numéricas na mesma ordem", () => {
    const order = dialect.sqlToQuery(quickSaleStageOrder());
    expect(order.sql).toMatch(/^case "leads"\."status" when \$1 then 0 when \$2 then 1/);
    expect(order.sql).toContain(`else ${QUICK_SALE_STAGES.length} end`);
    expect(order.params).toEqual([...QUICK_SALE_STAGES]);
  });

  it("monta o link da tela do lead com o atalho", () => {
    expect(quickSaleLeadHref("lead 1")).toBe("/leads/lead%201?registrar-venda=1");
  });
});

describe("Registrar venda: o que o atalho abre na tela do lead", () => {
  const base: QuickSaleOpenInput = {
    registrationV2Enabled: true,
    isCurrentBroker: true,
    isDistributed: false,
    leadStatus: "negotiation",
    hasActiveSale: false,
    aiSalePrompt: null,
    hasApprovedDocument: false,
    hasRejectedDocument: false,
  };

  it("registro novo: abre o assistente quando o botão estaria disponível", () => {
    expect(quickSaleOpenDecision(base)).toEqual({ open: "confirm" });
    expect(quickSaleOpenDecision({ ...base, leadStatus: "documentation_pending" })).toEqual({ open: "confirm" });
    expect(quickSaleOpenDecision({ ...base, leadStatus: "converted", aiSalePrompt: "register" })).toEqual({ open: "confirm" });
  });

  it("registro novo: explica quando não pode", () => {
    for (const input of [
      { ...base, isCurrentBroker: false },
      { ...base, isDistributed: true, leadStatus: "distributed" },
      { ...base, leadStatus: "lost" },
      { ...base, leadStatus: "converted" },
      { ...base, hasActiveSale: true },
    ]) {
      const decision = quickSaleOpenDecision(input);
      expect(decision.open).toBeNull();
      expect("reason" in decision && decision.reason.length).toBeGreaterThan(10);
    }
  });

  it("fluxo anterior: segue os mesmos botões da seção Etapa atual", () => {
    const legacy = { ...base, registrationV2Enabled: false };
    expect(quickSaleOpenDecision(legacy)).toEqual({ open: "request-document" });
    expect(quickSaleOpenDecision({ ...legacy, hasApprovedDocument: true })).toEqual({ open: "confirm" });
    expect(quickSaleOpenDecision({ ...legacy, aiSalePrompt: "confirm" })).toEqual({ open: "confirm" });
    expect(quickSaleOpenDecision({ ...legacy, aiSalePrompt: "register" })).toEqual({ open: "request-document" });
    expect(quickSaleOpenDecision({ ...legacy, hasRejectedDocument: true }).open).toBeNull();
    expect(quickSaleOpenDecision({ ...legacy, leadStatus: "documentation_pending" }).open).toBeNull();
    expect(quickSaleOpenDecision({ ...legacy, leadStatus: "converted" }).open).toBeNull();
  });
});

describe("Registrar venda: chave do Super-admin", () => {
  it("é global e vem ligada", () => {
    expect(FEATURE_FLAGS.BROKER_QUICK_SALE).toMatchObject({ key: "feature_broker_quick_sale_enabled", scope: "global", defaultValue: "true" });
  });
});
