/**
 * One password rule for every place a password is set: first access, invite,
 * reset, profile change, platform-admin access creation and better-auth's own
 * endpoints. These accounts open lead conversations with health data, so the
 * floor is 10 characters. Existing passwords keep working; the rule applies
 * when a password is created or changed. Client-safe (no server imports).
 */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_POLICY_HINT = `Use pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;

export function passwordPolicyError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `A senha deve ter no mínimo ${PASSWORD_MIN_LENGTH} caracteres.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `A senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`;
  return null;
}

export function isPasswordAllowed(password: string) {
  return passwordPolicyError(password) === null;
}
