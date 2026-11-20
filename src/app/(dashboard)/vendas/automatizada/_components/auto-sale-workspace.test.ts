import { describe, expect, it } from "vitest";

import { isOpenDeal } from "./auto-sale-workspace";

describe("abas da Venda Automatizada", () => {
  it("em andamento é ativa, pausada ou esperando você; o resto é histórico", () => {
    expect(["active", "paused", "waiting_manager"].every((status) => isOpenDeal({ status } as never))).toBe(true);
    expect(["handed_off", "won", "lost", "cancelled"].some((status) => isOpenDeal({ status } as never))).toBe(false);
  });
});
