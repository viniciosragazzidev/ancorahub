export const META_CLOUD_PROVIDER = "meta_cloud" as const;

export type MetaEmbeddedSignupPayload = {
  code: string;
  businessId?: string;
  wabaId?: string;
  phoneNumberId?: string;
  branchId?: string;
  mode?: "cloud_api" | "coexistence";
};

/** Present on the first message sent from a click-to-WhatsApp ad or post. */
export type MetaWebhookReferral = {
  source_url?: string;
  source_id?: string;
  source_type?: string;
  headline?: string;
  body?: string;
  media_type?: string;
  ctwa_clid?: string;
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
  referral?: MetaWebhookReferral;
  audio?: { id?: string; mime_type?: string } | unknown;
  image?: { id?: string; mime_type?: string; sha256?: string } | unknown;
  document?: { id?: string; mime_type?: string; filename?: string; sha256?: string } | unknown;
  video?: { id?: string; mime_type?: string; sha256?: string } | unknown;
  sticker?: { id?: string; mime_type?: string } | unknown;
  /** On an "unsupported" message: what Meta could not deliver, and why. */
  unsupported?: { type?: string };
  errors?: Array<{ code?: number; title?: string; message?: string; error_data?: { details?: string } }>;
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
    contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
    messages?: MetaWebhookMessage[];
    statuses?: MetaWebhookStatus[];
  };
};

export type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{ id?: string; changes?: MetaWebhookChange[] }>;
};
