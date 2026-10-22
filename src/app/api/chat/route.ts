import { NextResponse } from "next/server";
import { streamText } from "ai";
import { getAiEngineSettings } from "@/features/ai/engine";
import { getAiModelInstance } from "@/features/ai/providers";
import { answerIfOperatorQuestion, lastUserText } from "@/features/operator-catalog/answer";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export async function POST(req: Request) {
  try {
    // Only signed-in users: this route calls a paid model.
    const context = await getRequiredTenantContext().catch(() => null);
    if (!context) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    const { messages } = await req.json();

    // Operators, plans, prices, carências: only the imported material answers, never the free model.
    const operatorAnswer = await answerIfOperatorQuestion({ tenantId: context.tenantId, userId: context.userId, question: lastUserText(messages) }).catch(() => null);
    if (operatorAnswer) return new Response(operatorAnswer, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    const settings = await getAiEngineSettings();

    if (!settings.enabled) {
      return NextResponse.json(
        { error: "O motor de Inteligência Artificial está desativado pelo administrador." },
        { status: 403 }
      );
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
      system: settings.systemPrompt,
      messages,
      temperature: settings.temperature,
      maxOutputTokens: settings.maxTokens,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("[AI Chat Route Error]:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno no servidor." },
      { status: 500 }
    );
  }
}
