import "server-only";

import { getMetaCloudServerConfig } from "./meta-cloud-config";

type MetaApiErrorResponse = { error?: { message?: string; code?: number; error_subcode?: number } };

export class MetaCloudApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: number) { super(message); }
}

async function graphRequest<T>(path: string, init: RequestInit, accessToken?: string): Promise<T> {
  const config = getMetaCloudServerConfig();
  const response = await fetch(`https://graph.facebook.com/${config.graphVersion}/${path.replace(/^\//, "")}`, {
    ...init,
    headers: { Accept: "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...init.headers },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as T & MetaApiErrorResponse;
  if (!response.ok) throw new MetaCloudApiError(payload.error?.message ?? "A Meta recusou a operação.", response.status, payload.error?.code);
  return payload;
}

export async function exchangeEmbeddedSignupCode(code: string) {
  const config = getMetaCloudServerConfig();
  const body = new URLSearchParams({ client_id: config.appId, client_secret: config.appSecret, code });
  if (config.redirectUri) body.set("redirect_uri", config.redirectUri);
  const response = await fetch(`https://graph.facebook.com/${config.graphVersion}/oauth/access_token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body, cache: "no-store" });
  const payload = await response.json().catch(() => ({})) as { access_token?: string; expires_in?: number } & MetaApiErrorResponse;
  if (!response.ok || !payload.access_token) throw new MetaCloudApiError(payload.error?.message ?? "A Meta não autorizou o canal.", response.status, payload.error?.code);
  return payload;
}

export async function getMetaWaba(wabaId: string, accessToken: string) {
  return graphRequest<{ id: string; name?: string }>(`${encodeURIComponent(wabaId)}?fields=id,name`, { method: "GET" }, accessToken);
}

export async function getMetaPhoneNumber(phoneNumberId: string, accessToken: string) {
  return graphRequest<{ id: string; display_phone_number?: string; verified_name?: string; quality_rating?: string; messaging_limit_tier?: string }>(`${encodeURIComponent(phoneNumberId)}?fields=id,display_phone_number,verified_name,quality_rating,messaging_limit_tier`, { method: "GET" }, accessToken);
}

export async function getMetaWabaPhoneNumbers(wabaId: string, accessToken: string) {
  return graphRequest<{ data?: Array<{ id: string; display_phone_number?: string; verified_name?: string; quality_rating?: string; messaging_limit_tier?: string }> }>(`${encodeURIComponent(wabaId)}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,messaging_limit_tier&limit=100`, { method: "GET" }, accessToken);
}

export async function subscribeWabaToApp(wabaId: string, accessToken: string) {
  return graphRequest<{ success?: boolean }>(`${encodeURIComponent(wabaId)}/subscribed_apps`, { method: "POST" }, accessToken);
}

export async function sendMetaCloudText(input: { phoneNumberId: string; accessToken: string; to: string; body: string }) {
  return graphRequest<{ messages?: Array<{ id: string }> }>(`${encodeURIComponent(input.phoneNumberId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: input.to.replace(/\D/g, ""), type: "text", text: { preview_url: false, body: input.body } }),
  }, input.accessToken);
}

export async function sendMetaCloudTemplate(input: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  templateName: string;
  languageCode: string;
  variables: string[];
  urlButtonParameter?: string;
}) {
  const parameters = input.variables.map((text) => ({ type: "text", text }));
  return graphRequest<{ messages?: Array<{ id: string }> }>(`${encodeURIComponent(input.phoneNumberId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.to.replace(/\D/g, ""),
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.languageCode },
        ...(parameters.length || input.urlButtonParameter ? { components: [
          ...(parameters.length ? [{ type: "body", parameters }] : []),
          ...(input.urlButtonParameter ? [{ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: input.urlButtonParameter }] }] : []),
        ] } : {}),
      },
    }),
  }, input.accessToken);
}
