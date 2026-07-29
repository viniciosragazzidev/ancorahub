const META_DYNAMIC_TOKEN_PREFIX = "{{activation_token}}";

/**
 * Older approved Meta templates may preserve an encoded named URL placeholder
 * and append the real dynamic value after it. Normalize only that documented
 * prefix; the invitation hash lookup remains the source of truth.
 */
export function normalizeInvitationToken(rawToken: string | undefined) {
  if (!rawToken) return undefined;

  let token = rawToken;
  for (let attempt = 0; attempt < 2 && token.includes("%"); attempt += 1) {
    try {
      const decoded = decodeURIComponent(token);
      if (decoded === token) break;
      token = decoded;
    } catch {
      return rawToken;
    }
  }

  return token.startsWith(META_DYNAMIC_TOKEN_PREFIX)
    ? token.slice(META_DYNAMIC_TOKEN_PREFIX.length)
    : token;
}
