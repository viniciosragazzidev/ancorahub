export type WhatsAppReviewConfig = {
  internalToken: string;
  reviewEnabled: boolean;
  accessToken: string;
  phoneNumberId: string;
  graphApiVersion: string;
  requestTimeoutMs: number;
};

export type SendTestMessageInput = {
  to: string;
  message: string;
};

export type MetaMessageResponse = {
  messages?: Array<{ id?: string }>;
  error?: { message?: string; code?: number; error_subcode?: number };
};

export type SendTestMessageResult = {
  messageId: string;
};
