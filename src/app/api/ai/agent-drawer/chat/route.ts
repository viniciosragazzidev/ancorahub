import { NextResponse } from "next/server";
import { streamText, tool } from "ai";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getAiEngineSettings } from "@/features/ai/engine";
import { getAiModelInstance } from "@/features/ai/providers";
import { getMcpToolsForRole } from "@/features/agent-drawer/mcp-tools";
import { buildAgentSystemPrompt } from "@/features/agent-drawer/prompt-builder";
import { getUserDisplayInfo } from "@/shared/auth/actions";

export async function POST(req: Request) {
  try {
    const context = await getRequiredTenantContext();
    const { messages } = await req.json();

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

    // Convert MCP tools to Vercel AI SDK tool format
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
      { error: error instanceof Error ? error.message : "Erro interno no servidor do Agente." },
      { status: 500 }
    );
  }
}
