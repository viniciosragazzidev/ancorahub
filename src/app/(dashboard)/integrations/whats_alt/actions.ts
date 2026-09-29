"use server";

import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { setSystemSetting } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";
import { tenantChannelRoutingKey } from "@/features/waha-cadence/tenant-channel-routing";
import { normalizeTenantChannelRouting, type TenantChannelRouting } from "@/features/waha-cadence/tenant-channel-routing-rules";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { teamNoticeByKey, type NoticeChannel } from "@/features/team-notices/catalog";
import { MAX_NOTICE_FREE_MESSAGES } from "@/features/team-notices/variants";
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

export type TeamNoticeInput = { key: string; enabled: boolean; channel: NoticeChannel; freeMessageIds: string[] };

/** Team notices (DEC-125): on/off, channel (Meta only or company WhatsApp) and the company-number text of each notice. */
export async function saveTeamNoticesAction(input: TeamNoticeInput[]): Promise<Result<object>> {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director") return { success: false, error: "Apenas o Diretor pode alterar os avisos da equipe." };
    const rows = input.filter((item) => {
      const notice = teamNoticeByKey(item.key);
      return notice && !notice.metaOnly && (item.channel === "company_number" || item.channel === "meta");
    }).map((item) => {
      const notice = teamNoticeByKey(item.key)!;
      const freeMessageIds = notice.chat ? [] : [...new Set((item.freeMessageIds ?? []).filter((id) => typeof id === "string" && id))];
      return { ...item, enabled: notice.alwaysOn ? true : item.enabled, freeMessageIds };
    });
    const tooMany = rows.find((item) => item.freeMessageIds.length > MAX_NOTICE_FREE_MESSAGES);
    if (tooMany) return { success: false, error: `Cada aviso aceita no máximo ${MAX_NOTICE_FREE_MESSAGES} textos.` };
    const messageIds = [...new Set(rows.flatMap((item) => item.freeMessageIds))];
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
          freeMessageId: item.freeMessageIds[0] ?? null, freeMessageIds: item.freeMessageIds, updatedBy: context.userId, updatedAt: now,
        }).onConflictDoUpdate({
          target: [schema.teamNoticeSettings.tenantId, schema.teamNoticeSettings.noticeKey],
          set: { enabled: item.enabled, channel: item.channel, freeMessageId: item.freeMessageIds[0] ?? null, freeMessageIds: item.freeMessageIds, updatedBy: context.userId, updatedAt: now },
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
