import { describe, expect, it } from "vitest";

import { passwordPolicyError } from "@/shared/auth/password-policy";
import { isOnboardingPasswordLongEnough, ONBOARDING_PASSWORD_MIN_LENGTH } from "./onboarding-password-policy";

describe("onboarding password policy", () => {
  it("follows the shared 10-character minimum", () => {
    expect(ONBOARDING_PASSWORD_MIN_LENGTH).toBe(10);
    expect(isOnboardingPasswordLongEnough("abc")).toBe(false);
    expect(isOnboardingPasswordLongEnough("123456789")).toBe(false);
    expect(isOnboardingPasswordLongEnough("1234567890")).toBe(true);
  });

  it("rejects passwords above the maximum", () => {
    expect(passwordPolicyError("a".repeat(129))).toMatch(/no máximo/);
  });
});
