const META_DYNAMIC_TOKEN_PREFIX = "{{activation_token}}";
const STALE_META_TOKEN_SUFFIXES = ["{{id}}", "{{activation_token}}"] as const;

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

  // Remove placeholder codificado do modelo meta bugado: {{id}} ou {id} (já decodificado)
  // Também remove a versão codificada caso não tenha passado pelo decode
  if (token.startsWith("{{id}}")) {
    token = token.slice(6);
  } else if (token.startsWith("{id}")) {
    token = token.slice(4);
  }
  if (token.startsWith("%7B%7Bid%7D%7D")) {
    token = token.slice(12);
  }

  token = token.startsWith(META_DYNAMIC_TOKEN_PREFIX)
    ? token.slice(META_DYNAMIC_TOKEN_PREFIX.length)
    : token;

  for (const suffix of STALE_META_TOKEN_SUFFIXES) {
    if (token.endsWith(suffix)) {
      token = token.slice(0, -suffix.length);
    }
  }

  return token;
}
