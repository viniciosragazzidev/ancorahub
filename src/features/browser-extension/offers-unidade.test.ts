import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantContext } from "@/shared/auth/types";

// Banco falso: cada select() consome a próxima fila de linhas e guarda as condições do where.
const state = vi.hoisted(() => {
  const s = { filas: [] as unknown[][], wheres: [] as unknown[], joins: [] as unknown[] };
  const cadeia = (linhas: unknown[]) => {
    const c: Record<string, unknown> = {};
    for (const metodo of ["from", "leftJoin", "orderBy", "for"]) c[metodo] = () => c;
    c.innerJoin = (_tabela: unknown, condicao: unknown) => { s.joins.push(condicao); return c; };
    c.where = (condicao: unknown) => { s.wheres.push(condicao); return c; };
    c.limit = async () => linhas;
    c.then = (ok: (valor: unknown) => unknown, erro?: (motivo: unknown) => unknown) => Promise.resolve(linhas).then(ok, erro);
    return c;
  };
  return { ...s, cadeia, handle: vi.fn(async () => ({ won: true, reason: "accepted" })) };
});

vi.mock("@/shared/db", async () => ({
  schema: await import("@/shared/db/schema"),
  getDatabase: () => ({ select: () => state.cadeia(state.filas.shift() ?? []) }),
}));
vi.mock("@/features/lead-distribution/offers", () => ({ handleLeadOfferWebhookResponse: state.handle }));
vi.mock("@/features/lead-distribution/active-queue-duty-roster", () => ({ isBrokerRunningInDuty: async () => true }));
vi.mock("@/features/leads/broker-greeting-server", () => ({ loadBrokerGreetingSafe: async () => "Olá" }));

import { listExtensionOffers, respondToExtensionOffer } from "./offers";

const contexto = { userId: "corretor-1", tenantId: "empresa-1", role: "broker", branchId: "unidade-1" } as unknown as TenantContext;
const sessao = { id: "sessao-a", userId: "corretor-1", tenantId: "empresa-1", deviceId: "aparelho-aaaa-1111", extensionVersion: "0.2.0" };
const oferta = { id: "1f2e3d4c-0000-4000-8000-000000000001", leadId: "lead-1", status: "PENDING" };
const dialeto = new PgDialect();

beforeEach(() => {
  // Esvazia no lugar: o banco falso guarda a referência original das listas.
  state.filas.length = 0;
  state.wheres.length = 0;
  state.joins.length = 0;
  state.handle.mockClear();
});

describe("V1: oferta só para o lead da unidade do corretor", () => {
  it("a lista de ofertas filtra pela unidade do corretor", async () => {
    state.filas = [[]];
    await listExtensionOffers(contexto);
    const { sql, params } = dialeto.sqlToQuery(state.wheres[0] as never);
    expect(sql).toContain('"branch_id"');
    expect(params).toContain("unidade-1");
  });

  it("sem unidade no contexto, a lista não devolve nada (condição falsa)", async () => {
    state.filas = [[]];
    await listExtensionOffers({ ...contexto, branchId: null } as unknown as TenantContext);
    const { sql } = dialeto.sqlToQuery(state.wheres[0] as never);
    expect(sql).toMatch(/false/);
  });

  it("oferta de lead de outra unidade não é encontrada: responde 404 e não chama o aceite", async () => {
    state.filas = [[]];
    const resultado = await respondToExtensionOffer(contexto, sessao, oferta.id, "accept");
    expect(resultado.status).toBe(404);
    expect(state.handle).not.toHaveBeenCalled();
    // O filtro da unidade fica no join com leads, que é a primeira consulta da busca da oferta.
    const { params } = dialeto.sqlToQuery(state.joins[0] as never);
    expect(params).toContain("unidade-1");
  });

  it("o vencedor do aceite também exige a unidade do corretor", async () => {
    // Busca da oferta acha; o aceite passa; a checagem do vencedor não acha lead da unidade: 409.
    state.filas = [[oferta], []];
    const resultado = await respondToExtensionOffer(contexto, sessao, oferta.id, "accept");
    expect(resultado.status).toBe(409);
    const { sql, params } = dialeto.sqlToQuery(state.wheres[1] as never);
    expect(sql).toContain('"branch_id"');
    expect(params).toContain("unidade-1");
  });
});
