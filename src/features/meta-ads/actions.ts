"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { encryptMetaToken, exchangeCodeForLongLivedToken } from "./meta-oauth";
import { MetaGraphClient } from "./meta-graph-client";
import { runMetaTenantSync } from "./meta-sync-service";
import type { MetaConnectionInfo, MetaDiscoveredAssets, MetaSyncLogItem } from "./types";

/** Obter estado atual da conexão Meta do tenant */
export async function getMetaConnectionState(): Promise<{
  connection: MetaConnectionInfo | null;
  assets: MetaDiscoveredAssets | null;
  logs: MetaSyncLogItem[];
  isConfigured: boolean;
}> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const [connection] = await db
    .select()
    .from(schema.metaConnections)
    .where(eq(schema.metaConnections.tenantId, context.tenantId))
    .limit(1);

  if (!connection) {
    return {
      connection: null,
      assets: null,
      logs: [],
      isConfigured: false,
    };
  }

  const [pagesCountResult] = await db
    .select({ count: schema.metaPages.id })
    .from(schema.metaPages)
    .where(eq(schema.metaPages.tenantId, context.tenantId));

  const [adAccountsCountResult] = await db
    .select({ count: schema.metaAdAccounts.id })
    .from(schema.metaAdAccounts)
    .where(eq(schema.metaAdAccounts.tenantId, context.tenantId));

  const [whatsappChannel] = await db
    .select({ id: schema.communicationChannels.id })
    .from(schema.communicationChannels)
    .where(and(eq(schema.communicationChannels.tenantId, context.tenantId), eq(schema.communicationChannels.provider, "meta_cloud")))
    .limit(1);

  const logs = await db
    .select()
    .from(schema.metaSyncLogs)
    .where(eq(schema.metaSyncLogs.tenantId, context.tenantId))
    .orderBy(desc(schema.metaSyncLogs.startedAt))
    .limit(10);

  const connInfo: MetaConnectionInfo = {
    id: connection.id,
    tenantId: connection.tenantId,
    businessId: connection.businessId,
    businessName: connection.businessName,
    status: connection.status as any,
    permissions: (connection.permissions as string[]) || [],
    expiresAt: connection.expiresAt,
    lastError: connection.lastError,
    lastSyncedAt: connection.lastSyncedAt,
    pagesCount: pagesCountResult ? 1 : 0,
    adAccountsCount: adAccountsCountResult ? 1 : 0,
    whatsappConnected: !!whatsappChannel,
  };

  return {
    connection: connInfo,
    assets: null,
    logs: logs.map((l) => ({
      id: l.id,
      syncType: l.syncType,
      status: l.status,
      itemsSynced: l.itemsSynced,
      errorDetails: l.errorDetails,
      durationMs: l.durationMs,
      startedAt: l.startedAt,
      completedAt: l.completedAt,
    })),
    isConfigured: connection.status === "connected",
  };
}

/** Descobrir ativos Meta via token/código de auth */
export async function discoverMetaAssetsFromAuthCode(code: string, redirectUri: string): Promise<MetaDiscoveredAssets> {
  const tokenData = await exchangeCodeForLongLivedToken(code, redirectUri);
  const client = new MetaGraphClient(tokenData.accessToken);
  return client.discoverAssets();
}

/** Salva/Confirma a conexão Meta do tenant com os ativos selecionados */
export async function confirmMetaConnection(payload: {
  authCode?: string;
  redirectUri?: string;
  businessId: string;
  businessName: string;
  pages: Array<{ id: string; name: string }>;
  adAccounts: Array<{ id: string; name: string; currency: string }>;
  whatsapp?: { wabaId: string; phoneNumberId: string; displayPhoneNumber: string } | null;
}): Promise<{ success: boolean; error?: string }> {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") {
    throw new Error("Apenas Diretores podem configurar integrações com a Meta.");
  }

  const db = getDatabase();
  const now = new Date();

  // Exchange auth code or generate mock long lived token
  let token = `EAA_META_TOKEN_${randomUUID()}`;
  let expiresAt = new Date(Date.now() + 60 * 24 * 3600 * 1000);

  if (payload.authCode && payload.redirectUri) {
    const exchanged = await exchangeCodeForLongLivedToken(payload.authCode, payload.redirectUri);
    token = exchanged.accessToken;
    expiresAt = new Date(Date.now() + exchanged.expiresIn * 1000);
  }

  const tokenCiphertext = encryptMetaToken(token);
  const connectionId = randomUUID();

  // 1. Inserir ou atualizar meta_connections
  const [existing] = await db
    .select({ id: schema.metaConnections.id })
    .from(schema.metaConnections)
    .where(eq(schema.metaConnections.tenantId, context.tenantId))
    .limit(1);

  if (existing) {
    await db
      .update(schema.metaConnections)
      .set({
        businessId: payload.businessId,
        businessName: payload.businessName,
        accessTokenCiphertext: tokenCiphertext,
        expiresAt,
        status: "connected",
        lastError: null,
        updatedAt: now,
      })
      .where(eq(schema.metaConnections.id, existing.id));
  } else {
    await db.insert(schema.metaConnections).values({
      id: connectionId,
      tenantId: context.tenantId,
      businessId: payload.businessId,
      businessName: payload.businessName,
      accessTokenCiphertext: tokenCiphertext,
      expiresAt,
      status: "connected",
      createdBy: context.userId,
      createdAt: now,
      updatedAt: now,
    });
  }

  const activeConnectionId = existing?.id || connectionId;

  // 2. Salvar Páginas
  for (const page of payload.pages) {
    await db
      .insert(schema.metaPages)
      .values({
        id: randomUUID(),
        tenantId: context.tenantId,
        connectionId: activeConnectionId,
        pageId: page.id,
        name: page.name,
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [schema.metaPages.tenantId, schema.metaPages.pageId],
        set: { name: page.name, updatedAt: now },
      });
  }

  // 3. Salvar Contas de Anúncios
  for (const adAcc of payload.adAccounts) {
    await db
      .insert(schema.metaAdAccounts)
      .values({
        id: randomUUID(),
        tenantId: context.tenantId,
        connectionId: activeConnectionId,
        adAccountId: adAcc.id,
        name: adAcc.name,
        currency: adAcc.currency || "BRL",
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [schema.metaAdAccounts.tenantId, schema.metaAdAccounts.adAccountId],
        set: { name: adAcc.name, currency: adAcc.currency || "BRL", updatedAt: now },
      });
  }

  // 4. Salvar Canal WhatsApp se fornecido
  if (payload.whatsapp?.phoneNumberId) {
    await db
      .insert(schema.communicationChannels)
      .values({
        id: randomUUID(),
        tenantId: context.tenantId,
        provider: "meta_cloud",
        status: "active",
        businessId: payload.businessId,
        wabaId: payload.whatsapp.wabaId,
        phoneNumberId: payload.whatsapp.phoneNumberId,
        displayPhoneNumber: payload.whatsapp.displayPhoneNumber,
        accessTokenCiphertext: tokenCiphertext,
        isDefault: true,
        createdBy: context.userId,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [schema.communicationChannels.provider, schema.communicationChannels.phoneNumberId],
        set: {
          status: "active",
          accessTokenCiphertext: tokenCiphertext,
          displayPhoneNumber: payload.whatsapp.displayPhoneNumber,
          updatedAt: now,
        },
      });
  }

  // 5. Registrar auditoria
  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: context.userId,
    entidade: "meta_connection",
    entidadeId: activeConnectionId,
    acao: "meta_connection_configured",
    createdAt: now,
  });

  // 6. Rodar primeira sincronização
  await runMetaTenantSync(context.tenantId, "full");

  revalidatePath("/settings/integracoes/meta");
  revalidatePath("/marketing/campanhas");

  return { success: true };
}

/** Desconectar integração Meta */
export async function disconnectMetaConnection(): Promise<{ success: boolean }> {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") {
    throw new Error("Apenas Diretores podem desconectar integrações.");
  }

  const db = getDatabase();
  await db
    .update(schema.metaConnections)
    .set({ status: "disconnected", updatedAt: new Date() })
    .where(eq(schema.metaConnections.tenantId, context.tenantId));

  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: context.userId,
    entidade: "meta_connection",
    entidadeId: context.tenantId,
    acao: "meta_connection_disconnected",
    createdAt: new Date(),
  });

  revalidatePath("/settings/integracoes/meta");
  return { success: true };
}

/** Disparar sincronização manual */
export async function triggerManualMetaSync(): Promise<{ success: boolean; itemsSynced: number; error?: string }> {
  const context = await getRequiredTenantContext();
  const res = await runMetaTenantSync(context.tenantId, "full");
  revalidatePath("/settings/integracoes/meta");
  revalidatePath("/marketing/campanhas");
  return res;
}
