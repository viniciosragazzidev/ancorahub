import { NextResponse } from "next/server";
import { streamText } from "ai";
import { getAiEngineSettings } from "@/features/ai/engine";
import { getAiModelInstance } from "@/features/ai/providers";

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
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
