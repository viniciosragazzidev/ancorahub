import { describe, expect, it } from "vitest";

import { getPushAvailability } from "./push-availability";

describe("getPushAvailability", () => {
  it("reports a browser-denied permission separately from an unsupported browser", () => {
    expect(getPushAvailability({
      hasNotificationApi: true,
      hasPushManager: true,
      hasServiceWorker: true,
      permission: "denied",
      hasVapidPublicKey: true,
    })).toBe("blocked");
  });

  it("reports a missing deployment key separately from browser permission", () => {
    expect(getPushAvailability({
      hasNotificationApi: true,
      hasPushManager: true,
      hasServiceWorker: true,
      permission: "default",
      hasVapidPublicKey: false,
    })).toBe("missing_configuration");
  });

  it("allows subscription only when browser and deployment are ready", () => {
    expect(getPushAvailability({
      hasNotificationApi: true,
      hasPushManager: true,
      hasServiceWorker: true,
      permission: "default",
      hasVapidPublicKey: true,
    })).toBe("ready");
  });
});
