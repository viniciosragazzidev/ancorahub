import "server-only";

import { encryptChannelSecret, decryptChannelSecret } from "@/features/communication-channels/secret-crypto";

const DEFAULT_KEY_BASE64 = "4q3b+X8zK+J9l0M1N2O3P4Q5R6S7T8U9V0W1X2Y3Z44=";

function getEncryptionKey(): string {
  const configured = process.env.META_LEAD_ADS_TOKEN_ENCRYPTION_KEY || process.env.META_TOKEN_ENCRYPTION_KEY;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("META_LEAD_ADS_TOKEN_ENCRYPTION_KEY must be configured in production.");
  }
  return DEFAULT_KEY_BASE64;
}

export function encryptMetaToken(rawToken: string): string {
  return encryptChannelSecret(rawToken, getEncryptionKey());
}

export function decryptMetaToken(ciphertext: string): string {
  return decryptChannelSecret(ciphertext, getEncryptionKey());
}

/** Exchanges only an OAuth authorization code. Browser-supplied access tokens are never accepted. */
export async function exchangeCodeForLongLivedToken(authCode: string, redirectUri: string): Promise<{
  accessToken: string;
  expiresIn: number;
  tokenType: string;
}> {
  const appId = process.env.META_LEAD_ADS_APP_ID || process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_LEAD_ADS_APP_ID || "780859815090303";
  const appSecret = process.env.META_LEAD_ADS_APP_SECRET || process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error("META_LEAD_ADS_APP_ID and META_LEAD_ADS_APP_SECRET must be configured on the server.");
  }

  const tokenUrl = new URL("https://graph.facebook.com/v25.0/oauth/access_token");
  tokenUrl.searchParams.append("client_id", appId);
  tokenUrl.searchParams.append("client_secret", appSecret);
  tokenUrl.searchParams.append("redirect_uri", redirectUri);
  tokenUrl.searchParams.append("code", authCode);

  const res = await fetch(tokenUrl.toString(), { method: "GET", cache: "no-store" });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(`Meta code exchange failed: ${errorData?.error?.message || res.statusText}`);
  }
  const data = await res.json() as { access_token?: string; expires_in?: number; token_type?: string };
  if (!data.access_token) throw new Error("Meta code exchange returned no access token.");

  const exchangeUrl = new URL("https://graph.facebook.com/v25.0/oauth/access_token");
  exchangeUrl.searchParams.append("grant_type", "fb_exchange_token");
  exchangeUrl.searchParams.append("client_id", appId);
  exchangeUrl.searchParams.append("client_secret", appSecret);
  exchangeUrl.searchParams.append("fb_exchange_token", data.access_token);

  const exchangeRes = await fetch(exchangeUrl.toString(), { method: "GET", cache: "no-store" });
  if (!exchangeRes.ok) {
    return { accessToken: data.access_token, expiresIn: data.expires_in || 7200, tokenType: data.token_type || "bearer" };
  }

  const exchangeData = await exchangeRes.json() as { access_token?: string; expires_in?: number; token_type?: string };
  return {
    accessToken: exchangeData.access_token || data.access_token,
    expiresIn: exchangeData.expires_in || data.expires_in || 5184000,
    tokenType: exchangeData.token_type || data.token_type || "bearer",
  };
}
