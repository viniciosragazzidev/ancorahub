import { randomUUID } from "node:crypto";

import { loadEnvConfig } from "@next/env";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";

import { getDatabase, schema } from "../src/shared/db/client";

loadEnvConfig(process.cwd());

const credentials = {
  email: "vinicios@corretop.com",
  password: "21509399",
  name: "Vinícios CorreTop",
  tenantName: "Corretora Vértice Saúde",
  tenantSlug: "corretora-vertice-saude",
  branchName: "Matriz São Paulo",
};

async function main() {
  const db = getDatabase();
  let [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.slug, credentials.tenantSlug)).limit(1);
  if (!tenant) {
    const id = randomUUID();
    await db.insert(schema.tenants).values({ id, name: credentials.tenantName, slug: credentials.tenantSlug, legalName: "Vértice Saúde Corretora Ltda.", cnpj: "41817056000170", subscriptionPlan: "Essencial", status: "active" });
    [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, id));
  }
  if (!tenant) throw new Error("Failed to create the demo tenant.");

  let [branch] = await db.select().from(schema.branches).where(and(eq(schema.branches.tenantId, tenant.id), eq(schema.branches.name, credentials.branchName))).limit(1);
  if (!branch) {
    const id = randomUUID();
    await db.insert(schema.branches).values({ id, tenantId: tenant.id, name: credentials.branchName, status: "active" });
    [branch] = await db.select().from(schema.branches).where(eq(schema.branches.id, id));
  }
  if (!branch) throw new Error("Failed to create the demo branch.");

  let [admin] = await db.select().from(schema.user).where(eq(schema.user.email, credentials.email)).limit(1);
  if (!admin) {
    const id = randomUUID();
    await db.insert(schema.user).values({ id, name: credentials.name, email: credentials.email, emailVerified: true, active: true, isPlatformAdmin: true });
    [admin] = await db.select().from(schema.user).where(eq(schema.user.id, id));
  } else {
    await db.update(schema.user).set({ name: credentials.name, active: true, isPlatformAdmin: true, updatedAt: new Date() }).where(eq(schema.user.id, admin.id));
  }
  if (!admin) throw new Error("Failed to create the platform administrator.");

  const password = await hashPassword(credentials.password);
  const [account] = await db.select().from(schema.account).where(and(eq(schema.account.userId, admin.id), eq(schema.account.providerId, "credential"))).limit(1);
  if (account) await db.update(schema.account).set({ password, updatedAt: new Date() }).where(eq(schema.account.id, account.id));
  else await db.insert(schema.account).values({ id: randomUUID(), userId: admin.id, providerId: "credential", accountId: admin.id, password });

  const [membership] = await db.select().from(schema.tenantMemberships).where(and(eq(schema.tenantMemberships.tenantId, tenant.id), eq(schema.tenantMemberships.userId, admin.id))).limit(1);
  if (membership) await db.update(schema.tenantMemberships).set({ branchId: branch.id, role: "director", status: "active", updatedAt: new Date() }).where(eq(schema.tenantMemberships.id, membership.id));
  else await db.insert(schema.tenantMemberships).values({ id: randomUUID(), tenantId: tenant.id, userId: admin.id, branchId: branch.id, role: "director", status: "active" });
  console.log(`Platform admin ready: ${credentials.email}; tenant ${tenant.slug}.`);
}

void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
