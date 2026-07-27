"use server";

import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { encryptChannelSecret } from "./secret-crypto";
import { exchangeEmbeddedSignupCode, getMetaPhoneNumber, getMetaWaba, subscribeWabaToApp } from "./meta-cloud-client";
import { getMetaCloudServerConfig } from "./meta-cloud-config";
import { isMetaCloudWhatsAppEnabled } from "./service";
import { META_CLOUD_PROVIDER, type MetaEmbeddedSignupPayload } from "./types";

const signupInput = z.object({ code: z.string().trim().min(12).max(4096), businessId: z.string().trim().regex(/^\d{5,40}$/), wabaId: z.string().trim().regex(/^\d{5,40}$/), phoneNumberId: z.string().trim().regex(/^\d{5,40}$/), branchId: z.string().uuid().optional() });

function requireSignupValue(value: string | undefined, label: string) {
  if (!value) throw new Error(`A Meta não retornou ${label}. Refaça o cadastro.`);
  return value;
}

export async function completeMetaEmbeddedSignupAction(rawInput: MetaEmbeddedSignupPayload) {
  const input = signupInput.parse(rawInput);
  const context = await getRequiredTenantContext();
  if (context.role !== "director") throw new Error("Somente o Diretor pode conectar um canal oficial da corretora.");
  if (!(await isMetaCloudWhatsAppEnabled())) throw new Error("A integração oficial está desativada pelo Super-admin.");
  if (input.branchId) throw new Error("O canal oficial é corporativo e deve ser conectado pela matriz.");
  const code = requireSignupValue(input.code, "o código de autorização");
  const businessId = requireSignupValue(input.businessId, "o Business ID");
  const wabaId = requireSignupValue(input.wabaId, "a WABA");
  const phoneNumberId = requireSignupValue(input.phoneNumberId, "o Phone Number ID");
  const db = getDatabase();

  const token = await exchangeEmbeddedSignupCode(code);
  const accessToken = requireSignupValue(token.access_token, "o token de autorização");
  const [waba, phone] = await Promise.all([getMetaWaba(wabaId, accessToken), getMetaPhoneNumber(phoneNumberId, accessToken)]);
  if (waba.id !== wabaId || phone.id !== phoneNumberId) throw new Error("A Meta retornou uma conta diferente da selecionada no cadastro.");
  await subscribeWabaToApp(wabaId, accessToken);

  const [existing] = await db.select().from(schema.communicationChannels).where(and(eq(schema.communicationChannels.provider, META_CLOUD_PROVIDER), eq(schema.communicationChannels.phoneNumberId, phoneNumberId))).limit(1);
  if (existing && existing.tenantId !== context.tenantId) throw new Error("Este número oficial já está vinculado a outra corretora.");
  const config = getMetaCloudServerConfig();
  const now = new Date();
  const values = { tenantId: context.tenantId, branchId: null, ownerUserId: null, provider: META_CLOUD_PROVIDER, channelType: "shared", status: "active", businessId, wabaId, phoneNumberId, displayPhoneNumber: phone.display_phone_number ?? null, verifiedName: phone.verified_name ?? null, qualityRating: phone.quality_rating ?? null, messagingLimit: phone.messaging_limit_tier ?? null, accessTokenCiphertext: encryptChannelSecret(accessToken, config.tokenEncryptionKey), tokenKeyVersion: "v1", tokenExpiresAt: token.expires_in ? new Date(now.getTime() + token.expires_in * 1000) : null, activatedAt: now, updatedAt: now };
  const channelId = existing?.id ?? randomUUID();
  if (existing) await db.update(schema.communicationChannels).set({ ...values, isDefault: true }).where(eq(schema.communicationChannels.id, existing.id));
  else {
    const [currentDefault] = await db.select({ id: schema.communicationChannels.id }).from(schema.communicationChannels).where(and(eq(schema.communicationChannels.tenantId, context.tenantId), eq(schema.communicationChannels.provider, META_CLOUD_PROVIDER), isNull(schema.communicationChannels.branchId), eq(schema.communicationChannels.isDefault, true), eq(schema.communicationChannels.status, "active"))).limit(1);
    if (currentDefault) throw new Error("Esta corretora já possui um canal oficial ativo. Reconecte o número existente ou desative-o antes de trocar.");
    await db.insert(schema.communicationChannels).values({ id: channelId, ...values, isDefault: true, createdBy: context.userId, createdAt: now });
  }
  await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "communication_channel", entidadeId: channelId, acao: existing ? "meta_cloud_channel_reconnected" : "meta_cloud_channel_connected" });
  revalidatePath("/settings/whatsapp"); revalidatePath("/conversas");
  return { success: true, channelId, displayPhoneNumber: phone.display_phone_number ?? null };
}

export async function setMetaCloudChannelStatusAction(channelId: string, active: boolean) {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") throw new Error("Somente o Diretor pode alterar canais oficiais.");
  const db = getDatabase();
  const [channel] = await db.select({ id: schema.communicationChannels.id }).from(schema.communicationChannels).where(and(eq(schema.communicationChannels.id, channelId), eq(schema.communicationChannels.tenantId, context.tenantId), eq(schema.communicationChannels.provider, META_CLOUD_PROVIDER))).limit(1);
  if (!channel) throw new Error("Canal oficial não encontrado.");
  await db.update(schema.communicationChannels).set({ status: active ? "active" : "inactive", updatedAt: new Date() }).where(eq(schema.communicationChannels.id, channelId));
  await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "communication_channel", entidadeId: channel.id, acao: active ? "meta_cloud_channel_activated" : "meta_cloud_channel_deactivated" });
  revalidatePath("/settings/whatsapp"); revalidatePath("/conversas");
}
