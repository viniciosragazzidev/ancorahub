import { describe, expect, it } from "vitest";

import { isRotationSignal } from "./duty-turn-auto-refresh";

describe("isRotationSignal (egress 16/11)", () => {
  it("refreshes the rotation on lead signals and ignores conversation signals", () => {
    expect(isRotationSignal({ kind: "domain.invalidated", domain: "leads" })).toBe(true);
    expect(isRotationSignal({ kind: "domain.invalidated", domain: "conversations" })).toBe(false);
    expect(isRotationSignal({ kind: "notification.created" })).toBe(false);
    expect(isRotationSignal(undefined)).toBe(false);
  });
});
