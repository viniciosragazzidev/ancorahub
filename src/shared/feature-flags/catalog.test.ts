import { describe, expect, it } from "vitest";

import { FEATURE_FLAGS } from "./catalog";

describe("cold lead reactivation feature flag", () => {
  it("is globally controlled and enabled by default", () => {
    expect(FEATURE_FLAGS.COLD_LEAD_REACTIVATION).toMatchObject({
      key: "feature_cold_lead_reactivation_enabled",
      scope: "global",
      defaultValue: "true",
      allowedValues: ["true", "false"],
    });
  });
});
