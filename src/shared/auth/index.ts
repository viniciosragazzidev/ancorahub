import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { getDatabase, schema } from "@/shared/db";

let authInstance: ReturnType<typeof createAuth> | undefined;

const CANONICAL_PRODUCTION_ORIGIN = "https://crm.ancorasaude.cloud";
const LEGACY_PRODUCTION_ORIGIN = "https://corretop.vercel.app";

export function getTrustedAuthOrigins() {
  return Array.from(new Set([
    CANONICAL_PRODUCTION_ORIGIN,
    LEGACY_PRODUCTION_ORIGIN,
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter((origin): origin is string => Boolean(origin))));
}

function getAuthBaseUrl() {
  if (process.env.NODE_ENV === "production") return CANONICAL_PRODUCTION_ORIGIN;
  return process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function createAuth() {
  return betterAuth({
    baseURL: getAuthBaseUrl(),
    trustedOrigins: getTrustedAuthOrigins(),
    database: drizzleAdapter(getDatabase(), {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        twoFactor: schema.twoFactor,
        passkey: schema.passkey,
      },
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      requireEmailVerification: false,
    },
    plugins: [
      twoFactor({
        issuer: "Âncora Corretora",
        backupCodeOptions: { amount: 10, storeBackupCodes: "encrypted" },
      }),
      // rpID fixado no domínio canônico: passkeys ficam válidas em qualquer
      // subdomínio/host confiado do mesmo registrante (DEC-082). Sem rpID, a
      // credencial seria emitida para o host da requisição (ex.: preview da
      // Vercel) e não funcionaria na origem de produção.
      passkey({
        rpName: "Âncora Corretora",
        rpID: process.env.PASSKEY_RP_ID ?? "ancorasaude.cloud",
      }),
      nextCookies(),
    ],
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
  });
}

/** Creates auth lazily so builds do not require a live database connection. */
export function getAuth() {
  authInstance ??= createAuth();
  return authInstance;
}

export { getRequiredPlatformAdmin } from "./platform-admin";
