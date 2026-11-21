"use server";

import { and, eq, isNull } from "drizzle-orm";

import { isOutsideManagerScope } from "@/features/manager-scope/manager-routes";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { createServerAgentBackend } from "./backend-server";
import { catalogEntry } from "./catalog-meta";
import { isToolVisible } from "./policy";
import { isAgentDirectorWritesEnabled } from "./settings";
import { buildAgentTools } from "./tools";
import type { ToolResult } from "./types";

/** Desfazer vale por 10 minutos (plano D5) e só enquanto a ação inversa ainda faz sentido. */
const AGENT_UNDO_WINDOW_MS = 10 * 60_000;

export async function undoAgentActionAction(actionId: string): Promise<{ ok: boolean; message: string }> {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" || isOutsideManagerScope(context.role, context.jobTitle)) return { ok: false, message: "Sem permissão." };
  if (context.viewAs) return { ok: false, message: "No \"Ver como\" nada é alterado." };
  if (typeof actionId !== "string" || actionId.length > 80) return { ok: false, message: "Ação não encontrada." };

  const db = getDatabase();
  const [row] = await db.select().from(schema.agentActions)
    .where(and(eq(schema.agentActions.id, actionId), eq(schema.agentActions.tenantId, context.tenantId), eq(schema.agentActions.userId, context.userId)))
    .limit(1);
  if (!row || row.status !== "done" || !row.undo) return { ok: false, message: "Esta ação não pode mais ser desfeita." };
  if (Date.now() - row.createdAt.getTime() > AGENT_UNDO_WINDOW_MS) return { ok: false, message: "Passou o prazo de 10 minutos. Faça a mudança pelo agente ou pela tela." };

  const entry = catalogEntry(row.undo.tool);
  const writesEnabled = await isAgentDirectorWritesEnabled(context.tenantId);
  if (!entry || !isToolVisible(entry, { role: context.role, viewAs: false, writesEnabled })) return { ok: false, message: "As ações do agente não estão liberadas agora." };

  // Marca antes (só uma vez): dois cliques não desfazem duas vezes.
  const claimed = await db.update(schema.agentActions)
    .set({ status: "undone", undoneAt: new Date(), updatedAt: new Date() })
    .where(and(eq(schema.agentActions.id, row.id), eq(schema.agentActions.status, "done"), isNull(schema.agentActions.undoneAt)))
    .returning({ id: schema.agentActions.id });
  if (!claimed.length) return { ok: false, message: "Esta ação já foi desfeita." };

  const tools = buildAgentTools({ backend: createServerAgentBackend(context), requestText: "Desfazer", approvedByUser: () => true });
  const tool = (tools as unknown as Record<string, { execute?: (input: unknown, options: { toolCallId: string; messages: [] }) => Promise<unknown> }>)[row.undo.tool];
  const result = (await tool?.execute?.(row.undo.input, { toolCallId: `undo:${row.id}:${Date.now()}`, messages: [] }).catch(() => null)) as ToolResult | null;
  if (!result?.ok) {
    // Nada (ou só parte) voltou: libera para tentar de novo e diz o motivo.
    await db.update(schema.agentActions).set({ status: "done", undoneAt: null, updatedAt: new Date() }).where(eq(schema.agentActions.id, row.id));
    return { ok: false, message: result?.message ?? "Não consegui desfazer. Nada mudou." };
  }
  return { ok: true, message: `Desfeito. ${result.message}` };
}
