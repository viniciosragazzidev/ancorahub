import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { defaultModels, type AiProvider } from "./types";

/** Adds OpenRouter's provider.data_collection = "deny" to every JSON request body (same rule as the gateway's raw calls in ai-gateway/gateway.ts). */
async function withNoDataCollection(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.body && typeof init.body === "string") {
    try {
      const body = JSON.parse(init.body) as Record<string, unknown>;
      body.provider = { ...(body.provider as Record<string, unknown> | undefined), data_collection: "deny" };
      return fetch(input, { ...init, body: JSON.stringify(body) });
    } catch { /* not JSON: send as is */ }
  }
  return fetch(input, init);
}

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
        // LGPD: paid models only through providers that neither keep nor train on the data.
        fetch: selectedModel.endsWith(":free") ? undefined : withNoDataCollection,
      });
      // Chat Completions (OpenRouter's native API): the default Responses path took ~90 s per
      // structured analysis with Claude Haiku against ~5 s here (measured 2026-10-12).
      return openrouter.chat(selectedModel);
    }
    default: {
      throw new Error(`AI Provider "${provider}" não é suportado.`);
    }
  }
}
