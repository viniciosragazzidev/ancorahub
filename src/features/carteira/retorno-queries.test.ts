import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ getDatabaseCalls: 0, inTransaction: false, tx: null as null | { execute: (...args: unknown[]) => Promise<unknown> } }));

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", () => ({
  schema: new Proxy({}, { get: () => ({}) }),
  getDatabase: () => {
    state.getDatabaseCalls += 1;
    // Dentro da trava, pedir outra conexão ao pool é o bug que esta suíte impede.
    if (state.inTransaction) throw new Error("getDatabase chamado dentro da transação da trava");
    return {
      transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
        state.inTransaction = true;
        try {
          return await callback(state.tx);
        } finally {
          state.inTransaction = false;
        }
      },
    };
  },
}));

const { withReturnCreateLock } = await import("./retorno-queries");

beforeEach(() => {
  state.getDatabaseCalls = 0;
  state.inTransaction = false;
  state.tx = { execute: vi.fn(async () => ({})) };
});

describe("trava da criação do retorno", () => {
  it("o trabalho recebe o mesmo tx da trava e não pede outra conexão", async () => {
    const received: unknown[] = [];
    await withReturnCreateLock("t1", "lead-1", "corretor-1", async (tx) => {
      received.push(tx);
      return 1;
    });
    expect(received[0]).toBe(state.tx);
    // Uma única chamada a getDatabase: a que abre a transação.
    expect(state.getDatabaseCalls).toBe(1);
  });

  it("toma a trava por (tenant, lead, corretor) dentro da transação", async () => {
    await withReturnCreateLock("t1", "lead-1", "corretor-1", async () => null);
    expect(state.tx?.execute).toHaveBeenCalledTimes(1);
  });
});
