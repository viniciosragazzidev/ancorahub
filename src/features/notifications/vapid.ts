import "server-only";

import webpush from "web-push";

/**
 * VAPID keys read when the server runs, not when the app is built.
 *
 * Next inlines `process.env.NEXT_PUBLIC_*` at build time (server code too), so a
 * key that the host only gives at runtime came out empty and push stayed
 * "temporariamente indisponível". Reading through a computed name skips the
 * inlining; VAPID_PUBLIC_KEY works as well.
 *
 * Nothing here runs when a module loads: a malformed key (quotes, spaces, the
 * private key pasted by mistake) once made `next build` fail while collecting
 * page data. Now it only turns push off and says why in the server log.
 */
const PUBLIC_NAMES = ["VAPID_PUBLIC_KEY", ["NEXT", "PUBLIC", "VAPID", "PUBLIC", "KEY"].join("_")];

/** Hosts often keep the quotes or a stray newline of a pasted value. */
function clean(value: string | undefined) {
  return (value ?? "").trim().replace(/^["']|["']$/g, "").replace(/\s+/g, "");
}

export function getVapidPublicKey(): string {
  for (const name of PUBLIC_NAMES) {
    const value = clean(process.env[name]);
    if (value) return value;
  }
  return "";
}

let configured = "";
let reported = "";

/** Sets the VAPID details once per key pair; false when a key is missing or malformed. */
export function ensureVapidConfigured(): boolean {
  const publicKey = getVapidPublicKey();
  const privateKey = clean(process.env.VAPID_PRIVATE_KEY);
  if (!publicKey || !privateKey) return false;
  if (configured === publicKey) return true;
  try {
    webpush.setVapidDetails("mailto:suporte@corretop.com.br", publicKey, privateKey);
    configured = publicKey;
    return true;
  } catch (error) {
    // Logged once per key: the public key must be 87 characters starting with "B", the private one 43.
    if (reported !== publicKey) {
      reported = publicKey;
      console.error(`[push] VAPID keys rejected (public: ${publicKey.length} chars, private: ${privateKey.length} chars).`, error instanceof Error ? error.message : error);
    }
    return false;
  }
}
