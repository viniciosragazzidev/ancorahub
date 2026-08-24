import "server-only";

import { getMetaCloudServerConfig } from "./meta-cloud-config";
import { getMetaLeadAdsServerConfig } from "./meta-cloud-config";

type MetaApiErrorResponse = { error?: { message?: string; code?: number; error_subcode?: number } };

const DEFAULT_META_GRAPH_TIMEOUT_MS = 8_000;

function getMetaGraphTimeoutMs() {
  const configured = Number(process.env.META_GRAPH_TIMEOUT_MS ?? DEFAULT_META_GRAPH_TIMEOUT_MS);
  return Number.isFinite(configured) && configured >= 1_000 && configured <= 20_000
    ? configured
    : DEFAULT_META_GRAPH_TIMEOUT_MS;
}

export class MetaCloudApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: number) { super(message); }
}

async function graphRequest<T>(path: string, init: RequestInit, accessToken?: string): Promise<T> {
  const config = getMetaCloudServerConfig();
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), getMetaGraphTimeoutMs());
  let response: Response;
  try {
    response = await fetch(`https://graph.facebook.com/${config.graphVersion}/${path.replace(/^\//, "")}`, {
      ...init,
      headers: { Accept: "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...init.headers },
      cache: "no-store",
      signal: timeoutController.signal,
    });
  } catch (error) {
    if (timeoutController.signal.aborted) {
      throw new MetaCloudApiError("A Meta não respondeu a tempo; o envio será tentado novamente.", 504, 408);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
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

/** Completes the backend portion of Embedded Signup; phone ownership stays in Meta's flow. */
export async function registerMetaPhoneNumber(phoneNumberId: string, accessToken: string, pin: string) {
  return graphRequest<{ success?: boolean }>(`${encodeURIComponent(phoneNumberId)}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", pin }),
  }, accessToken);
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

/**
 * Validates one Page explicitly named by the authenticated tenant. Never use
 * collection endpoints here: a shared technical credential can see assets
 * belonging to several customer businesses.
 */
export async function discoverMetaLeadAdsAssets(pageId: string): Promise<MetaLeadAdsAssets> {
  try {
    const page = await leadAdsRequest<MetaAsset>(`${encodeURIComponent(pageId)}?fields=id,name`);
    if (page.id !== pageId) return { pages: [], adAccounts: [], pixels: [], datasets: [] };
    return { pages: [{ id: page.id, name: page.name }], adAccounts: [], pixels: [], datasets: [] };
  } catch (error) {
    if (error instanceof MetaCloudApiError && [400, 403, 404].includes(error.status)) {
      return { pages: [], adAccounts: [], pixels: [], datasets: [] };
    }
    throw error;
  }
}

/**
 * Exchanges a tenant's user token for the token of one explicitly selected
 * Page. Page credentials never cross the Server Action boundary.
 */
export async function resolvePageAccessToken(pageId: string, userAccessToken: string) {
  const graphVersion = process.env.META_GRAPH_API_VERSION?.trim() || "v25.0";
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/me/accounts?fields=id,access_token&limit=100`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${userAccessToken}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as { data?: Array<{ id?: string; access_token?: string }> } & MetaApiErrorResponse;
  const page = payload.data?.find((candidate) => candidate.id === pageId);
  if (!response.ok || !page?.access_token) {
    throw new MetaCloudApiError(
      payload.error?.message ?? "A Meta não devolveu um token para a Página selecionada. Confirme que o usuário possui acesso à Página e reconecte.",
      response.status,
      payload.error?.code,
    );
  }
  return page.access_token;
}

type PageSubscriptionResponse = {
  data?: Array<{ id?: string; subscribed_fields?: string[] }>;
} & MetaApiErrorResponse;

function getMetaLeadAdsAppId() {
  return process.env.META_LEAD_ADS_APP_ID?.trim()
    || process.env.META_APP_ID?.trim()
    || process.env.NEXT_PUBLIC_META_LEAD_ADS_APP_ID?.trim()
    || "780859815090303";
}

async function fetchPageLeadgenSubscription(pageId: string, graphVersion: string, accessToken: string) {
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(pageId)}/subscribed_apps?fields=id,subscribed_fields`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as PageSubscriptionResponse;
  if (!response.ok) {
    throw new MetaCloudApiError(payload.error?.message ?? "Meta did not allow checking the Page subscription.", response.status, payload.error?.code);
  }
  return payload.data?.some((app) => app.id === getMetaLeadAdsAppId() && app.subscribed_fields?.includes("leadgen")) ?? false;
}

/** Reads the delivery precondition without changing Meta state. */
export async function verifyPageLeadgenSubscription(pageId: string, pageAccessToken?: string) {
  const config = pageAccessToken
    ? { graphVersion: process.env.META_GRAPH_API_VERSION?.trim() || "v25.0", accessToken: pageAccessToken }
    : getMetaLeadAdsServerConfig();
  return fetchPageLeadgenSubscription(pageId, config.graphVersion, config.accessToken);
}

/** Subscribes the platform app to Lead Ads events for an already-authorized Page. */
export async function subscribePageToLeadgen(pageId: string, pageAccessToken?: string) {
  const config = pageAccessToken
    ? { graphVersion: process.env.META_GRAPH_API_VERSION?.trim() || "v25.0", accessToken: pageAccessToken }
    : getMetaLeadAdsServerConfig();

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

  const subscribeWithToken = async (token: string) => {
    const { response, payload } = await postSubscription(token);
    if (!response.ok || !payload.success) {
      throw new MetaCloudApiError(payload.error?.message ?? "Meta rejected the Page subscription for forms.", response.status, payload.error?.code);
    }
    const verified = await fetchPageLeadgenSubscription(pageId, config.graphVersion, token);
    if (!verified) {
      throw new MetaCloudApiError("Meta accepted the request, but the Page leadgen subscription was not confirmed. The source was not activated.", 502, 210);
    }
    return { ...payload, verified: true };
  };

  if (pageAccessToken) return subscribeWithToken(pageAccessToken);

  try {
    return await subscribeWithToken(config.accessToken);
  } catch (error) {
    const canResolvePageToken = error instanceof MetaCloudApiError && (error.code === 210 || (error.status === 403 && error.code !== 10));
    if (!canResolvePageToken) throw error;

    const pageRes = await fetch(`https://graph.facebook.com/${config.graphVersion}/${encodeURIComponent(pageId)}?fields=access_token`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${config.accessToken}` },
      cache: "no-store",
    });
    const pagePayload = await pageRes.json().catch(() => ({})) as { access_token?: string } & MetaApiErrorResponse;
    if (!pageRes.ok || !pagePayload.access_token) {
      throw new MetaCloudApiError(pagePayload.error?.message ?? "Meta did not return a Page token to confirm the subscription.", pageRes.status, pagePayload.error?.code);
    }
    return subscribeWithToken(pagePayload.access_token);
  }


}

/**
 * Formats phone numbers for Meta WhatsApp Business Cloud API.
 * 
 * Rules for Brazil (country code 55):
 * Meta's WhatsApp Cloud API directory registers Brazilian mobile numbers according to area code (DDD):
 * - DDDs 11 to 28: Requires 13 digits (55 + DDD + 9 + 8 digits).
 *   If a 12-digit number is provided (55 + DDD + 8 digits), insert the 9th digit '9'.
 * - DDDs 31 to 99 (e.g., DDD 41 PR): Meta Cloud API expects 12 digits (55 + DDD + 8 digits).
 *   If a 13-digit number is provided (55 + DDD + 9 + 8 digits), remove the 9th digit '9'.
 */
export function formatE164Phone(phone: string) {
  const trimmed = phone.trim();
  let digits = phone.replace(/\D/g, "");
  if (!digits) return "";

  if (trimmed.startsWith("+") && !trimmed.startsWith("+55")) {
    return digits;
  }

  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith("55")) {
    const ddd = parseInt(digits.slice(0, 2), 10);
    const thirdDigit = digits[2];
    if (ddd >= 11 && ddd <= 99 && (digits.length === 10 || thirdDigit === "9")) {
      digits = `55${digits}`;
    }
  }

  if (digits.startsWith("55")) {
    if (digits.length === 13) {
      const ddd = parseInt(digits.slice(2, 4), 10);
      const fifthDigit = digits[4];
      if (ddd >= 31 && fifthDigit === "9") {
        return `${digits.slice(0, 4)}${digits.slice(5)}`;
      }
    } else if (digits.length === 12) {
      const ddd = parseInt(digits.slice(2, 4), 10);
      if (ddd >= 11 && ddd <= 28) {
        return `${digits.slice(0, 4)}9${digits.slice(4)}`;
      }
    }
  }

  return digits;
}

export async function sendMetaCloudText(input: { phoneNumberId: string; accessToken: string; to: string; body: string }) {
  return graphRequest<{ messages?: Array<{ id: string }> }>(`${encodeURIComponent(input.phoneNumberId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: formatE164Phone(input.to), type: "text", text: { preview_url: false, body: input.body } }),
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
    to: formatE164Phone(input.to),
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
