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

describe("manager Lite feature flag", () => {
  it("is globally controlled and disabled by default", () => {
    expect(FEATURE_FLAGS.MANAGER_LITE).toMatchObject({
      key: "feature_manager_lite_enabled",
      scope: "global",
      defaultValue: "false",
      allowedValues: ["true", "false"],
    });
  });
});
