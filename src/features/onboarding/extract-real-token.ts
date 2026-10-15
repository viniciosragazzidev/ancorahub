const BUGGY_PREFIX = "%7B%7Bid%7D%7D";

export function extractRealToken(token: string): string {
  if (token.startsWith(BUGGY_PREFIX)) {
    return token.slice(BUGGY_PREFIX.length);
  }
  return token;
}
