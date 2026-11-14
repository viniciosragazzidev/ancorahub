import { describe, expect, it } from "vitest";

import {
  brokerWalletHref,
  brokerWalletViewHref,
  hasBrokerWalletNarrowing,
  isBrokerWalletLeadView,
  normalizeBrokerWalletFilters,
  serializeBrokerWalletFilters,
} from "./broker-wallet-filters";

describe("Minha carteira: filtros na URL", () => {
  it("abre Em negociação sem visão e leva o antigo renewals para Precisa de atenção", () => {
    expect(normalizeBrokerWalletFilters({}).view).toBe("negotiating");
    expect(normalizeBrokerWalletFilters({ view: "qualquer" }).view).toBe("negotiating");
    expect(normalizeBrokerWalletFilters({ view: "renewals" }).view).toBe("attention");
    expect(normalizeBrokerWalletFilters({ view: "all" }).view).toBe("all");
    expect(normalizeBrokerWalletFilters({ view: "archived" }).view).toBe("archived");
  });

  it("aceita a situação só na visão a que ela pertence", () => {
    expect(normalizeBrokerWalletFilters({ view: "negotiating", stage: "quote_sent" }).stage).toBe("quote_sent");
    expect(normalizeBrokerWalletFilters({ view: "negotiating", stage: "lost" }).stage).toBeUndefined();
    expect(normalizeBrokerWalletFilters({ view: "negotiating", stage: "converted" }).stage).toBeUndefined();
    expect(normalizeBrokerWalletFilters({ view: "archived", stage: "lost" }).stage).toBe("lost");
    expect(normalizeBrokerWalletFilters({ view: "archived", stage: "archived" }).stage).toBe("archived");
    expect(normalizeBrokerWalletFilters({ view: "archived", stage: "in_contact" }).stage).toBeUndefined();
    expect(normalizeBrokerWalletFilters({ view: "all", stage: "in_contact" }).stage).toBeUndefined();
  });

  it("mantém contrato e retorno só nas visões de clientes", () => {
    const clients = normalizeBrokerWalletFilters({ view: "attention", contractStatus: "active", returnStatus: "overdue" });
    expect(clients).toMatchObject({ contractStatus: "active", returnStatus: "overdue" });
    const leads = normalizeBrokerWalletFilters({ view: "negotiating", contractStatus: "active", returnStatus: "overdue" });
    expect(leads.contractStatus).toBeUndefined();
    expect(leads.returnStatus).toBeUndefined();
  });

  it("separa origem de situação e só aceita origens conhecidas", () => {
    const filters = normalizeBrokerWalletFilters({ view: "negotiating", origin: "webhook", stage: "in_contact" });
    expect(filters).toMatchObject({ origin: "webhook", stage: "in_contact" });
    expect(normalizeBrokerWalletFilters({ origin: "tenant-b" }).origin).toBeUndefined();
  });

  it("limita busca e página", () => {
    const filters = normalizeBrokerWalletFilters({ query: `  ${"a".repeat(150)}  `, page: "-3" });
    expect(filters.query).toHaveLength(100);
    expect(filters.page).toBe(1);
    expect(normalizeBrokerWalletFilters({ page: 9_999_999 }).page).toBe(50_000);
    expect(normalizeBrokerWalletFilters({ query: "   " }).query).toBeUndefined();
  });

  it("serializa a URL e, ao trocar de visão, mantém busca e origem e volta à página 1", () => {
    const filters = normalizeBrokerWalletFilters({ view: "negotiating", page: 3, query: "Ana", origin: "manual", stage: "quote_sent" });
    expect(serializeBrokerWalletFilters(filters)).toBe("view=negotiating&page=3&q=Ana&origin=manual&situacao=quote_sent");
    expect(brokerWalletHref(filters, { page: 4 })).toBe("/clientes?view=negotiating&page=4&q=Ana&origin=manual&situacao=quote_sent");
    expect(brokerWalletViewHref(filters, "all")).toBe("/clientes?view=all&page=1&q=Ana&origin=manual");
  });

  it("identifica visões de lead e recortes ativos", () => {
    expect(isBrokerWalletLeadView("negotiating")).toBe(true);
    expect(isBrokerWalletLeadView("archived")).toBe(true);
    expect(isBrokerWalletLeadView("all")).toBe(false);
    expect(isBrokerWalletLeadView("attention")).toBe(false);
    expect(hasBrokerWalletNarrowing(normalizeBrokerWalletFilters({}))).toBe(false);
    expect(hasBrokerWalletNarrowing(normalizeBrokerWalletFilters({ origin: "manual" }))).toBe(true);
  });
});
