import "server-only";

export const META_WHATSAPP_FEATURE_SETTING = "feature_whatsapp_meta_cloud_enabled";

const graphVersionPattern = /^v\d+\.\d+$/;

export type MetaCloudConfigurationState = {
  configured: boolean;
  missing: string[];
  appId: string | null;
  embeddedSignupConfigId: string | null;
};

type MetaCloudServerConfig = {
  appId: string;
  appSecret: string;
  webhookVerifyToken: string;
  tokenEncryptionKey: string;
  graphVersion: string;
  redirectUri?: string;
};

function requiredEnvironment(): Array<[keyof NodeJS.ProcessEnv, string]> {
  return [
    ["META_WHATSAPP_APP_ID", "META_WHATSAPP_APP_ID"],
    ["META_WHATSAPP_APP_SECRET", "META_WHATSAPP_APP_SECRET"],
    ["META_WHATSAPP_WEBHOOK_VERIFY_TOKEN", "META_WHATSAPP_WEBHOOK_VERIFY_TOKEN"],
    ["META_WHATSAPP_TOKEN_ENCRYPTION_KEY", "META_WHATSAPP_TOKEN_ENCRYPTION_KEY"],
  ];
}

export function getMetaCloudConfigurationState(options?: { includeEmbeddedSignup?: boolean }): MetaCloudConfigurationState {
  const missing = requiredEnvironment().filter(([key]) => !process.env[key]?.trim()).map(([, label]) => label);
  const appId = process.env.NEXT_PUBLIC_META_WHATSAPP_APP_ID?.trim() || process.env.META_WHATSAPP_APP_ID?.trim() || null;
  const embeddedSignupConfigId = process.env.NEXT_PUBLIC_META_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID?.trim() || null;
  if (options?.includeEmbeddedSignup !== false && !embeddedSignupConfigId) missing.push("NEXT_PUBLIC_META_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID");
  return { configured: missing.length === 0, missing, appId, embeddedSignupConfigId };
}

export function getMetaCloudServerConfig(): MetaCloudServerConfig {
  const state = getMetaCloudConfigurationState();
  const missingServerOnly = state.missing.filter((key) => key !== "NEXT_PUBLIC_META_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID");
  if (missingServerOnly.length) throw new Error(`Configuração da Meta incompleta: ${missingServerOnly.join(", ")}.`);
  const graphVersion = process.env.META_WHATSAPP_GRAPH_API_VERSION?.trim() || "v23.0";
  if (!graphVersionPattern.test(graphVersion)) throw new Error("META_WHATSAPP_GRAPH_API_VERSION inválida.");
  return {
    appId: process.env.META_WHATSAPP_APP_ID!.trim(),
    appSecret: process.env.META_WHATSAPP_APP_SECRET!.trim(),
    webhookVerifyToken: process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN!.trim(),
    tokenEncryptionKey: process.env.META_WHATSAPP_TOKEN_ENCRYPTION_KEY!.trim(),
    graphVersion,
    redirectUri: process.env.META_WHATSAPP_REDIRECT_URI?.trim() || undefined,
  };
}
