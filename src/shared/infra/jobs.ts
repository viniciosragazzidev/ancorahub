import "server-only";

export const jobNames = {
  slaSweep: "leads/sla.sweep",
  whatsappMessage: "whatsapp/message.send",
  quotePdf: "quotes/pdf.generate",
  integrityLossRate: "integrity/loss-rate.calculate",
  leadReengagement: "leads/reengagement.run",
} as const;

export type JobName = (typeof jobNames)[keyof typeof jobNames];

export type JobEnvelope<TPayload> = {
  name: JobName;
  id: string;
  occurredAt: string;
  tenantId?: string;
  userId?: string;
  payload: TPayload;
};

/**
 * Provider-neutral contract used by domain code before the Inngest adapter is
 * installed. The adapter must preserve the envelope and idempotency key.
 */
export type JobPublisher = {
  publish<TPayload>(job: JobEnvelope<TPayload>): Promise<{ accepted: boolean; id: string }>;
};
