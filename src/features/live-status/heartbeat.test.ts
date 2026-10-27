import { beforeEach, describe, expect, it, vi } from "vitest";

const executed = vi.hoisted(() => ({ calls: [] as unknown[], fail: false }));

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", () => ({
  getDatabase: () => ({
    execute: async (query: unknown) => {
      if (executed.fail) throw new Error("db down");
      executed.calls.push(query);
      return [];
    },
  }),
}));

import { withJobHeartbeat } from "./heartbeat";

beforeEach(() => {
  executed.calls = [];
  executed.fail = false;
});

describe("withJobHeartbeat", () => {
  it("grava uma vez por rodada autorizada e devolve a resposta original", async () => {
    const response = new Response("{}", { status: 200 });
    const route = withJobHeartbeat("distribution", async () => response);
    expect(await route()).toBe(response);
    expect(executed.calls).toHaveLength(1);
  });

  it("pedido sem a chave do cron não é rodada", async () => {
    const route = withJobHeartbeat("distribution", async () => new Response("{}", { status: 401 }));
    await route();
    expect(executed.calls).toHaveLength(0);
  });

  it("rodada com erro também grava, e a exceção continua subindo", async () => {
    const failing = withJobHeartbeat("whatsapp", async () => { throw new Error("boom"); });
    await expect(failing()).rejects.toThrow("boom");
    expect(executed.calls).toHaveLength(1);
  });

  it("falha ao gravar não derruba a rodada", async () => {
    executed.fail = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const route = withJobHeartbeat("sla", async () => new Response("{}", { status: 200 }));
    expect((await route()).status).toBe(200);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
