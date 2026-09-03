"use server";

import { randomInt, randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { decryptChannelSecret, encryptChannelSecret } from "./secret-crypto";
import {
  discoverMetaWabaAndPhone,
  exchangeEmbeddedSignupCode,
  getMetaPhoneNumber,
  getMetaWaba,
  MetaCloudApiError,
  registerMetaPhoneNumber,
  subscribeWabaToApp,
} from "./meta-cloud-client";
import { getMetaCloudServerConfig } from "./meta-cloud-config";
import { isMetaCloudWhatsAppEnabled } from "./service";
import { META_CLOUD_PROVIDER, type MetaEmbeddedSignupPayload } from "./types";

const signupInput = z.object({
  code: z.string().trim().min(12).max(4096),
  businessId: z.string().trim().regex(/^\d{5,40}$/).optional(),
  wabaId: z.string().trim().regex(/^\d{5,40}$/).optional(),
  phoneNumberId: z.string().trim().regex(/^\d{5,40}$/).optional(),
  branchId: z.string().uuid().optional(),
});

function requireSignupValue(value: string | undefined, label: string) {
  if (!value) throw new Error(`A Meta não retornou ${label}. Refaça o cadastro.`);
  return value;
}

function generateRegistrationPin() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

async function registerChannelPhone(input: {
  channelId: string;
  tenantId: string;
  actorUserId: string;
  phoneNumberId: string;
  accessToken: string;
  registrationPin: string;
}) {
  const db = getDatabase();
  const now = new Date();
  let registrationSucceeded = false;
  let lastErrorMessage = "";

  try {
    await registerMetaPhoneNumber(input.phoneNumberId, input.accessToken, input.registrationPin);
    registrationSucceeded = true;
  } catch (error) {
    const isAlreadyRegistered =
      (error instanceof MetaCloudApiError && (error.code === 133015 || error.code === 100)) ||
      (error instanceof Error && (error.message.toLowerCase().includes("already registered") || error.message.toLowerCase().includes("já registrado")));

    if (isAlreadyRegistered) {
      registrationSucceeded = true;
    } else {
      try {
        const phone = await getMetaPhoneNumber(input.phoneNumberId, input.accessToken);
        if (phone?.id === input.phoneNumberId && (phone.verified_name || phone.display_phone_number)) {
          registrationSucceeded = true;
        }
      } catch {
        // Ignora erro de verificação secundária
      }

      if (!registrationSucceeded) {
        const errorCode = error instanceof Error && "code" in error && typeof error.code === "number" ? String(error.code) : "unknown";
        lastErrorMessage = error instanceof Error ? error.message : "Erro na chamada da Cloud API.";
        await db.transaction(async (tx) => {
          await tx.update(schema.communicationChannels).set({ status: "pending", registrationStatus: "failed", registrationErrorCode: errorCode, updatedAt: new Date() }).where(and(eq(schema.communicationChannels.id, input.channelId), eq(schema.communicationChannels.tenantId, input.tenantId)));
          await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: input.actorUserId, entidade: "communication_channel", entidadeId: input.channelId, acao: "meta_cloud_channel_registration_failed" });
        });
        throw new Error(`A Meta não concluiu o registro da Cloud API: ${lastErrorMessage}`);
      }
    }
  }

  await db.transaction(async (tx) => {
    await tx.update(schema.communicationChannels).set({ status: "active", registrationStatus: "registered", registrationErrorCode: null, registeredAt: now, activatedAt: now, updatedAt: now }).where(and(eq(schema.communicationChannels.id, input.channelId), eq(schema.communicationChannels.tenantId, input.tenantId)));
    await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: input.actorUserId, entidade: "communication_channel", entidadeId: input.channelId, acao: "meta_cloud_channel_registered" });
  });
}

export async function completeMetaEmbeddedSignupAction(rawInput: MetaEmbeddedSignupPayload) {
  const input = signupInput.parse(rawInput);
  const context = await getRequiredTenantContext();
  if (context.role !== "director") throw new Error("Somente o Diretor pode conectar um canal oficial da corretora.");
  if (!(await isMetaCloudWhatsAppEnabled())) throw new Error("A integração oficial está desativada pelo Super-admin.");
  if (input.branchId) throw new Error("O canal oficial é corporativo e deve ser conectado pela matriz.");
  const code = requireSignupValue(input.code, "o código de autorização");
  const db = getDatabase();

  const token = await exchangeEmbeddedSignupCode(code);
  const accessToken = requireSignupValue(token.access_token, "o token de autorização");

  let businessId = input.businessId;
  let wabaId = input.wabaId;
  let phoneNumberId = input.phoneNumberId;

  if (!wabaId || !phoneNumberId || !businessId) {
    const discovered = await discoverMetaWabaAndPhone(accessToken);
    businessId = businessId || discovered.businessId;
    wabaId = wabaId || discovered.wabaId;
    phoneNumberId = phoneNumberId || discovered.phoneNumberId;
  }

  const [waba, phone] = await Promise.all([getMetaWaba(wabaId, accessToken), getMetaPhoneNumber(phoneNumberId, accessToken)]);
  if (waba.id !== wabaId || phone.id !== phoneNumberId) throw new Error("A Meta retornou uma conta diferente da selecionada no cadastro.");
  await subscribeWabaToApp(wabaId, accessToken);

  const [existing] = await db.select().from(schema.communicationChannels).where(and(eq(schema.communicationChannels.provider, META_CLOUD_PROVIDER), eq(schema.communicationChannels.phoneNumberId, phoneNumberId))).limit(1);
  if (existing && existing.tenantId !== context.tenantId) throw new Error("Este número oficial já está vinculado a outra corretora.");
  const [currentDefault] = await db.select({ id: schema.communicationChannels.id }).from(schema.communicationChannels).where(and(eq(schema.communicationChannels.tenantId, context.tenantId), eq(schema.communicationChannels.provider, META_CLOUD_PROVIDER), isNull(schema.communicationChannels.branchId), eq(schema.communicationChannels.isDefault, true))).limit(1);
  if (currentDefault && currentDefault.id !== existing?.id) throw new Error("Esta corretora já possui um canal oficial ativo. Desconecte-o antes de trocar o número.");
  const config = getMetaCloudServerConfig();
  const now = new Date();
  const registrationPin = existing?.registrationPinCiphertext
    ? decryptChannelSecret(existing.registrationPinCiphertext, config.tokenEncryptionKey)
    : generateRegistrationPin();
  const values = { tenantId: context.tenantId, branchId: null, ownerUserId: null, provider: META_CLOUD_PROVIDER, channelType: "shared", status: "pending", businessId, wabaId, phoneNumberId, displayPhoneNumber: phone.display_phone_number ?? null, verifiedName: phone.verified_name ?? null, qualityRating: phone.quality_rating ?? null, messagingLimit: phone.messaging_limit_tier ?? null, registrationStatus: "registering", registrationPinCiphertext: encryptChannelSecret(registrationPin, config.tokenEncryptionKey), registrationErrorCode: null, registeredAt: null, accessTokenCiphertext: encryptChannelSecret(accessToken, config.tokenEncryptionKey), tokenKeyVersion: "v1", tokenExpiresAt: token.expires_in ? new Date(now.getTime() + token.expires_in * 1000) : null, activatedAt: null, updatedAt: now };
  const channelId = existing?.id ?? randomUUID();
  if (existing) await db.update(schema.communicationChannels).set({ ...values, isDefault: true }).where(eq(schema.communicationChannels.id, existing.id));
  else {
    await db.insert(schema.communicationChannels).values({ id: channelId, ...values, isDefault: true, createdBy: context.userId, createdAt: now });
  }
  await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "communication_channel", entidadeId: channelId, acao: existing ? "meta_cloud_channel_reconnected" : "meta_cloud_channel_signup_received" });

  try {
    await registerChannelPhone({ channelId, tenantId: context.tenantId, actorUserId: context.userId, phoneNumberId, accessToken, registrationPin });
  } catch (error) {
    throw error;
  }
  return { success: true, channelId, displayPhoneNumber: phone.display_phone_number ?? null, registrationStatus: "registered" };
}

/** Completes registration for a legacy signup without asking the user to repeat Meta's phone verification. */
export async function completeMetaCloudChannelRegistrationAction(channelId: string) {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") throw new Error("Somente o Diretor pode concluir a ativação do canal oficial.");
  if (!(await isMetaCloudWhatsAppEnabled())) throw new Error("A integração oficial está desativada pelo Super-admin.");
  const db = getDatabase();
  const [channel] = await db.select().from(schema.communicationChannels).where(and(eq(schema.communicationChannels.id, channelId), eq(schema.communicationChannels.tenantId, context.tenantId), eq(schema.communicationChannels.provider, META_CLOUD_PROVIDER), isNull(schema.communicationChannels.branchId))).limit(1);
  if (!channel?.phoneNumberId || !channel.accessTokenCiphertext) throw new Error("Este canal não possui as credenciais necessárias. Reconecte-o pela Meta.");
  const config = getMetaCloudServerConfig();
  const accessToken = decryptChannelSecret(channel.accessTokenCiphertext, config.tokenEncryptionKey);
  const registrationPin = channel.registrationPinCiphertext
    ? decryptChannelSecret(channel.registrationPinCiphertext, config.tokenEncryptionKey)
    : generateRegistrationPin();
  await db.update(schema.communicationChannels).set({ status: "pending", registrationStatus: "registering", registrationPinCiphertext: encryptChannelSecret(registrationPin, config.tokenEncryptionKey), registrationErrorCode: null, updatedAt: new Date() }).where(and(eq(schema.communicationChannels.id, channel.id), eq(schema.communicationChannels.tenantId, context.tenantId)));
  try {
    await registerChannelPhone({ channelId: channel.id, tenantId: context.tenantId, actorUserId: context.userId, phoneNumberId: channel.phoneNumberId, accessToken, registrationPin });
  } catch (error) {
    throw error;
  }
  return { success: true };
}

export async function setMetaCloudChannelStatusAction(channelId: string, active: boolean) {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") throw new Error("Somente o Diretor pode alterar canais oficiais.");
  const db = getDatabase();
  const [channel] = await db.select({ id: schema.communicationChannels.id }).from(schema.communicationChannels).where(and(eq(schema.communicationChannels.id, channelId), eq(schema.communicationChannels.tenantId, context.tenantId), eq(schema.communicationChannels.provider, META_CLOUD_PROVIDER))).limit(1);
  if (!channel) throw new Error("Canal oficial não encontrado.");
  await db.update(schema.communicationChannels).set({ status: active ? "active" : "inactive", updatedAt: new Date() }).where(eq(schema.communicationChannels.id, channelId));
  await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "communication_channel", entidadeId: channel.id, acao: active ? "meta_cloud_channel_activated" : "meta_cloud_channel_deactivated" });
}

/** Disconnects the CRM while retaining auditable conversation history. */
export async function disconnectMetaCloudChannelAction(channelId: string) {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") throw new Error("Somente o Diretor pode desconectar canais oficiais.");
  const db = getDatabase();
  const [channel] = await db.select({ id: schema.communicationChannels.id }).from(schema.communicationChannels).where(and(
    eq(schema.communicationChannels.id, channelId),
    eq(schema.communicationChannels.tenantId, context.tenantId),
    eq(schema.communicationChannels.provider, META_CLOUD_PROVIDER),
  )).limit(1);
  if (!channel) throw new Error("Canal oficial não encontrado.");

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(schema.communicationChannels).set({
      status: "inactive", isDefault: false, accessTokenCiphertext: null,
      tokenKeyVersion: null, tokenExpiresAt: null, registrationPinCiphertext: null, updatedAt: now,
    }).where(eq(schema.communicationChannels.id, channel.id));
    await tx.insert(schema.auditLogs).values({
      id: randomUUID(), userId: context.userId, entidade: "communication_channel",
      entidadeId: channel.id, acao: "meta_cloud_channel_disconnected", createdAt: now,
    });
  });
  return { success: true };
}
