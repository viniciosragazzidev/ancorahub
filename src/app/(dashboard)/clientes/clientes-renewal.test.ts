import { describe, expect, it } from "vitest";

import { daysUntilRenewal, renewsSoon } from "./clientes-lite";

const today = new Date(2026, 10, 20); // 20/11/2026

describe("renovação na carteira", () => {
  it("conta os dias de calendário até a renovação", () => {
    expect(daysUntilRenewal("2026-11-20", today)).toBe(0);
    expect(daysUntilRenewal("2026-12-01", today)).toBe(11);
    expect(daysUntilRenewal(null, today)).toBeNull();
  });

  it("renova em 30 dias só entre hoje e daqui a 30 dias", () => {
    expect(renewsSoon({ renewalOn: "2026-12-20" }, today)).toBe(true);
    expect(renewsSoon({ renewalOn: "2026-12-21" }, today)).toBe(false);
    expect(renewsSoon({ renewalOn: "2026-11-19" }, today)).toBe(false);
    expect(renewsSoon({ renewalOn: null }, today)).toBe(false);
  });
});
