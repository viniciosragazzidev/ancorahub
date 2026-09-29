export const META_CLOUD_PROVIDER = "meta_cloud" as const;

export type MetaEmbeddedSignupPayload = {
  code: string;
  businessId?: string;
  wabaId?: string;
  phoneNumberId?: string;
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
  audio?: { id?: string; mime_type?: string } | unknown;
  image?: { id?: string; mime_type?: string; sha256?: string } | unknown;
  document?: { id?: string; mime_type?: string; filename?: string; sha256?: string } | unknown;
  video?: { id?: string; mime_type?: string; sha256?: string } | unknown;
  sticker?: { id?: string; mime_type?: string } | unknown;
};

export type MetaWebhookStatus = {
  id: string;
  status: string;
  errors?: Array<{
    code?: number;
    title?: string;
    message?: string;
  }>;
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
