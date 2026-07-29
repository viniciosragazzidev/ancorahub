"use server";

import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { getMetaBusiness, getMetaPhoneNumber, getMetaWaba, getMetaWabaPhoneNumbers, subscribeWabaToApp, validateMetaMarketingResource } from "./meta-cloud-client";
import { getMetaCloudServerConfig } from "./meta-cloud-config";
import { decryptChannelSecret, encryptChannelSecret } from "./secret-crypto";
import { isMetaCloudWhatsAppEnabled } from "./service";
import { META_CLOUD_PROVIDER } from "./types";
import { manualMetaConnectionInputSchema, type ManualMetaConnectionInput } from "./manual-meta-input";

export type ManualMetaActionState = {
  success?: boolean;
  error?: string;
  result?: {
    businessName: string | null;
    displayPhoneNumber: string | null;
    verifiedName: string | null;
    qualityRating: string | null;
    messagingLimit: string | null;
    validatedMarketingResources: string[];
  };
};

function sanitizeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Não foi possível concluir a operação com a Meta.";
  return message.replace(/Bearer\s+[^\s]+/gi, "[redigido]").slice(0, 300);
}

async function requireManualMetaAccess() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") throw new Error("Somente o Diretor pode configurar a integração Meta da empresa.");
  if (!(await isMetaCloudWhatsAppEnabled())) throw new Error("A integração oficial da Meta está desativada pelo Super-admin.");
  return context;
}

function readConnectionInput(formData: FormData) {
  return manualMetaConnectionInputSchema.parse({
    businessId: formData.get("businessId"),
    wabaId: formData.get("wabaId"),
    phoneNumberId: formData.get("phoneNumberId"),
    accessToken: formData.get("accessToken"),
    facebookPageId: formData.get("facebookPageId"),
    adAccountId: formData.get("adAccountId"),
    pixelId: formData.get("pixelId"),
    datasetId: formData.get("datasetId"),
  });
}

async function inspectConnection(input: ManualMetaConnectionInput) {
  const config = getMetaCloudServerConfig();
  const [business, waba, phone, phones] = await Promise.all([
    getMetaBusiness(input.businessId, input.accessToken),
    getMetaWaba(input.wabaId, input.accessToken),
    getMetaPhoneNumber(input.phoneNumberId, input.accessToken),
    getMetaWabaPhoneNumbers(input.wabaId, input.accessToken),
  ]);
  if (business.id !== input.businessId || waba.id !== input.wabaId || phone.id !== input.phoneNumberId) throw new Error("A Meta retornou identificadores diferentes dos informados.");
  if (!phones.data?.some((item) => item.id === input.phoneNumberId)) throw new Error("O número informado não pertence à WABA selecionada.");
  const marketingResources = [
    ["Página", input.facebookPageId],
    ["Conta de anúncios", input.adAccountId],
    ["Pixel", input.pixelId],
    ["Dataset", input.datasetId],
  ] as const;
  const configuredMarketingResources = marketingResources.flatMap(([label, resourceId]) => resourceId ? [{ label, resourceId }] : []);
  const validatedMarketingResources = await Promise.all(configuredMarketingResources
    .map(async ({ label, resourceId }) => {
      await validateMetaMarketingResource(resourceId, input.accessToken);
      return label;
    }));
  return { config, business, waba, phone, validatedMarketingResources };
}

function resultFrom(inspected: Awaited<ReturnType<typeof inspectConnection>>) {
  return {
    businessName: inspected.business.name ?? inspected.waba.name ?? null,
    displayPhoneNumber: inspected.phone.display_phone_number ?? null,
    verifiedName: inspected.phone.verified_name ?? null,
    qualityRating: inspected.phone.quality_rating ?? null,
    messagingLimit: inspected.phone.messaging_limit_tier ?? null,
    validatedMarketingResources: inspected.validatedMarketingResources,
  };
}

export async function validateManualMetaConnectionAction(_previous: ManualMetaActionState, formData: FormData): Promise<ManualMetaActionState> {
  try {
    await requireManualMetaAccess();
    const result = resultFrom(await inspectConnection(readConnectionInput(formData)));
    return { success: true, result };
  } catch (error) {
    return { error: sanitizeError(error) };
  }
}

export async function connectManualMetaConnectionAction(_previous: ManualMetaActionState, formData: FormData): Promise<ManualMetaActionState> {
  try {
    const context = await requireManualMetaAccess();
    const input = readConnectionInput(formData);
    const inspected = await inspectConnection(input);
    const db = getDatabase();

    const [samePhoneRows, currentChannelRows, existingSettingsRows] = await Promise.all([
      db.select({ id: schema.communicationChannels.id, tenantId: schema.communicationChannels.tenantId }).from(schema.communicationChannels)
        .where(and(eq(schema.communicationChannels.provider, META_CLOUD_PROVIDER), eq(schema.communicationChannels.phoneNumberId, input.phoneNumberId))).limit(1),
      db.select({ id: schema.communicationChannels.id }).from(schema.communicationChannels)
        .where(and(eq(schema.communicationChannels.tenantId, context.tenantId), eq(schema.communicationChannels.provider, META_CLOUD_PROVIDER), isNull(schema.communicationChannels.branchId), eq(schema.communicationChannels.isDefault, true))).limit(1),
      db.select({ id: schema.metaIntegrationSettings.id }).from(schema.metaIntegrationSettings).where(eq(schema.metaIntegrationSettings.tenantId, context.tenantId)).limit(1),
    ]);
    const samePhone = samePhoneRows[0];
    const currentChannel = currentChannelRows[0];
    const existingSettings = existingSettingsRows[0];
    if (samePhone && samePhone.tenantId !== context.tenantId) throw new Error("Este número oficial já está vinculado a outra empresa.");
    if (currentChannel && currentChannel.id !== samePhone?.id) throw new Error("Esta empresa já possui um canal Meta. Desconecte-o antes de trocar o número.");

    await subscribeWabaToApp(input.wabaId, input.accessToken);
    const now = new Date();
    const channelId = samePhone?.id ?? randomUUID();
    const channelValues = {
      tenantId: context.tenantId,
      branchId: null,
      ownerUserId: null,
      provider: META_CLOUD_PROVIDER,
      channelType: "shared",
      status: "active",
      businessId: input.businessId,
      wabaId: input.wabaId,
      phoneNumberId: input.phoneNumberId,
      displayPhoneNumber: inspected.phone.display_phone_number ?? null,
      verifiedName: inspected.phone.verified_name ?? null,
      qualityRating: inspected.phone.quality_rating ?? null,
      messagingLimit: inspected.phone.messaging_limit_tier ?? null,
      accessTokenCiphertext: encryptChannelSecret(input.accessToken, inspected.config.tokenEncryptionKey),
      tokenKeyVersion: "v1",
      tokenExpiresAt: null,
      isDefault: true,
      activatedAt: now,
      updatedAt: now,
    };

    await db.transaction(async (tx) => {
      if (samePhone) await tx.update(schema.communicationChannels).set(channelValues).where(eq(schema.communicationChannels.id, channelId));
      else await tx.insert(schema.communicationChannels).values({ id: channelId, ...channelValues, createdBy: context.userId, createdAt: now });

      const settingsValues = {
        communicationChannelId: channelId,
        facebookPageId: input.facebookPageId || null,
        adAccountId: input.adAccountId || null,
        pixelId: input.pixelId || null,
        datasetId: input.datasetId || null,
        lastSyncedAt: now,
        lastError: null,
        updatedAt: now,
      };
      if (existingSettings) await tx.update(schema.metaIntegrationSettings).set(settingsValues).where(eq(schema.metaIntegrationSettings.id, existingSettings.id));
      else await tx.insert(schema.metaIntegrationSettings).values({ id: randomUUID(), tenantId: context.tenantId, createdBy: context.userId, createdAt: now, ...settingsValues });
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "meta_manual_integration", entidadeId: channelId, acao: samePhone ? "meta_manual.reconnected" : "meta_manual.connected" });
    });
    revalidatePath("/settings/meta");
    revalidatePath("/settings/whatsapp");
    revalidatePath("/conversas");
    return { success: true, result: resultFrom(inspected) };
  } catch (error) {
    return { error: sanitizeError(error) };
  }
}

export async function syncManualMetaConnectionAction(): Promise<ManualMetaActionState> {
  try {
    const context = await requireManualMetaAccess();
    const db = getDatabase();
    const [channelRows, settingsRows] = await Promise.all([
      db.select().from(schema.communicationChannels).where(and(eq(schema.communicationChannels.tenantId, context.tenantId), eq(schema.communicationChannels.provider, META_CLOUD_PROVIDER), eq(schema.communicationChannels.isDefault, true))).limit(1),
      db.select().from(schema.metaIntegrationSettings).where(eq(schema.metaIntegrationSettings.tenantId, context.tenantId)).limit(1),
    ]);
    const channel = channelRows[0];
    const settings = settingsRows[0];
    if (!channel?.phoneNumberId || !channel.wabaId || !channel.accessTokenCiphertext || !settings) throw new Error("Conecte uma conta Meta antes de sincronizar.");
    const config = getMetaCloudServerConfig();
    const accessToken = decryptChannelSecret(channel.accessTokenCiphertext, config.tokenEncryptionKey);
    const inspected = await inspectConnection({ businessId: channel.businessId ?? "00000", wabaId: channel.wabaId, phoneNumberId: channel.phoneNumberId, accessToken, facebookPageId: "", adAccountId: "", pixelId: "", datasetId: "" });
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.update(schema.communicationChannels).set({ displayPhoneNumber: inspected.phone.display_phone_number ?? null, verifiedName: inspected.phone.verified_name ?? null, qualityRating: inspected.phone.quality_rating ?? null, messagingLimit: inspected.phone.messaging_limit_tier ?? null, updatedAt: now }).where(eq(schema.communicationChannels.id, channel.id));
      await tx.update(schema.metaIntegrationSettings).set({ lastSyncedAt: now, lastError: null, updatedAt: now }).where(eq(schema.metaIntegrationSettings.id, settings.id));
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "meta_manual_integration", entidadeId: channel.id, acao: "meta_manual.synchronized" });
    });
    revalidatePath("/settings/meta");
    return { success: true, result: resultFrom(inspected) };
  } catch (error) {
    return { error: sanitizeError(error) };
  }
}

export async function disconnectManualMetaConnectionAction(): Promise<ManualMetaActionState> {
  try {
    const context = await requireManualMetaAccess();
    const db = getDatabase();
    const [channel] = await db.select({ id: schema.communicationChannels.id }).from(schema.communicationChannels)
      .where(and(eq(schema.communicationChannels.tenantId, context.tenantId), eq(schema.communicationChannels.provider, META_CLOUD_PROVIDER), eq(schema.communicationChannels.isDefault, true))).limit(1);
    if (!channel) throw new Error("Nenhuma conta Meta conectada.");
    await db.transaction(async (tx) => {
      await tx.update(schema.communicationChannels).set({ status: "inactive", isDefault: false, updatedAt: new Date() }).where(eq(schema.communicationChannels.id, channel.id));
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "meta_manual_integration", entidadeId: channel.id, acao: "meta_manual.disconnected" });
    });
    revalidatePath("/settings/meta");
    revalidatePath("/settings/whatsapp");
    return { success: true };
  } catch (error) {
    return { error: sanitizeError(error) };
  }
}

export async function completeManualMetaTutorialAction() {
  const context = await requireManualMetaAccess();
  const db = getDatabase();
  const now = new Date();
  const [existing] = await db.select({ id: schema.metaIntegrationSettings.id }).from(schema.metaIntegrationSettings).where(eq(schema.metaIntegrationSettings.tenantId, context.tenantId)).limit(1);
  if (existing) await db.update(schema.metaIntegrationSettings).set({ tutorialCompletedAt: now, updatedAt: now }).where(eq(schema.metaIntegrationSettings.id, existing.id));
  else await db.insert(schema.metaIntegrationSettings).values({ id: randomUUID(), tenantId: context.tenantId, tutorialCompletedAt: now, createdBy: context.userId, createdAt: now, updatedAt: now });
  await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "meta_manual_integration", entidadeId: context.tenantId, acao: "meta_manual.tutorial_completed" });
  revalidatePath("/settings/meta");
}
