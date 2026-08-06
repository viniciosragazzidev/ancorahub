import "server-only";

import { getMetaCloudServerConfig } from "./meta-cloud-config";
import { getMetaLeadAdsServerConfig } from "./meta-cloud-config";

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

export async function getMetaBusiness(businessId: string, accessToken: string) {
  return graphRequest<{ id: string; name?: string }>(`${encodeURIComponent(businessId)}?fields=id,name`, { method: "GET" }, accessToken);
}

/** Checks optional marketing identifiers without returning campaign or audience data. */
export async function validateMetaMarketingResource(resourceId: string, accessToken: string) {
  return graphRequest<{ id: string; name?: string }>(`${encodeURIComponent(resourceId)}?fields=id,name`, { method: "GET" }, accessToken);
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

type MetaAsset = { id: string; name?: string };
export type MetaLeadAdsAssets = { pages: MetaAsset[]; adAccounts: MetaAsset[]; pixels: MetaAsset[]; datasets: MetaAsset[] };

async function leadAdsRequest<T>(path: string): Promise<T> {
  const config = getMetaLeadAdsServerConfig();
  const response = await fetch(`https://graph.facebook.com/${config.graphVersion}/${path.replace(/^\//, "")}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${config.accessToken}` }, cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as T & MetaApiErrorResponse;
  if (!response.ok) throw new MetaCloudApiError(payload.error?.message ?? "A Meta recusou a busca dos ativos.", response.status, payload.error?.code);
  return payload;
}

/** Returns only non-sensitive asset labels and IDs authorized for the platform credential. */
export async function discoverMetaLeadAdsAssets(): Promise<MetaLeadAdsAssets> {
  const list = async (path: string) => {
    try {
      return (await leadAdsRequest<{ data?: MetaAsset[] }>(path)).data ?? [];
    } catch (error) {
      if (error instanceof MetaCloudApiError && [400, 403].includes(error.status)) return [];
      throw error;
    }
  };
  const [pages, adAccounts, pixels, datasets] = await Promise.all([
    list("me/accounts?fields=id,name&limit=100"),
    list("me/adaccounts?fields=id,name&limit=100"),
    list("me/adspixels?fields=id,name&limit=100"),
    list("me/datasets?fields=id,name&limit=100"),
  ]);
  return { pages, adAccounts, pixels, datasets };
}

/** Subscribes the platform app to Lead Ads events for an already-authorized Page. */
export async function subscribePageToLeadgen(pageId: string) {
  const config = getMetaLeadAdsServerConfig();

  const postSubscription = async (token: string) => {
    const response = await fetch(`https://graph.facebook.com/${config.graphVersion}/${encodeURIComponent(pageId)}/subscribed_apps`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "subscribed_fields=leadgen",
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({})) as { success?: boolean } & MetaApiErrorResponse;
    return { response, payload };
  };

  let { response, payload } = await postSubscription(config.accessToken);

  if (!response.ok || !payload.success) {
    const errorCode = payload.error?.code;
    if (errorCode === 210 || response.status === 403) {
      try {
        const pagesRes = await fetch(`https://graph.facebook.com/${config.graphVersion}/me/accounts?fields=id,access_token&limit=100`, {
          headers: { Accept: "application/json", Authorization: `Bearer ${config.accessToken}` },
          cache: "no-store",
        });
        if (pagesRes.ok) {
          const pagesPayload = await pagesRes.json().catch(() => ({})) as { data?: Array<{ id: string; access_token?: string }> };
          const matched = pagesPayload.data?.find((p) => p.id === pageId);
          if (matched?.access_token) {
            const retryResult = await postSubscription(matched.access_token);
            response = retryResult.response;
            payload = retryResult.payload;
          }
        }
      } catch {
        // Ignora erros no retry
      }

      if (!response.ok || !payload.success) {
        if (payload.error?.code === 210 || (response.status === 403 && payload.error?.code !== 10)) {
          return { success: true, warning: payload.error?.message };
        }
      }
    }
  }

  if (!response.ok || !payload.success) {
    throw new MetaCloudApiError(payload.error?.message ?? "A Meta recusou a inscrição da Página para receber formulários.", response.status, payload.error?.code);
  }
  return payload;
}

export async function sendMetaCloudText(input: { phoneNumberId: string; accessToken: string; to: string; body: string }) {
  return graphRequest<{ messages?: Array<{ id: string }> }>(`${encodeURIComponent(input.phoneNumberId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: input.to.replace(/\D/g, ""), type: "text", text: { preview_url: false, body: input.body } }),
  }, input.accessToken);
}

type MetaCloudTemplateInput = {
  to: string;
  templateName: string;
  languageCode: string;
  variables: string[];
  variableNames?: string[];
  urlButtonParameter?: string;
};

export function buildMetaCloudTemplatePayload(input: MetaCloudTemplateInput) {
  if (input.variableNames && input.variableNames.length !== input.variables.length) {
    throw new Error("A quantidade de variáveis nomeadas não corresponde ao template Meta.");
  }
  const parameters = input.variables.map((text, index) => ({
    type: "text" as const,
    text,
    ...(input.variableNames ? { parameter_name: input.variableNames[index] } : {}),
  }));
  return {
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
  };
}

export async function sendMetaCloudTemplate(input: MetaCloudTemplateInput & { phoneNumberId: string; accessToken: string }) {
  const payload = buildMetaCloudTemplatePayload(input);
  return graphRequest<{ messages?: Array<{ id: string }> }>(`${encodeURIComponent(input.phoneNumberId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }, input.accessToken);
}
