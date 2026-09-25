"use server";

import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { setSystemSetting } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";
import { tenantChannelRoutingKey } from "@/features/waha-cadence/tenant-channel-routing";
import { normalizeTenantChannelRouting, type TenantChannelRouting } from "@/features/waha-cadence/tenant-channel-routing-rules";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import {
  disconnectTenantChannel,
  readTenantChannelState,
  startTenantChannel,
  type TenantChannelState,
} from "@/features/waha-cadence/tenant-channel";

type Result<T> = ({ success: true } & T) | { success: false; error: string };

function failure(error: unknown, fallback: string) {
  return { success: false as const, error: error instanceof Error ? error.message : fallback };
}

export async function startTenantChannelAction(options: { fresh?: boolean } = {}): Promise<Result<TenantChannelState>> {
  try {
    const context = await getRequiredTenantContext();
    const state = await startTenantChannel(context, options);
    revalidatePath("/integrations/whats_alt");
    return { success: true, ...state };
  } catch (error) {
    return failure(error, "Não foi possível iniciar a conexão do número da empresa.");
  }
}

export async function pollTenantChannelAction(): Promise<Result<TenantChannelState>> {
  try {
    const context = await getRequiredTenantContext();
    return { success: true, ...(await readTenantChannelState(context)) };
  } catch (error) {
    return failure(error, "Não foi possível consultar a conexão.");
  }
}

export async function disconnectTenantChannelAction(): Promise<Result<object>> {
  try {
    const context = await getRequiredTenantContext();
    await disconnectTenantChannel(context);
    revalidatePath("/integrations/whats_alt");
    return { success: true };
  } catch (error) {
    return failure(error, "Não foi possível desconectar o número da empresa.");
  }
}

/** Which broker notices leave through the company number, and with which free message. */
export async function saveTenantChannelRoutingAction(input: TenantChannelRouting): Promise<Result<object>> {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director") return { success: false, error: "Apenas o Diretor pode alterar os envios do número da empresa." };
    const routing = normalizeTenantChannelRouting(input);
    const messageIds = [...new Set(Object.values(routing.events))];
    if (messageIds.length) {
      const found = await getDatabase().select({ id: schema.messageTemplates.id }).from(schema.messageTemplates).where(and(
        eq(schema.messageTemplates.tenantId, context.tenantId),
        eq(schema.messageTemplates.active, true),
        inArray(schema.messageTemplates.id, messageIds),
      ));
      if (found.length !== messageIds.length) return { success: false, error: "Uma das mensagens livres escolhidas não existe ou está inativa." };
    }
    await setSystemSetting(tenantChannelRoutingKey(context.tenantId), JSON.stringify(routing));
    await getDatabase().insert(schema.auditLogs).values({
      id: randomUUID(), userId: context.userId, entidade: "tenant", entidadeId: context.tenantId,
      acao: `tenant_channel.routing_updated:${Object.keys(routing.events).sort().join(",") || "none"}`,
    });
    revalidatePath("/integrations/whats_alt");
    return { success: true };
  } catch (error) {
    return failure(error, "Não foi possível salvar os envios do número da empresa.");
  }
}
