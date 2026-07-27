import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { getDatabase, schema } from "@/shared/db";

let authInstance: ReturnType<typeof createAuth> | undefined;

function createAuth() {
  return betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    trustedOrigins: [process.env.BETTER_AUTH_URL, process.env.NEXT_PUBLIC_APP_URL].filter(
      (origin): origin is string => Boolean(origin),
    ),
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
        issuer: "CorreTop",
        backupCodeOptions: { amount: 10, storeBackupCodes: "encrypted" },
      }),
      passkey(),
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
