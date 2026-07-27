export const META_CLOUD_PROVIDER = "meta_cloud" as const;

export type MetaEmbeddedSignupPayload = {
  code: string;
  businessId: string;
  wabaId: string;
  phoneNumberId: string;
  branchId?: string;
};

export type MetaWebhookMessage = {
  id: string;
  from: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string; payload?: string };
  interactive?: {
    type?: string;
    button_reply?: { id?: string; title?: string };
  };
  context?: { id?: string };
};

export type MetaWebhookStatus = {
  id: string;
  status: string;
};

export type MetaWebhookChange = {
  field?: string;
  value?: {
    metadata?: { phone_number_id?: string; display_phone_number?: string };
    messages?: MetaWebhookMessage[];
    statuses?: MetaWebhookStatus[];
  };
};

export type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{ id?: string; changes?: MetaWebhookChange[] }>;
};
