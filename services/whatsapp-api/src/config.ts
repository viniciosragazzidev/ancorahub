import type { WhatsAppReviewConfig } from "./integrations/whatsapp/types.js";

const graphVersionPattern = /^v\d+\.\d+$/;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Configuração obrigatória ausente: ${name}.`);
  return value;
}

export function getWhatsAppReviewConfig(): WhatsAppReviewConfig {
  const graphApiVersion = process.env.META_WHATSAPP_GRAPH_API_VERSION?.trim() || "v25.0";
  const requestTimeoutMs = Number(process.env.META_GRAPH_API_TIMEOUT_MS || 15_000);
  if (!graphVersionPattern.test(graphApiVersion)) throw new Error("META_WHATSAPP_GRAPH_API_VERSION inválida.");
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1_000 || requestTimeoutMs > 30_000) throw new Error("META_GRAPH_API_TIMEOUT_MS deve estar entre 1000 e 30000.");
  return {
    internalToken: required("WHATSAPP_API_INTERNAL_TOKEN"),
    reviewEnabled: process.env.WHATSAPP_REVIEW_ENABLED === "true",
    accessToken: required("META_WHATSAPP_REVIEW_ACCESS_TOKEN"),
    phoneNumberId: required("META_WHATSAPP_REVIEW_PHONE_NUMBER_ID"),
    graphApiVersion,
    requestTimeoutMs,
  };
}

export function getServerAddress() {
  return { host: process.env.HOST?.trim() || "0.0.0.0", port: Number(process.env.PORT || 3333) };
}
