import "server-only";

import { randomUUID } from "node:crypto";
import { encryptChannelSecret, decryptChannelSecret } from "@/features/communication-channels/secret-crypto";

const DEFAULT_KEY_BASE64 = "4q3b+X8zK+J9l0M1N2O3P4Q5R6S7T8U9V0W1X2Y3Z44="; // 32-byte fallback key for dev

function getEncryptionKey(): string {
  return process.env.META_WHATSAPP_TOKEN_ENCRYPTION_KEY || process.env.META_TOKEN_ENCRYPTION_KEY || DEFAULT_KEY_BASE64;
}

export function encryptMetaToken(rawToken: string): string {
  return encryptChannelSecret(rawToken, getEncryptionKey());
}

export function decryptMetaToken(ciphertext: string): string {
  return decryptChannelSecret(ciphertext, getEncryptionKey());
}

export async function exchangeCodeForLongLivedToken(authCode: string, redirectUri: string): Promise<{
  accessToken: string;
  expiresIn: number;
  tokenType: string;
}> {
  // Se o código informado já for um User Access Token ou System User Token da Meta
  if (authCode.startsWith("EAA") || authCode.startsWith("EAAB") || authCode.length > 50) {
    return {
      accessToken: authCode,
      expiresIn: 5184000,
      tokenType: "bearer",
    };
  }

  const appId = process.env.META_APP_ID || process.env.META_WHATSAPP_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID || "780859815090303";
  const appSecret = process.env.META_APP_SECRET || process.env.META_WHATSAPP_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error("As variáveis de ambiente META_APP_ID e META_APP_SECRET não estão configuradas no servidor.");
  }

  // 1. Exchange auth code for short-lived token
  const tokenUrl = new URL("https://graph.facebook.com/v20.0/oauth/access_token");
  tokenUrl.searchParams.append("client_id", appId);
  tokenUrl.searchParams.append("client_secret", appSecret);
  tokenUrl.searchParams.append("redirect_uri", redirectUri);
  tokenUrl.searchParams.append("code", authCode);

  const res = await fetch(tokenUrl.toString(), { method: "GET" });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(`Falha ao trocar código da Meta: ${errorData?.error?.message || res.statusText}`);
  }
  const data = await res.json();
  const shortLivedToken = data.access_token;

  // 2. Exchange short-lived token for long-lived user token
  const exchangeUrl = new URL("https://graph.facebook.com/v20.0/oauth/access_token");
  exchangeUrl.searchParams.append("grant_type", "fb_exchange_token");
  exchangeUrl.searchParams.append("client_id", appId);
  exchangeUrl.searchParams.append("client_secret", appSecret);
  exchangeUrl.searchParams.append("fb_exchange_token", shortLivedToken);

  const exchangeRes = await fetch(exchangeUrl.toString(), { method: "GET" });
  if (!exchangeRes.ok) {
    // Return short lived token if long lived exchange fails
    return {
      accessToken: shortLivedToken,
      expiresIn: data.expires_in || 7200,
      tokenType: data.token_type || "bearer",
    };
  }

  const exchangeData = await exchangeRes.json();
  return {
    accessToken: exchangeData.access_token || shortLivedToken,
    expiresIn: exchangeData.expires_in || 5184000,
    tokenType: exchangeData.token_type || "bearer",
  };
}
