export type AiProvider = "groq" | "openai" | "google" | "openrouter";

export type AiSettings = {
  enabled: boolean;
  primaryProvider: AiProvider;
  primaryModel: string;
  fallbackProvider: AiProvider | "none";
  fallbackModel: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  groqApiKey?: string;
  openaiApiKey?: string;
  googleApiKey?: string;
  openrouterApiKey?: string;
};

export const defaultModels: Record<AiProvider, string> = {
  groq: "llama-3.3-70b-versatile",
  openai: "gpt-4o-mini",
  google: "gemini-2.0-flash",
  openrouter: "meta-llama/llama-3.3-70b-instruct:free",
};

export type AiCompletionRequest = {
  userMessage: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
};
