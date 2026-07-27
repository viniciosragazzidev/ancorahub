import "server-only";

import { and, eq } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

export async function resolveWebhookBranch(
  tenantId: string,
  branchExternalId: string | null,
): Promise<string | null> {
  const db = getDatabase();

  if (!branchExternalId) {
    const [defaultBranch] = await db
      .select({ id: schema.branches.id })
      .from(schema.branches)
      .where(
        and(
          eq(schema.branches.tenantId, tenantId),
          eq(schema.branches.status, "active"),
          eq(schema.branches.acceptingLeads, true),
        ),
      )
      .orderBy(schema.branches.createdAt)
      .limit(1);
    return defaultBranch?.id ?? null;
  }

  const [branch] = await db
    .select({ id: schema.branches.id })
    .from(schema.branches)
    .where(
      and(
        eq(schema.branches.tenantId, tenantId),
        eq(schema.branches.externalId, branchExternalId),
        eq(schema.branches.status, "active"),
        eq(schema.branches.acceptingLeads, true),
      ),
    )
    .limit(1);

  if (!branch) {
    throw new WebhookBranchNotFoundError();
  }

  return branch.id;
}

export class WebhookBranchNotFoundError extends Error {
  readonly code = "BRANCH_NOT_FOUND";
  constructor() {
    super("A filial informada não está disponível ou não está aceitando leads no momento.");
    this.name = "WebhookBranchNotFoundError";
  }
}
