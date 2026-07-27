"use server";

import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getMetaCloudServerConfig } from "@/features/communication-channels/meta-cloud-config";
import { getMetaPhoneNumber, getMetaWaba, getMetaWabaPhoneNumbers, subscribeWabaToApp } from "@/features/communication-channels/meta-cloud-client";
import { encryptChannelSecret } from "@/features/communication-channels/secret-crypto";
import { META_CLOUD_PROVIDER } from "@/features/communication-channels/types";
import { isMetaCloudWhatsAppEnabled } from "@/features/communication-channels/service";
import { getRequiredPlatformAdmin } from "@/shared/auth/platform-admin";
import { getDatabase, schema } from "@/shared/db";

const inputSchema = z.object({
  tenantId: z.string().uuid(),
  wabaId: z.string().trim().regex(/^\d{5,40}$/, "WABA ID inválido."),
  phoneNumberId: z.string().trim().regex(/^\d{5,40}$/, "Phone Number ID inválido."),
  displayName: z.string().trim().min(2).max(120),
  displayPhoneNumber: z.string().trim().min(8).max(40),
  accessToken: z.string().trim().min(20).max(4096),
});

function readInput(formData: FormData) {
  return inputSchema.parse({
    tenantId: formData.get("tenantId"),
    wabaId: formData.get("wabaId"),
    phoneNumberId: formData.get("phoneNumberId"),
    displayName: formData.get("displayName"),
    displayPhoneNumber: formData.get("displayPhoneNumber"),
    accessToken: formData.get("accessToken"),
  });
}

async function validateWithMeta(input: z.infer<typeof inputSchema>) {
  const config = getMetaCloudServerConfig();
  const [waba, phone, phoneNumbers] = await Promise.all([
    getMetaWaba(input.wabaId, input.accessToken),
    getMetaPhoneNumber(input.phoneNumberId, input.accessToken),
    getMetaWabaPhoneNumbers(input.wabaId, input.accessToken),
  ]);
  if (waba.id !== input.wabaId || phone.id !== input.phoneNumberId) throw new Error("A Meta retornou identificadores diferentes dos informados.");
  if (!phoneNumbers.data?.some((item) => item.id === input.phoneNumberId)) throw new Error("O número informado não pertence à WABA informada.");
  return { config, phone, waba };
}

export async function validateWhatsAppTenantAction(formData: FormData) {
  await getRequiredPlatformAdmin();
  try {
    if (!(await isMetaCloudWhatsAppEnabled())) throw new Error("A integração oficial está desativada pelo Super-admin.");
    const input = readInput(formData);
    const { phone, waba } = await validateWithMeta(input);
    return { success: true as const, displayPhoneNumber: phone.display_phone_number ?? input.displayPhoneNumber, verifiedName: phone.verified_name ?? input.displayName, wabaName: waba.name ?? null };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Não foi possível validar a conexão com a Meta." };
  }
}

export async function connectWhatsAppTenantAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  try {
    if (!(await isMetaCloudWhatsAppEnabled())) throw new Error("A integração oficial está desativada pelo Super-admin.");
    const input = readInput(formData);
    const { config, phone } = await validateWithMeta(input);
    const db = getDatabase();
    const [tenant] = await db.select({ id: schema.tenants.id }).from(schema.tenants).where(eq(schema.tenants.id, input.tenantId)).limit(1);
    if (!tenant) throw new Error("Empresa não encontrada.");
    const [samePhone] = await db.select({ id: schema.communicationChannels.id, tenantId: schema.communicationChannels.tenantId }).from(schema.communicationChannels).where(and(eq(schema.communicationChannels.provider, META_CLOUD_PROVIDER), eq(schema.communicationChannels.phoneNumberId, input.phoneNumberId))).limit(1);
    if (samePhone && samePhone.tenantId !== input.tenantId) throw new Error("Este número oficial já está vinculado a outra empresa.");
    const [current] = await db.select({ id: schema.communicationChannels.id }).from(schema.communicationChannels).where(and(eq(schema.communicationChannels.tenantId, input.tenantId), eq(schema.communicationChannels.provider, META_CLOUD_PROVIDER), isNull(schema.communicationChannels.branchId), eq(schema.communicationChannels.isDefault, true))).limit(1);
    if (current && current.id !== samePhone?.id) throw new Error("Esta empresa já possui um canal oficial. Desconecte-o antes de trocar o número.");
    await subscribeWabaToApp(input.wabaId, input.accessToken);
    const now = new Date();
    const channelId = samePhone?.id ?? randomUUID();
    const values = {
      tenantId: input.tenantId,
      branchId: null,
      ownerUserId: null,
      provider: META_CLOUD_PROVIDER,
      channelType: "shared",
      status: "active",
      businessId: null,
      wabaId: input.wabaId,
      phoneNumberId: input.phoneNumberId,
      displayPhoneNumber: phone.display_phone_number ?? input.displayPhoneNumber,
      verifiedName: phone.verified_name ?? input.displayName,
      qualityRating: phone.quality_rating ?? null,
      messagingLimit: phone.messaging_limit_tier ?? null,
      accessTokenCiphertext: encryptChannelSecret(input.accessToken, config.tokenEncryptionKey),
      tokenKeyVersion: "v1",
      tokenExpiresAt: null,
      isDefault: true,
      activatedAt: now,
      updatedAt: now,
    };
    if (samePhone) await db.update(schema.communicationChannels).set(values).where(eq(schema.communicationChannels.id, channelId));
    else await db.insert(schema.communicationChannels).values({ id: channelId, ...values, createdBy: admin.userId, createdAt: now });
    await db.insert(schema.platformAuditLogs).values({ id: randomUUID(), actorUserId: admin.userId, action: samePhone ? "whatsapp_channel.reconnected" : "whatsapp_channel.connected", targetType: "communication_channel", targetId: channelId, metadata: { tenantId: input.tenantId, wabaId: input.wabaId, phoneNumberId: input.phoneNumberId }, createdAt: now });
    revalidatePath("/super-admin/integrations/whatsapp");
    revalidatePath("/settings/whatsapp");
    revalidatePath("/conversas");
    return { success: true as const, displayPhoneNumber: values.displayPhoneNumber };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Não foi possível conectar a empresa." };
  }
}

export async function disconnectWhatsAppTenantAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const channelId = String(formData.get("channelId") ?? "").trim();
  if (!channelId) throw new Error("Canal não informado.");
  const db = getDatabase();
  const [channel] = await db.select({ id: schema.communicationChannels.id, tenantId: schema.communicationChannels.tenantId }).from(schema.communicationChannels).where(and(eq(schema.communicationChannels.id, channelId), eq(schema.communicationChannels.provider, META_CLOUD_PROVIDER), isNull(schema.communicationChannels.branchId))).limit(1);
  if (!channel) throw new Error("Canal oficial não encontrado.");
  await db.update(schema.communicationChannels).set({ status: "inactive", isDefault: false, updatedAt: new Date() }).where(eq(schema.communicationChannels.id, channelId));
  await db.insert(schema.platformAuditLogs).values({ id: randomUUID(), actorUserId: admin.userId, action: "whatsapp_channel.disconnected", targetType: "communication_channel", targetId: channelId, metadata: { tenantId: channel.tenantId }, createdAt: new Date() });
  revalidatePath("/super-admin/integrations/whatsapp");
  revalidatePath("/settings/whatsapp");
  revalidatePath("/conversas");
}
