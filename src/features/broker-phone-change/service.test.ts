import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  selects: [] as unknown[][],
  selectWheres: [] as { sql: string; params: unknown[] }[],
  updates: [] as { set: Record<string, unknown>; where: { sql: string; params: unknown[] } }[],
  updateReturn: [{ id: "profile-1" }] as unknown[],
  inserts: [] as { table: unknown; values: unknown }[],
  executes: 0,
  transactions: 0,
}));

vi.mock("@/shared/db", async () => {
  const schema = await import("@/shared/db/schema");
  const dialect = new PgDialect();
  const select = () => {
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.limit = () => chain;
    chain.where = (condition: Parameters<PgDialect["sqlToQuery"]>[0]) => { state.selectWheres.push(dialect.sqlToQuery(condition)); return chain; };
    chain.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve(state.selects.shift() ?? []).then(resolve, reject);
    return chain;
  };
  const db = {
    select,
    execute: async () => { state.executes += 1; },
    update: () => ({
      set: (set: Record<string, unknown>) => ({
        where: (condition: Parameters<PgDialect["sqlToQuery"]>[0]) => {
          state.updates.push({ set, where: dialect.sqlToQuery(condition) });
          return { returning: async () => state.updateReturn };
        },
      }),
    }),
    insert: (table: unknown) => ({ values: async (values: unknown) => { state.inserts.push({ table, values }); } }),
    transaction: async (fn: (tx: unknown) => unknown) => { state.transactions += 1; return fn(db); },
  };
  return { schema, getDatabase: () => db };
});

import { schema } from "@/shared/db";
import { BrokerPhoneChangeError, changeOwnPhone, PHONE_CHANGE_AUDIT_ACTION } from "./service";

const broker = { tenantId: "tenant-1", userId: "broker-1", role: "broker" };
const now = new Date("2026-11-23T15:00:00.000Z");

function arrange(options: { current?: string; owner?: boolean } = {}) {
  state.selects = [
    [{ id: "profile-1", phone: options.current ?? "71988880000" }],
    options.owner ? [{ id: "profile-2" }] : [],
  ];
}

beforeEach(() => {
  state.selects = [];
  state.selectWheres = [];
  state.updates = [];
  state.updateReturn = [{ id: "profile-1" }];
  state.inserts = [];
  state.executes = 0;
  state.transactions = 0;
});

describe("changeOwnPhone", () => {
  it("grava o número no formato 55 + DDD e registra o antigo e o novo", async () => {
    arrange();
    await expect(changeOwnPhone(broker, "(71) 99999-1234", now)).resolves.toEqual({ phone: "5571999991234" });

    expect(state.executes).toBe(1); // trava da empresa antes de conferir duplicado
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0]!.set).toEqual({ phone: "5571999991234", updatedAt: now });
    // Só grava se o número não mudou em outra tela.
    expect(state.updates[0]!.where.params).toEqual(expect.arrayContaining(["profile-1", "tenant-1", "broker-1", "71988880000"]));
    expect(state.inserts).toEqual([{
      table: schema.auditLogs,
      values: expect.objectContaining({
        userId: "broker-1",
        entidade: "broker_profile",
        entidadeId: "profile-1",
        acao: PHONE_CHANGE_AUDIT_ACTION,
        metadata: { tenantId: "tenant-1", fromPhone: "71988880000", toPhone: "5571999991234" },
      }),
    }]);
  });

  it("confere duplicado em todos os formatos, só na mesma empresa e fora do próprio perfil", async () => {
    arrange();
    await changeOwnPhone(broker, "71999991234", now);
    const duplicateCheck = state.selectWheres[1]!;
    expect(duplicateCheck.sql).toContain("regexp_replace");
    expect(duplicateCheck.params).toEqual(expect.arrayContaining(["tenant-1", "profile-1", "5571999991234", "71999991234", "557199991234", "7199991234"]));
  });

  it("recusa número que já é de outra pessoa da empresa, sem gravar nada", async () => {
    arrange({ owner: true });
    await expect(changeOwnPhone(broker, "71999991234", now)).rejects.toThrow("Esse número já está no cadastro de outra pessoa da sua corretora.");
    expect(state.updates).toHaveLength(0);
    expect(state.inserts).toHaveLength(0);
  });

  it("recusa o próprio número, mesmo gravado em formato antigo", async () => {
    arrange({ current: "71999991234" });
    await expect(changeOwnPhone(broker, "+55 (71) 99999-1234", now)).rejects.toThrow("Esse já é o seu número.");
    expect(state.transactions).toBe(0);
  });

  it("recusa número inválido antes de ir ao banco", async () => {
    await expect(changeOwnPhone(broker, "(71) 3333-1234", now)).rejects.toBeInstanceOf(BrokerPhoneChangeError);
    await expect(changeOwnPhone(broker, "(10) 99999-1234", now)).rejects.toThrow("Esse DDD não existe.");
    expect(state.selectWheres).toHaveLength(0);
  });

  it("só o corretor troca por aqui", async () => {
    await expect(changeOwnPhone({ ...broker, role: "manager" }, "71999991234", now)).rejects.toThrow("Só o corretor");
  });

  it("sem perfil de corretor, nada muda", async () => {
    state.selects = [[]];
    await expect(changeOwnPhone(broker, "71999991234", now)).rejects.toThrow("Não encontramos seu perfil de corretor.");
    expect(state.transactions).toBe(0);
  });

  it("se o número mudou em outra tela, não grava auditoria", async () => {
    arrange();
    state.updateReturn = [];
    await expect(changeOwnPhone(broker, "71999991234", now)).rejects.toThrow("Seu telefone mudou em outra tela.");
    expect(state.inserts).toHaveLength(0);
  });
});
