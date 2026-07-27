import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { hashPassword } from "better-auth/crypto";
import { and, eq, ne } from "drizzle-orm";
import { getDatabase, schema } from "../src/shared/db/client";

loadEnvConfig(process.cwd());

type BootstrapInput = {
  tenantName: string;
  tenantSlug: string;
  branchName: string;
  directorName: string;
  directorEmail: string;
  directorPassword: string;
};

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required to bootstrap the first tenant.`);
  return value;
}

function readInput(): BootstrapInput {
  const input = {
    tenantName: requireEnvironment("BOOTSTRAP_TENANT_NAME"),
    tenantSlug: requireEnvironment("BOOTSTRAP_TENANT_SLUG"),
    branchName: requireEnvironment("BOOTSTRAP_BRANCH_NAME"),
    directorName: requireEnvironment("BOOTSTRAP_DIRECTOR_NAME"),
    directorEmail: requireEnvironment("BOOTSTRAP_DIRECTOR_EMAIL").toLowerCase(),
    directorPassword: requireEnvironment("BOOTSTRAP_DIRECTOR_PASSWORD"),
  };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.tenantSlug)) throw new Error("BOOTSTRAP_TENANT_SLUG must use lowercase letters, numbers, and hyphens.");
  if (!/^\S+@\S+\.\S+$/.test(input.directorEmail)) throw new Error("BOOTSTRAP_DIRECTOR_EMAIL must be a valid email address.");
  if (input.directorPassword.length < 8) throw new Error("BOOTSTRAP_DIRECTOR_PASSWORD must have at least 8 characters.");
  return input;
}

async function main() {
  const input = readInput();
  const db = getDatabase();
  let [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.slug, input.tenantSlug)).limit(1);
  if (!tenant) {
    const id = randomUUID();
    await db.insert(schema.tenants).values({ id, name: input.tenantName, slug: input.tenantSlug, status: "active" });
    [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, id));
  }
  if (!tenant) throw new Error("Failed to create or load the bootstrap tenant.");

  let [branch] = await db.select().from(schema.branches).where(and(eq(schema.branches.tenantId, tenant.id), eq(schema.branches.name, input.branchName))).limit(1);
  if (!branch) {
    const id = randomUUID();
    await db.insert(schema.branches).values({ id, tenantId: tenant.id, name: input.branchName, status: "active" });
    [branch] = await db.select().from(schema.branches).where(eq(schema.branches.id, id));
  }
  if (!branch) throw new Error("Failed to create or load the bootstrap branch.");

  let [director] = await db.select().from(schema.user).where(eq(schema.user.email, input.directorEmail)).limit(1);
  if (!director) {
    const id = randomUUID();
    await db.insert(schema.user).values({ id, name: input.directorName, email: input.directorEmail, emailVerified: true, active: true });
    [director] = await db.select().from(schema.user).where(eq(schema.user.id, id));
  }
  if (!director) throw new Error("Failed to create or load the bootstrap director.");

  const membershipsInOtherTenants = await db
    .select({ tenantId: schema.tenantMemberships.tenantId })
    .from(schema.tenantMemberships)
    .where(
      and(
        eq(schema.tenantMemberships.userId, director.id),
        ne(schema.tenantMemberships.tenantId, tenant.id),
      ),
    )
    .limit(1);
  if (membershipsInOtherTenants.length > 0) {
    throw new Error("BOOTSTRAP_DIRECTOR_EMAIL is already linked to another tenant.");
  }

  const passwordHash = await hashPassword(input.directorPassword);
  const [credentialAccount] = await db
    .select({ id: schema.account.id })
    .from(schema.account)
    .where(
      and(
        eq(schema.account.userId, director.id),
        eq(schema.account.providerId, "credential"),
      ),
    )
    .limit(1);
  if (credentialAccount) {
    await db
      .update(schema.account)
      .set({ password: passwordHash, updatedAt: new Date() })
      .where(eq(schema.account.id, credentialAccount.id));
  } else {
    await db.insert(schema.account).values({
      id: randomUUID(),
      userId: director.id,
      providerId: "credential",
      accountId: director.id,
      password: passwordHash,
    });
  }

  const [membership] = await db.select().from(schema.tenantMemberships).where(and(eq(schema.tenantMemberships.tenantId, tenant.id), eq(schema.tenantMemberships.userId, director.id))).limit(1);
  if (!membership) {
    await db.insert(schema.tenantMemberships).values({ id: randomUUID(), tenantId: tenant.id, userId: director.id, branchId: branch.id, role: "director", status: "active" });
  } else {
    await db
      .update(schema.tenantMemberships)
      .set({ branchId: branch.id, role: "director", status: "active", updatedAt: new Date() })
      .where(eq(schema.tenantMemberships.id, membership.id));
  }
  console.log(`Bootstrap complete for tenant ${tenant.slug}; director ${director.email}.`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
