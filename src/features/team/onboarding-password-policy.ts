import { isPasswordAllowed, PASSWORD_MIN_LENGTH } from "@/shared/auth/password-policy";

/** First access follows the same rule as every other password (was 3 characters). */
export const ONBOARDING_PASSWORD_MIN_LENGTH = PASSWORD_MIN_LENGTH;

export function isOnboardingPasswordLongEnough(password: string) {
  return isPasswordAllowed(password);
}
