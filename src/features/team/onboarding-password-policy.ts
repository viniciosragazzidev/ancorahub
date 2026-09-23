export const ONBOARDING_PASSWORD_MIN_LENGTH = 3;

export function isOnboardingPasswordLongEnough(password: string) {
  return password.length >= ONBOARDING_PASSWORD_MIN_LENGTH;
}
