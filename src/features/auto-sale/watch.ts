import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getSystemSetting, setSystemSetting } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";
import type { TenantContext } from "@/shared/auth/types";

import { readAutoSaleFlags } from "./flag";
import { leadIdsInActiveAutoSale } from "./repository";
import { assertManager, audit, AutoSaleError, startDeal } from "./service";

/**
 * "Aguardar o próximo quente" (pedido do Vinicios, 12/11): com a espera ligada, o lead que fica quente é
 * capturado pela Venda Automatizada antes de a distribuição oferecer a qualquer corretor, desde que não haja
 * negociação aberta na empresa. Fica ligada até o diretor parar. Guardado em `auto_sale_watch_<tenantId>`.
 */
export function autoSaleWatchKey(tenantId: string) {
  return `auto_sale_watch_${tenantId}`;
}

const watchSchema = z.object({ userId: z.string().min(1), mode: z.enum(["simulation", "copilot", "autopilot"]), since: z.string() });
export type AutoSaleWatch = z.infer<typeof watchSchema>;

export function parseWatch(raw: string | null | undefined): AutoSaleWatch | null {
  if (!raw || raw === "off") return null;
  try {
    const parsed = watchSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function readAutoSaleWatch(tenantId: string) {
  return parseWatch(await getSystemSetting(autoSaleWatchKey(tenantId)).catch(() => null));
}

export async function setAutoSaleWatch(context: TenantContext, input: { armed: boolean; mode: AutoSaleWatch["mode"] }) {
  assertManager(context);
  const value = input.armed ? JSON.stringify({ userId: context.userId, mode: input.mode, since: new Date().toISOString() } satisfies AutoSaleWatch) : "off";
  await setSystemSetting(autoSaleWatchKey(context.tenantId), value);
  await getDatabase().insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "auto_sale_watch", entidadeId: context.tenantId, acao: input.armed ? "auto_sale.watch_armed" : "auto_sale.watch_stopped", metadata: { mode: input.mode } });
}

/** Contexto de quem ligou a espera: só vale se ainda for diretor ou gestor ativo da empresa. */
async function watcherContext(tenantId: string, userId: string): Promise<TenantContext | null> {
  const [membership] = await getDatabase().select({ role: schema.tenantMemberships.role, jobTitle: schema.tenantMemberships.jobTitle, branchId: schema.tenantMemberships.branchId })
    .from(schema.tenantMemberships)
    .where(and(eq(schema.tenantMemberships.tenantId, tenantId), eq(schema.tenantMemberships.userId, userId), eq(schema.tenantMemberships.status, "active"))).limit(1);
  if (!membership || (membership.role !== "director" && membership.role !== "manager")) return null;
  return { userId, tenantId, role: membership.role, jobTitle: membership.jobTitle ?? membership.role, branchId: membership.branchId ?? null };
}

/**
 * Chamado pelo motor de distribuição quando um lead quente vai ser distribuído. Captura o lead
 * para a Venda Automatizada se a espera estiver ligada e não houver negociação aberta. Qualquer recusa
 * (lead sem base legal, já com corretor etc.) devolve false e a distribuição segue normal.
 */
export async function tryCaptureHotLead(tenantId: string, leadId: string): Promise<boolean> {
  try {
    const watch = await readAutoSaleWatch(tenantId);
    if (!watch) return false;
    const flags = await readAutoSaleFlags(tenantId);
    if (!flags.enabled || !flags.global) return false;
    if ((await leadIdsInActiveAutoSale(tenantId)).size > 0) return false;
    const context = await watcherContext(tenantId, watch.userId);
    if (!context) return false;
    const mode = watch.mode === "autopilot" && !flags.autopilot ? "copilot" : watch.mode;
    const { dealId } = await startDeal(context, { leadId, channel: "meta", wahaNumberId: null, mode });
    await audit(watch.userId, dealId, "auto_sale.watch_captured", { leadId, mode });
    // Autopiloto: a abertura sai já, sem esperar a próxima rodada do robô (a conversa não fica muda).
    if (mode === "autopilot") {
      const { dispatchAutoSaleOutbox } = await import("./dispatch");
      await dispatchAutoSaleOutbox(new Date(Date.now() + 10_000), 10, dealId).catch((error) => console.warn("[auto-sale] watch_opening_dispatch_failed", { dealId, error: error instanceof Error ? error.message.slice(0, 160) : "unknown" }));
    }
    const [lead] = await getDatabase().select({ nome: schema.leads.nome }).from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, tenantId))).limit(1);
    await getDatabase().insert(schema.notifications).values({
      id: randomUUID(), tenantId, recipientUserId: watch.userId, leadId, type: "auto_sale_notice",
      title: "Venda Automatizada pegou um lead quente",
      message: `${lead?.nome ?? "Um lead"} ficou quente e entrou na Venda Automatizada em ${mode === "simulation" ? "Simulação" : mode === "copilot" ? "Copiloto" : "Autopiloto"}, sem ir para corretor.${mode === "copilot" ? " Aprove a primeira mensagem." : ""}`,
      idempotencyKey: `auto-sale:watch:${dealId}`,
    }).onConflictDoNothing();
    return true;
  } catch (error) {
    if (!(error instanceof AutoSaleError)) console.warn("[auto-sale] watch_capture_failed", { tenantId, leadId, error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    return false;
  }
}
