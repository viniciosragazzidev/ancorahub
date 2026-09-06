import "server-only";

import { getMetaCloudServerConfig } from "./meta-cloud-config";
import { formatE164Phone, MetaCloudApiError } from "./meta-cloud-client";

export type MetaTemplateHeaderType = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";
export type MetaTemplateCategory = "UTILITY" | "MARKETING" | "AUTHENTICATION";
export type MetaTemplateStatus = "APPROVED" | "PENDING" | "REJECTED" | "PAUSED" | "DISABLED" | "ARCHIVED";

export type MetaGraphTemplateComponent = {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: MetaTemplateHeaderType;
  text?: string;
  example?: {
    header_text?: string[];
    header_handle?: string[];
    body_text?: string[][];
  };
  buttons?: Array<{
    type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "FLOW";
    text: string;
    url?: string;
    phone_number?: string;
    example?: string[];
  }>;
};

export type MetaGraphTemplateItem = {
  id: string;
  name: string;
  language: string;
  status: MetaTemplateStatus | string;
  category: MetaTemplateCategory | string;
  components?: MetaGraphTemplateComponent[];
  rejected_reason?: string;
  quality_score?: { score?: string };
};

async function graphRequest<T>(path: string, init: RequestInit, accessToken: string): Promise<T> {
  const config = getMetaCloudServerConfig();
  const response = await fetch(`https://graph.facebook.com/${config.graphVersion}/${path.replace(/^\//, "")}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: { message?: string; code?: number } };
  if (!response.ok) {
    throw new MetaCloudApiError(payload.error?.message ?? "A Meta recusou a operação de template.", response.status, payload.error?.code);
  }
  return payload;
}

export async function fetchWabaMessageTemplates(
  wabaId: string,
  accessToken: string,
  limit = 100,
): Promise<{ data: MetaGraphTemplateItem[]; paging?: { cursors?: { after?: string } } }> {
  return graphRequest<{ data: MetaGraphTemplateItem[]; paging?: { cursors?: { after?: string } } }>(
    `${encodeURIComponent(wabaId)}/message_templates?fields=id,name,language,status,category,components,rejected_reason,quality_score&limit=${limit}`,
    { method: "GET" },
    accessToken,
  );
}

export async function createWabaMessageTemplate(
  wabaId: string,
  accessToken: string,
  input: {
    name: string;
    language: string;
    category: MetaTemplateCategory;
    components: MetaGraphTemplateComponent[];
  },
) {
  return graphRequest<{ id?: string; status?: string; category?: string }>(
    `${encodeURIComponent(wabaId)}/message_templates`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    accessToken,
  );
}

export async function deleteWabaMessageTemplate(
  wabaId: string,
  accessToken: string,
  input: { name: string; metaTemplateId?: string | null },
) {
  const params = new URLSearchParams({ name: input.name });
  if (input.metaTemplateId) params.set("hsm_id", input.metaTemplateId);
  return graphRequest<{ success?: boolean }>(
    `${encodeURIComponent(wabaId)}/message_templates?${params.toString()}`,
    { method: "DELETE" },
    accessToken,
  );
}

export async function sendMetaCloudTemplateTest(
  phoneNumberId: string,
  accessToken: string,
  destinationPhone: string,
  templateName: string,
  language: string,
  components?: any[],
): Promise<{ messages?: Array<{ id: string }> }> {
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: formatE164Phone(destinationPhone),
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      ...(components && components.length > 0 ? { components } : {}),
    },
  };

  return graphRequest<{ messages?: Array<{ id: string }> }>(
    `${encodeURIComponent(phoneNumberId)}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    accessToken,
  );
}
