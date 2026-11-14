import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const flags = vi.hoisted(() => ({ values: {} as Record<string, string>, wallet: true }));
vi.mock("@/features/system-settings/queries", () => ({ getFeatureFlag: async (flag: { key: string; defaultValue: string }) => flags.values[flag.key] ?? flag.defaultValue }));
vi.mock("@/features/carteira/retorno-servico", () => ({ carteiraFichaLiteLigada: async () => flags.wallet }));

import type { TenantContext } from "@/shared/auth/types";

import { buildBrokerClientWalletWhere, normalizeBrokerClientWalletFilters } from "./broker-client-wallet";
import { isBrokerPriorClientsFlagOn } from "./broker-my-wallet-flag";
import { saleClientsOnly } from "./prior-portfolio-schema";

const broker: TenantContext = { userId: "broker-a", tenantId: "tenant-a", role: "broker", jobTitle: "broker", branchId: "unit-a" };
const now = new Date("2026-11-13T15:00:00.000Z");
const compile = (filters: Parameters<typeof buildBrokerClientWalletWhere>[1], prior: boolean) =>
  new PgDialect().sqlToQuery(buildBrokerClientWalletWhere(broker, filters, now, { priorPortfolio: prior }));

describe("DEC-187: escopo da carteira anterior", () => {
  it("sem a chave, a carteira só tem clientes de venda (como na 4a)", () => {
    const query = compile(normalizeBrokerClientWalletFilters({ view: "attention" }), false);
    expect(query.sql).not.toContain('"clients"."lead_id" is null');
    expect(query.sql).not.toContain("client_prior_contracts");
  });

  it("com a chave, entra cliente sem lead e a atenção usa contrato anterior ativo do próprio corretor em até 30 dias", () => {
    const query = compile(normalizeBrokerClientWalletFilters({ view: "attention" }), true);
    expect(query.sql).toContain('"clients"."lead_id" is null');
    expect(query.sql).toContain('"client_prior_contracts"."tenant_id"');
    expect(query.sql).toContain('"client_prior_contracts"."broker_id"');
    expect(query.sql).toContain('"client_prior_contracts"."renewal_date" >=');
    expect(query.sql).toContain('"client_prior_contracts"."renewal_date" <=');
    expect(query.params).toEqual(expect.arrayContaining(["tenant-a", "broker-a", "active", "2026-11-13", "2026-12-13"]));
    expect(query.params).not.toContain("tenant-b");
  });

  it("clientes de venda são os com lead (filtro das métricas e listas da gestão)", () => {
    expect(new PgDialect().sqlToQuery(saleClientsOnly()).sql).toBe('"clients"."lead_id" is not null');
  });

  it("a chave só vale sobre a Minha carteira", async () => {
    flags.values = { feature_broker_navigation_reorg_enabled: "true", feature_broker_prior_clients_enabled: "true" };
    flags.wallet = true;
    expect(await isBrokerPriorClientsFlagOn()).toBe(true);
    flags.wallet = false;
    expect(await isBrokerPriorClientsFlagOn()).toBe(false);
    flags.wallet = true;
    flags.values = { feature_broker_navigation_reorg_enabled: "false", feature_broker_prior_clients_enabled: "true" };
    expect(await isBrokerPriorClientsFlagOn()).toBe(false);
    flags.values = { feature_broker_navigation_reorg_enabled: "true" };
    expect(await isBrokerPriorClientsFlagOn()).toBe(false);
  });
});
