import { describe, expect, it } from "vitest";

import { FEATURE_FLAGS } from "./catalog";

describe("broker Lite duty calendar controls", () => {
  it("is globally enabled by default and offers a bounded display horizon", () => {
    expect(FEATURE_FLAGS.BROKER_DUTY_CALENDAR).toMatchObject({
      key: "feature_broker_lite_duty_calendar_enabled",
      scope: "global",
      defaultValue: "true",
      allowedValues: ["true", "false"],
    });
    expect(FEATURE_FLAGS.BROKER_DUTY_CALENDAR_HORIZON_MONTHS).toMatchObject({
      key: "feature_broker_lite_duty_calendar_horizon_months",
      scope: "global",
      defaultValue: "3",
      allowedValues: ["1", "3", "6", "12"],
    });
  });
});
