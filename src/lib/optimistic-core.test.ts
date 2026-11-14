import { describe, expect, it, vi } from "vitest";

import { runOptimistic } from "./optimistic-core";

describe("runOptimistic", () => {
  it("aplica antes do servidor responder e mantém quando ele confirma", async () => {
    const order: string[] = [];
    let finish: (value: { success: boolean }) => void = () => {};
    const rollback = vi.fn();
    const pending = runOptimistic({
      apply: () => order.push("apply"),
      commit: () => { order.push("commit"); return new Promise<{ success: boolean }>((resolve) => { finish = resolve; }); },
      rollback,
      isSuccess: (res) => res.success,
    });
    expect(order).toEqual(["apply", "commit"]);
    finish({ success: true });
    await expect(pending).resolves.toEqual({ ok: true, value: { success: true } });
    expect(rollback).not.toHaveBeenCalled();
  });

  it("desfaz quando o servidor recusa e devolve a resposta (com o erro da action)", async () => {
    const rollback = vi.fn();
    const outcome = await runOptimistic({ apply: vi.fn(), commit: async () => ({ success: false, error: "Transição inválida" }), rollback, isSuccess: (res) => res.success });
    expect(rollback).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({ ok: false, value: { success: false, error: "Transição inválida" } });
  });

  it("desfaz quando a chamada falha (rede, exceção)", async () => {
    const rollback = vi.fn();
    const outcome = await runOptimistic({ apply: vi.fn(), commit: async () => { throw new Error("offline"); }, rollback, isSuccess: () => true });
    expect(rollback).toHaveBeenCalledTimes(1);
    expect(outcome.ok).toBe(false);
  });
});
