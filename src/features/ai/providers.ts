import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { defaultModels, type AiProvider } from "./types";

export function getAiModelInstance(
  provider: AiProvider,
  modelName?: string,
  keys?: { groqKey?: string; openaiKey?: string; googleKey?: string; openrouterKey?: string }
) {
  const selectedModel = modelName?.trim() || defaultModels[provider];

  switch (provider) {
    case "groq": {
      const apiKey = keys?.groqKey || process.env.GROQ_API_KEY || "";
      const groq = createOpenAI({
        baseURL: "https://api.groq.com/openai/v1",
        apiKey,
      });
      return groq(selectedModel);
    }
    case "openai": {
      const apiKey = keys?.openaiKey || process.env.OPENAI_API_KEY || "";
      const openai = createOpenAI({
        apiKey,
      });
      return openai(selectedModel);
    }
    case "google": {
      const apiKey = keys?.googleKey || process.env.GOOGLE_API_KEY || "";
      const google = createGoogleGenerativeAI({
        apiKey,
      });
      return google(selectedModel);
    }
    case "openrouter": {
      const apiKey = keys?.openrouterKey || process.env.OPENROUTER_API_KEY || "";
      const openrouter = createOpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey,
      });
      return openrouter(selectedModel);
    }
    default: {
      throw new Error(`AI Provider "${provider}" não é suportado.`);
    }
  }
}
