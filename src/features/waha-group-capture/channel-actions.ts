"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  disconnectMaterialsChannel,
  getMaterialsChannel,
  readMaterialsChannelState,
  startMaterialsChannel,
  type TenantChannelState,
} from "@/features/waha-cadence/tenant-channel";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { setGroupActive, syncWahaGroups } from "./groups-service";

const PAGE_PATH = "/integrations/whatsapp";

type Result<T> = ({ success: true } & T) | { success: false; error: string };

function failure(error: unknown, fallback: string) {
  return { success: false as const, error: error instanceof Error ? error.message : fallback };
}

async function requireDirector() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") throw new Error("Apenas o Diretor pode gerenciar os materiais de operadoras.");
  return context;
}

async function audit(userId: string, entidadeId: string, acao: string) {
  await getDatabase().insert(schema.auditLogs).values({
    id: randomUUID(),
    userId,
    entidade: "waha_group_source",
    entidadeId,
    acao,
    createdAt: new Date(),
  });
}

export async function startMaterialsChannelAction(options: { fresh?: boolean } = {}): Promise<Result<TenantChannelState>> {
  try {
    const context = await getRequiredTenantContext();
    const state = await startMaterialsChannel(context, options);
    revalidatePath(PAGE_PATH);
    return { success: true, ...state };
  } catch (error) {
    return failure(error, "Não foi possível iniciar a conexão do número de materiais.");
  }
}

export async function pollMaterialsChannelAction(): Promise<Result<TenantChannelState>> {
  try {
    const context = await getRequiredTenantContext();
    return { success: true, ...(await readMaterialsChannelState(context)) };
  } catch (error) {
    return failure(error, "Não foi possível consultar a conexão.");
  }
}

export async function disconnectMaterialsChannelAction(): Promise<Result<object>> {
  try {
    const context = await getRequiredTenantContext();
    await disconnectMaterialsChannel(context);
    revalidatePath(PAGE_PATH);
    return { success: true };
  } catch (error) {
    return failure(error, "Não foi possível desconectar o número de materiais.");
  }
}

/** Reads the groups the connected number belongs to. New groups start inactive. */
export async function refreshMaterialGroupsAction(): Promise<Result<{ groupsFound: number }>> {
  try {
    const context = await requireDirector();
    const channel = await getMaterialsChannel(context);
    if (!channel || channel.status !== "ready") {
      return { success: false, error: "Conecte o número antes de listar os grupos." };
    }
    const { groupsFound } = await syncWahaGroups({ tenantId: context.tenantId, wahaNumberId: channel.id });
    await audit(context.userId, channel.id, `waha_group_sources.listed:${groupsFound}`);
    revalidatePath(PAGE_PATH);
    return { success: true, groupsFound };
  } catch (error) {
    return failure(error, "Não foi possível listar os grupos do número.");
  }
}

const toggleSchema = z.object({ id: z.string().min(1).max(200), active: z.boolean() });

/** Turns capture on or off for one group of this tenant. */
export async function setMaterialGroupActiveAction(input: { id: string; active: boolean }): Promise<Result<object>> {
  try {
    const context = await requireDirector();
    const { id, active } = toggleSchema.parse(input);
    const changed = await setGroupActive({ id, active, tenantId: context.tenantId });
    if (changed === 0) return { success: false, error: "Grupo não encontrado." };
    await audit(context.userId, id, `waha_group_sources.active_changed:${active}`);
    revalidatePath(PAGE_PATH);
    return { success: true };
  } catch (error) {
    return failure(error, "Não foi possível alterar o grupo.");
  }
}
