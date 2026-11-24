import { NextResponse } from "next/server";
import { createAgentUIStreamResponse, type UIMessage } from "ai";

import { canUseDirectorAgent } from "@/features/agent/access";
import { createDirectorAgent } from "@/features/agent/agent";
import { createServerAgentBackend } from "@/features/agent/backend-server";
import { isAgentDirectorWritesEnabled, resolveAgentDirectorModel } from "@/features/agent/settings";
import { logAiUsage } from "@/features/ai-agent/ai-usage-log";
import { readChatRequest } from "@/features/ai/chat-request-guard";
import { isOutsideManagerScope } from "@/features/manager-scope/manager-routes";
import { getUserDisplayInfo } from "@/shared/auth/actions";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

/**
 * Gaveta "Agente IA" do diretor (plano: docs/implementations/active/2026-11-21-agente-diretor.md, fase 0).
 * ai@7: ToolLoopAgent + aprovação por ferramenta + fluxo de mensagens de UI (passos aparecem na gaveta).
 * Tenant, usuário e papel só da sessão; o modelo nunca escolhe empresa nem pessoa fora das ferramentas.
 */
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const context = await getRequiredTenantContext();
    // Gestor sem o Agente IA desde 10/11; o agente novo nasce só para o diretor (plano §3.4).
    // Diretor, com o Agente IA liberado no cargo (se tiver) e ligado na ficha dele em Equipe (24/11).
    if (isOutsideManagerScope(context.role, context.jobTitle) || !(await canUseDirectorAgent(context))) {
      return NextResponse.json({ error: context.role === "director" ? "O Agente IA está desligado para você. Peça ao diretor para ligar em Equipe." : "O Agente IA está disponível só para o diretor." }, { status: 403 });
    }
    const guard = await readChatRequest(req, context);
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status, headers: guard.retryAfterSeconds ? { "Retry-After": String(guard.retryAfterSeconds) } : undefined });
    }
    const messages = guard.messages as UIMessage[];

    const [resolved, writesEnabled, userInfo] = await Promise.all([
      resolveAgentDirectorModel((failed, error) => {
        // Sem a chave nem o conteúdo: só qual modelo caiu e o status (ex.: 401 de chave revogada).
        const status = (error as { statusCode?: number } | null)?.statusCode;
        console.warn("[agent-director] modelo falhou, tentando o próximo", { model: failed, status, message: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
      }),
      isAgentDirectorWritesEnabled(context.tenantId),
      getUserDisplayInfo().catch(() => null),
    ]);
    if (!resolved) return NextResponse.json({ error: "O motor de IA está desligado pelo Super-admin." }, { status: 403 });

    const startedAt = Date.now();
    const agent = createDirectorAgent({
      model: resolved.model,
      backend: createServerAgentBackend(context),
      viewer: { role: context.role, viewAs: Boolean(context.viewAs), writesEnabled },
      firstName: userInfo?.name?.trim().split(/\s+/)[0] ?? null,
      messages,
      onUsage: (usage) => {
        void logAiUsage({
          tenantId: context.tenantId,
          purpose: "agent_director",
          model: resolved.label,
          startedAt,
          usage: { prompt_tokens: usage.inputTokens, completion_tokens: usage.outputTokens, total_tokens: usage.totalTokens },
          success: true,
        });
      },
    });

    return createAgentUIStreamResponse({
      agent,
      uiMessages: messages,
      abortSignal: req.signal,
      // Nunca ecoa erro de provedor ou banco para o navegador; o log do servidor guarda a causa.
      onError: (error) => {
        const status = (error as { statusCode?: number } | null)?.statusCode;
        console.error("[agent-director] erro no fluxo", { models: resolved.label, status, message: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
        return status === 401 || status === 403
          ? "A chave do provedor de IA foi recusada. Atualize a chave em Super-admin › IA. Nada foi alterado."
          : "Não consegui responder agora. Nada foi alterado. Tente de novo.";
      },
    });
  } catch (error) {
    console.error("[Agent Drawer Chat Error]:", error instanceof Error ? error.message.slice(0, 200) : "unknown");
    return NextResponse.json({ error: "Não foi possível responder agora. Tente novamente." }, { status: 500 });
  }
}
