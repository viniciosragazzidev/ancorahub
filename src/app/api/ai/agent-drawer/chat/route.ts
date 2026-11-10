import { isOutsideManagerScope } from "@/features/manager-scope/manager-routes";
import { NextResponse } from "next/server";
import { streamText, tool, type ModelMessage } from "ai";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { readChatRequest } from "@/features/ai/chat-request-guard";
import { getAiEngineSettings } from "@/features/ai/engine";
import { getAiModelInstance } from "@/features/ai/providers";
import { getMcpToolsForRole } from "@/features/agent-drawer/mcp-tools";
import { buildAgentSystemPrompt } from "@/features/agent-drawer/prompt-builder";
import { getUserDisplayInfo } from "@/shared/auth/actions";
import { answerIfOperatorQuestion, lastUserText } from "@/features/operator-catalog/answer";

export async function POST(req: Request) {
  try {
    const context = await getRequiredTenantContext();
    // Gestor sem o Agente IA desde 10/11: as ferramentas liam filas e plantões de outras unidades.
    if (isOutsideManagerScope(context.role, context.jobTitle)) return NextResponse.json({ error: "O Agente IA não está disponível para o gestor." }, { status: 403 });
    const guard = await readChatRequest(req, context);
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status, headers: guard.retryAfterSeconds ? { "Retry-After": String(guard.retryAfterSeconds) } : undefined });
    }
    const messages = guard.messages as ModelMessage[];

    // Operators, plans, prices, carências: only the imported material answers, never the free model.
    const operatorAnswer = await answerIfOperatorQuestion({ tenantId: context.tenantId, userId: context.userId, question: lastUserText(messages) }).catch(() => null);
    if (operatorAnswer) return new Response(operatorAnswer, { headers: { "Content-Type": "text/plain; charset=utf-8" } });

    const userInfo = await getUserDisplayInfo();
    const settings = await getAiEngineSettings();

    if (!settings.enabled) {
      return NextResponse.json(
        { error: "O motor de Inteligência Artificial está desativado pelo administrador." },
        { status: 403 }
      );
    }

    const systemPrompt = buildAgentSystemPrompt({
      ...context,
      userName: userInfo?.name ?? "Usuário",
    });

    const roleTools = getMcpToolsForRole(context.role);

    // Convert MCP tools to the AI SDK (`ai` package) tool format
    const mcpToolsRecord: Record<string, any> = {};
    for (const mcpTool of roleTools) {
      mcpToolsRecord[mcpTool.name] = (tool as any)({
        description: mcpTool.description,
        parameters: mcpTool.parameters,
        execute: async (input: any) => {
          try {
            return await mcpTool.execute(input, context);
          } catch (err) {
            console.error(`[MCP Tool Execution Error] ${mcpTool.name}:`, err);
            return { error: err instanceof Error ? err.message : "Erro na execução da ferramenta." };
          }
        },
      });
    }

    const keys = {
      groqKey: settings.groqApiKey,
      openaiKey: settings.openaiApiKey,
      googleKey: settings.googleApiKey,
      openrouterKey: settings.openrouterApiKey,
    };

    const model = getAiModelInstance(settings.primaryProvider, settings.primaryModel, keys);

    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      tools: mcpToolsRecord,
      temperature: settings.temperature,
      maxOutputTokens: settings.maxTokens,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("[Agent Drawer Chat Error]:", error);
    return NextResponse.json(
      // Never echo provider or database errors to the browser.
      { error: "Não foi possível responder agora. Tente novamente." },
      { status: 500 }
    );
  }
}
