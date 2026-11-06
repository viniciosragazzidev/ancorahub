import { randomUUID } from "node:crypto";

import { loadEnvConfig } from "@next/env";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";

import { getDatabase, schema } from "../src/shared/db/client";
import { buildCredentialAccount, buildCredentialAccountPasswordUpdate } from "../src/shared/auth/credential-account";

loadEnvConfig(process.cwd());

/**
 * Creates or updates the platform administrator. Credentials come only from
 * the environment: a password in this file would be in git history forever.
 *
 *   BOOTSTRAP_ADMIN_EMAIL=... BOOTSTRAP_ADMIN_NAME=... BOOTSTRAP_ADMIN_PASSWORD=... npm run bootstrap:platform-admin
 *
 * The admin is not added to any tenant: platform access and tenant roles stay
 * separate, so a tenant director can never reset the admin's password.
 * Turn on 2FA right after the first sign-in (required for /super-admin).
 */
const ADMIN_PASSWORD_MIN_LENGTH = 16;

function requireEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function readInput() {
  const email = requireEnvironment("BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
  const name = requireEnvironment("BOOTSTRAP_ADMIN_NAME");
  const password = requireEnvironment("BOOTSTRAP_ADMIN_PASSWORD");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("BOOTSTRAP_ADMIN_EMAIL must be a valid email address.");
  if (password.length < ADMIN_PASSWORD_MIN_LENGTH) {
    throw new Error(`BOOTSTRAP_ADMIN_PASSWORD must have at least ${ADMIN_PASSWORD_MIN_LENGTH} characters.`);
  }
  if (/^\d+$/.test(password)) throw new Error("BOOTSTRAP_ADMIN_PASSWORD must not be only digits.");
  return { email, name, password };
}

async function main() {
  const input = readInput();
  const db = getDatabase();

  let [admin] = await db.select().from(schema.user).where(eq(schema.user.email, input.email)).limit(1);
  if (!admin) {
    const id = randomUUID();
    await db.insert(schema.user).values({ id, name: input.name, email: input.email, emailVerified: true, active: true, isPlatformAdmin: true });
    [admin] = await db.select().from(schema.user).where(eq(schema.user.id, id));
  } else {
    await db.update(schema.user).set({ name: input.name, active: true, isPlatformAdmin: true, updatedAt: new Date() }).where(eq(schema.user.id, admin.id));
  }
  if (!admin) throw new Error("Failed to create the platform administrator.");

  const password = await hashPassword(input.password);
  const [account] = await db.select().from(schema.account).where(and(eq(schema.account.userId, admin.id), eq(schema.account.providerId, "credential"))).limit(1);
  if (account) await db.update(schema.account).set(buildCredentialAccountPasswordUpdate(admin.id, password)).where(eq(schema.account.id, account.id));
  else await db.insert(schema.account).values(buildCredentialAccount({ id: randomUUID(), userId: admin.id, password }));

  // A new password ends every open session of this account.
  await db.delete(schema.session).where(eq(schema.session.userId, admin.id));

  console.log(`Platform admin ready: ${input.email}. Turn on 2FA at the first sign-in.`);
}

void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
