import { randomUUID } from "node:crypto";

import { loadEnvConfig } from "@next/env";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";

import { getDatabase, schema } from "../src/shared/db/client";

loadEnvConfig(process.cwd());

const defaultPassword: string = (() => {
  const value = process.env.BOOTSTRAP_DEFAULT_PASSWORD?.trim();
  if (!value || value.length < 8) throw new Error("BOOTSTRAP_DEFAULT_PASSWORD must have at least 8 characters.");
  return value;
})();

const brokerage = {
  name: "Corretora Vértice Saúde",
  slug: "corretora-vertice-saude",
  legalName: "Vértice Saúde Corretora Ltda.",
  cnpj: "41817056000170",
  director: { name: "Vinícios CorreTop", email: "vinicios@corretop.com" },
  branches: [
    { name: "Matriz São Paulo", code: "sp" },
    { name: "Filial Rio de Janeiro", code: "rj" },
    { name: "Filial Belo Horizonte", code: "bh" },
    { name: "Filial Curitiba", code: "ctba" },
    { name: "Filial Porto Alegre", code: "poa" },
  ],
} as const;

async function ensureUser(db: ReturnType<typeof getDatabase>, name: string, email: string, isPlatformAdmin = false) {
  let [user] = await db.select().from(schema.user).where(eq(schema.user.email, email)).limit(1);
  if (!user) {
    const id = randomUUID();
    await db.insert(schema.user).values({ id, name, email, emailVerified: true, active: true, isPlatformAdmin });
    [user] = await db.select().from(schema.user).where(eq(schema.user.id, id));
  } else {
    await db.update(schema.user).set({ name, emailVerified: true, active: true, isPlatformAdmin, updatedAt: new Date() }).where(eq(schema.user.id, user.id));
  }
  if (!user) throw new Error(`Failed to create user ${email}.`);

  const password = await hashPassword(defaultPassword);
  const [account] = await db.select({ id: schema.account.id }).from(schema.account).where(and(eq(schema.account.userId, user.id), eq(schema.account.providerId, "credential"))).limit(1);
  if (account) await db.update(schema.account).set({ password, updatedAt: new Date() }).where(eq(schema.account.id, account.id));
  else await db.insert(schema.account).values({ id: randomUUID(), userId: user.id, providerId: "credential", accountId: user.id, password });
  return user;
}

async function ensureMembership(db: ReturnType<typeof getDatabase>, tenantId: string, userId: string, branchId: string, role: "director" | "manager" | "broker") {
  const [membership] = await db.select({ id: schema.tenantMemberships.id }).from(schema.tenantMemberships).where(and(eq(schema.tenantMemberships.tenantId, tenantId), eq(schema.tenantMemberships.userId, userId))).limit(1);
  if (membership) {
    await db.update(schema.tenantMemberships).set({ branchId, role, status: "active", updatedAt: new Date() }).where(eq(schema.tenantMemberships.id, membership.id));
  } else {
    await db.insert(schema.tenantMemberships).values({ id: randomUUID(), tenantId, userId, branchId, role, status: "active" });
  }
}

async function main() {
  const db = getDatabase();
  let [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.slug, brokerage.slug)).limit(1);
  if (!tenant) {
    const id = randomUUID();
    await db.insert(schema.tenants).values({ id, name: brokerage.name, slug: brokerage.slug, legalName: brokerage.legalName, cnpj: brokerage.cnpj, status: "active" });
    [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, id));
  }
  if (!tenant) throw new Error("Failed to create or load the brokerage.");

  const director = await ensureUser(db, brokerage.director.name, brokerage.director.email, true);
  let createdManagers = 0;
  let createdBrokers = 0;

  for (const branchDefinition of brokerage.branches) {
    let [branch] = await db.select().from(schema.branches).where(and(eq(schema.branches.tenantId, tenant.id), eq(schema.branches.name, branchDefinition.name))).limit(1);
    if (!branch) {
      const id = randomUUID();
      await db.insert(schema.branches).values({ id, tenantId: tenant.id, name: branchDefinition.name, externalId: branchDefinition.code, status: "active" });
      [branch] = await db.select().from(schema.branches).where(eq(schema.branches.id, id));
    }
    if (!branch) throw new Error(`Failed to create or load branch ${branchDefinition.name}.`);

    const manager = await ensureUser(db, `Gestor ${branchDefinition.name}`, `gestor.${branchDefinition.code}@corretop.com`);
    await ensureMembership(db, tenant.id, manager.id, branch.id, "manager");
    createdManagers += 1;

    for (let index = 1; index <= 5; index += 1) {
      const suffix = String(index).padStart(2, "0");
      const broker = await ensureUser(db, `Corretor ${branchDefinition.name} ${suffix}`, `corretor.${branchDefinition.code}${suffix}@corretop.com`);
      await ensureMembership(db, tenant.id, broker.id, branch.id, "broker");
      createdBrokers += 1;
    }

  }

  const [directorBranch] = await db.select({ id: schema.branches.id }).from(schema.branches).where(and(eq(schema.branches.tenantId, tenant.id), eq(schema.branches.name, brokerage.branches[0].name))).limit(1);
  if (!directorBranch) throw new Error("Failed to resolve the director's default branch.");
  await ensureMembership(db, tenant.id, director.id, directorBranch.id, "director");

  console.log(`Bootstrap complete: ${tenant.name}; branches=${brokerage.branches.length}; managers=${createdManagers}; brokers=${createdBrokers}.`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
