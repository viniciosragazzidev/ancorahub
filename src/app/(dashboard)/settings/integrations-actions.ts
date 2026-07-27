"use server";

import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/shared/auth/authorization";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { generateWebhookToken } from "@/features/leads/webhooks/utils/lead-webhook.utils";

const sourceSchema = z.enum(["site_pixel", "landing_page"]);
const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  source: sourceSchema,
  branchId: z.string().uuid().optional().or(z.literal("")),
});
const idSchema = z.object({ id: z.string().uuid() });

export type IntegrationRecord = {
  id: string;
  name: string;
  source: string;
  branchId: string | null;
  branchName: string | null;
  status: "active" | "revoked";
  tokenPrefix: string;
  createdAt: Date;
};

export type IntegrationActionState = {
  success?: boolean;
  error?: string;
  token?: string;
  integration?: IntegrationRecord;
};

async function requireDirector() {
  return requireRole(await getRequiredTenantContext(), "director");
}

export async function getIntegrationsData() {
  const context = await requireDirector();
  const db = getDatabase();
  const [integrations, branches] = await Promise.all([
    db.select({
      id: schema.leadWebhookCredentials.id,
      name: schema.leadWebhookCredentials.name,
      source: schema.leadWebhookCredentials.source,
      branchId: schema.leadWebhookCredentials.branchId,
      branchName: schema.branches.name,
      status: schema.leadWebhookCredentials.status,
      tokenPrefix: schema.leadWebhookCredentials.tokenPrefix,
      createdAt: schema.leadWebhookCredentials.createdAt,
    }).from(schema.leadWebhookCredentials)
      .leftJoin(schema.branches, eq(schema.leadWebhookCredentials.branchId, schema.branches.id))
      .where(eq(schema.leadWebhookCredentials.tenantId, context.tenantId)),
    db.select({ id: schema.branches.id, name: schema.branches.name })
      .from(schema.branches)
      .where(and(eq(schema.branches.tenantId, context.tenantId), eq(schema.branches.status, "active"))),
  ]);
  return { integrations, branches };
}

export async function createIntegrationAction(
  _previous: IntegrationActionState,
  formData: FormData,
): Promise<IntegrationActionState> {
  try {
    const context = await requireDirector();
    const input = createSchema.parse(Object.fromEntries(formData));
    const db = getDatabase();
    const branchId = input.branchId || null;
    if (branchId) {
      const [branch] = await db.select({ id: schema.branches.id }).from(schema.branches)
        .where(and(eq(schema.branches.id, branchId), eq(schema.branches.tenantId, context.tenantId), eq(schema.branches.status, "active"))).limit(1);
      if (!branch) return { error: "A filial selecionada não pertence à corretora ativa." };
    }
    const token = generateWebhookToken();
    const id = randomUUID();
    await db.insert(schema.leadWebhookCredentials).values({
      id,
      tenantId: context.tenantId,
      branchId,
      name: input.name,
      source: input.source,
      tokenPrefix: token.tokenPrefix,
      tokenHash: token.tokenHash,
      status: "active",
      createdBy: context.userId,
    });
    revalidatePath("/settings");
    return {
      success: true,
      token: token.rawToken,
      integration: { id, name: input.name, source: input.source, branchId, branchName: null, status: "active", tokenPrefix: token.tokenPrefix, createdAt: new Date() },
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível criar a integração." };
  }
}

export async function toggleIntegrationAction(formData: FormData) {
  try {
    const context = await requireDirector();
    const { id } = idSchema.parse(Object.fromEntries(formData));
    const db = getDatabase();
    const [integration] = await db.select({ id: schema.leadWebhookCredentials.id, status: schema.leadWebhookCredentials.status })
      .from(schema.leadWebhookCredentials).where(and(eq(schema.leadWebhookCredentials.id, id), eq(schema.leadWebhookCredentials.tenantId, context.tenantId))).limit(1);
    if (!integration) return { success: false, error: "Integração não encontrada." };
    await db.update(schema.leadWebhookCredentials).set({ status: integration.status === "active" ? "revoked" : "active", revokedAt: integration.status === "active" ? new Date() : null, updatedAt: new Date() }).where(eq(schema.leadWebhookCredentials.id, id));
    revalidatePath("/settings");
    return { success: true, status: integration.status === "active" ? "revoked" : "active" as const };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Não foi possível atualizar a integração." };
  }
}

export async function revokeIntegrationAction(formData: FormData) {
  try {
    const context = await requireDirector();
    const { id } = idSchema.parse(Object.fromEntries(formData));
    await getDatabase().update(schema.leadWebhookCredentials).set({ status: "revoked", revokedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(schema.leadWebhookCredentials.id, id), eq(schema.leadWebhookCredentials.tenantId, context.tenantId)));
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Não foi possível revogar a integração." };
  }
}
