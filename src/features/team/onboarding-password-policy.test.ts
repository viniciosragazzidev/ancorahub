import { describe, expect, it } from "vitest";

import { isOnboardingPasswordLongEnough } from "./onboarding-password-policy";

describe("onboarding password policy", () => {
  it("accepts three characters and rejects shorter passwords", () => {
    expect(isOnboardingPasswordLongEnough("abc")).toBe(true);
    expect(isOnboardingPasswordLongEnough("ab")).toBe(false);
  });
});
