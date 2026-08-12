/**
 * Identifies speculative App Router requests so infrastructure work does not
 * contend with the navigation the person actually clicked.
 */
export function isNavigationPrefetch(headers: Headers) {
  return headers.has("next-router-prefetch")
    || headers.get("purpose") === "prefetch"
    || headers.get("sec-purpose") === "prefetch";
}
