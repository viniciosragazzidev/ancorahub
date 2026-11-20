import { describe, expect, it } from "vitest";

import { campaignTab } from "./campaigns-lite";

describe("abas das campanhas", () => {
  it("sem captura vence; senão veiculando ou pausada na Meta", () => {
    expect(campaignTab({ status: "ACTIVE", isEligibleForCapture: false } as never)).toBe("noCapture");
    expect(campaignTab({ status: " active ", isEligibleForCapture: true } as never)).toBe("running");
    expect(campaignTab({ status: "PAUSED", isEligibleForCapture: true } as never)).toBe("paused");
  });
});
