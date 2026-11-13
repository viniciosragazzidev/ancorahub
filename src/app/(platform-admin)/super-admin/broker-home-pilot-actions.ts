"use server";

import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredPlatformAdmin } from "@/shared/auth/platform-admin";
import { getDatabase, schema } from "@/shared/db";
import { invalidateSystemSettingsCache } from "@/features/system-settings/queries";
import { brokerHomePilotSchema } from "@/features/broker-workspace/home-pilot";
import { brokerHomePilotSettingKey } from "@/features/broker-workspace/home-pilot-settings";

export type BrokerHomePilotFormState = { error?: string; saved?: boolean };

export async function saveBrokerHomePilotFormAction(tenantId: string, _previous: BrokerHomePilotFormState, formData: FormData): Promise<BrokerHomePilotFormState> {
  try {
    await updateBrokerHomePilotAction(tenantId, formData);
    return { saved: true };
  } catch (error) {
    const message = error instanceof Error && /^(Escolha pelo menos|Selecione somente)/.test(error.message)
      ? error.message : "Não foi possível salvar o piloto. Confira a seleção e tente novamente.";
    return { error: message };
  }
}

export async function updateBrokerHomePilotAction(tenantId: string, formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const targetTenantId = z.string().uuid().parse(tenantId);
  const toggle = (key: string) =>
    z.enum(["true", "false"]).parse(formData.get(key) ?? "false") === "true";
  const input = brokerHomePilotSchema.parse({
    enabled: toggle("enabled"),
    showLearning: toggle("showLearning"),
    brokerIds: [...new Set(formData.getAll("brokerIds"))],
  });
  if (input.enabled && !input.brokerIds.length)
    throw new Error("Escolha pelo menos um corretor para ativar o piloto.");
  const db = getDatabase();
  await db.transaction(async (tx) => {
    const [tenant] = await tx
      .select({ id: schema.tenants.id })
      .from(schema.tenants)
      .where(eq(schema.tenants.id, targetTenantId))
      .limit(1);
    if (!tenant) throw new Error("Empresa não encontrada.");
    if (input.brokerIds.length) {
      const members = await tx
        .select({ userId: schema.tenantMemberships.userId })
        .from(schema.tenantMemberships)
        .where(
          and(
            eq(schema.tenantMemberships.tenantId, targetTenantId),
            eq(schema.tenantMemberships.role, "broker"),
            eq(schema.tenantMemberships.status, "active"),
            inArray(schema.tenantMemberships.userId, input.brokerIds),
          ),
        );
      if (new Set(members.map((member) => member.userId)).size !== input.brokerIds.length)
        throw new Error("Selecione somente corretores ativos desta empresa.");
    }
    const now = new Date();
    const key = brokerHomePilotSettingKey(targetTenantId);
    const [previous] = await tx
      .select({ value: schema.systemSettings.value })
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.key, key))
      .limit(1);
    await tx
      .insert(schema.systemSettings)
      .values({ key, value: JSON.stringify(input), updatedAt: now })
      .onConflictDoUpdate({
        target: schema.systemSettings.key,
        set: { value: JSON.stringify(input), updatedAt: now },
      });
    await tx
      .insert(schema.platformAuditLogs)
      .values({
        id: randomUUID(),
        actorUserId: admin.userId,
        action: "broker_home.tenant_pilot_updated",
        targetType: "tenant",
        targetId: targetTenantId,
        metadata: { previous: previous?.value ?? null, next: input },
        createdAt: now,
      });
  });
  invalidateSystemSettingsCache();
  revalidatePath(`/super-admin/tenants/${targetTenantId}`);
  revalidatePath("/dashboard", "layout");
}
