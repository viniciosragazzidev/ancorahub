"use server";

import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { setSystemSetting } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";
import { companyNumberNoticesKey, tenantChannelRoutingKey } from "@/features/waha-cadence/tenant-channel-routing";
import { normalizeTenantChannelRouting, type TenantChannelRouting } from "@/features/waha-cadence/tenant-channel-routing-rules";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { teamNoticeByKey, type NoticeChannel } from "@/features/team-notices/catalog";
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
    revalidatePath("/integrations/whatsapp");
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
    revalidatePath("/integrations/whatsapp");
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
    revalidatePath("/integrations/whatsapp");
    return { success: true };
  } catch (error) {
    return failure(error, "Não foi possível salvar os envios do número da empresa.");
  }
}

export type TeamNoticeInput = { key: string; enabled: boolean; channel: NoticeChannel; freeMessageId: string | null };

/** Team notices (DEC-125): on/off, primary channel and the company-number text of each notice. */
/** Master switch: off sends every team message through the official Meta API only. */
export async function saveCompanyNumberNoticesAction(enabled: boolean): Promise<Result<object>> {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director") return { success: false, error: "Apenas o Diretor pode alterar o canal dos avisos." };
    await setSystemSetting(companyNumberNoticesKey(context.tenantId), enabled ? "true" : "false");
    await getDatabase().insert(schema.auditLogs).values({
      id: randomUUID(), userId: context.userId, entidade: "tenant", entidadeId: context.tenantId,
      acao: `team_notices.company_number:${enabled ? "on" : "off"}`,
    });
    revalidatePath("/integrations/whatsapp");
    return { success: true };
  } catch (error) {
    return failure(error, "Não foi possível alterar o canal dos avisos.");
  }
}

export async function saveTeamNoticesAction(input: TeamNoticeInput[]): Promise<Result<object>> {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director") return { success: false, error: "Apenas o Diretor pode alterar os avisos da equipe." };
    const rows = input.filter((item) => {
      const notice = teamNoticeByKey(item.key);
      return notice && !notice.metaOnly && (item.channel === "company_number" || item.channel === "meta");
    }).map((item) => (teamNoticeByKey(item.key)?.alwaysOn ? { ...item, enabled: true } : item));
    const messageIds = [...new Set(rows.map((item) => item.freeMessageId).filter((id): id is string => Boolean(id)))];
    if (messageIds.length) {
      const found = await getDatabase().select({ id: schema.messageTemplates.id }).from(schema.messageTemplates).where(and(
        eq(schema.messageTemplates.tenantId, context.tenantId),
        eq(schema.messageTemplates.active, true),
        inArray(schema.messageTemplates.id, messageIds),
      ));
      if (found.length !== messageIds.length) return { success: false, error: "Uma das mensagens escolhidas não existe ou está inativa." };
    }
    const now = new Date();
    await getDatabase().transaction(async (tx) => {
      for (const item of rows) {
        await tx.insert(schema.teamNoticeSettings).values({
          tenantId: context.tenantId, noticeKey: item.key, enabled: item.enabled, channel: item.channel,
          freeMessageId: item.freeMessageId, updatedBy: context.userId, updatedAt: now,
        }).onConflictDoUpdate({
          target: [schema.teamNoticeSettings.tenantId, schema.teamNoticeSettings.noticeKey],
          set: { enabled: item.enabled, channel: item.channel, freeMessageId: item.freeMessageId, updatedBy: context.userId, updatedAt: now },
        });
      }
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(), userId: context.userId, entidade: "tenant", entidadeId: context.tenantId,
        acao: `team_notices.updated:${rows.map((item) => `${item.key}=${item.enabled ? item.channel : "off"}`).join(",")}`.slice(0, 500),
      });
    });
    revalidatePath("/integrations/whatsapp");
    return { success: true };
  } catch (error) {
    return failure(error, "Não foi possível salvar os avisos da equipe.");
  }
}
