import { createHash } from "node:crypto";

/**
 * Pure rules of the Conversions API for CRM (Conversion Leads): which lead
 * stages go to Meta, how each event is built and when it is too old to send.
 * The I/O lives in meta-conversion-service.ts.
 */

/** Same value as META_LEAD_ADS_SOURCE; kept here to avoid an import cycle with the webhook. */
export const META_CONVERSION_LEAD_SOURCE_CHANNEL = "meta_lead_ads";

export const META_CONVERSION_STAGES = ["lead_received", "qualified", "hot", "sale"] as const;
export type MetaConversionStage = (typeof META_CONVERSION_STAGES)[number];

/**
 * Event names shown in Events Manager. They are the funnel stages Meta learns
 * from: never rename one after events were sent, or the history splits.
 */
export const META_CONVERSION_EVENT_NAMES: Record<MetaConversionStage, string> = {
  lead_received: "Lead recebido",
  qualified: "Qualificado",
  hot: "Quente",
  sale: "Venda",
};

export const META_CONVERSION_LEAD_EVENT_SOURCE = "CorreTop";
/** Meta only accepts CRM events up to 7 days old. */
export const META_CONVERSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const META_CONVERSION_MAX_ATTEMPTS = 8;

export type MetaConversionStatus = "pending" | "sent" | "failed" | "skipped";

/** A Lead Ads leadgen id: digits only (15 to 17 today; a little slack for Meta growth). */
export function isMetaLeadgenId(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\d{10,20}$/.test(value.trim());
}

/**
 * Funnel stages reached by a qualification status. "hot" also implies
 * "qualified", so a lead that jumps straight to hot still has the full funnel.
 */
export function stagesForQualificationStatus(status: string | null | undefined): MetaConversionStage[] {
  if (status === "hot") return ["qualified", "hot"];
  if (status === "warm") return ["qualified"];
  return [];
}

/** Every stage a lead has reached by now, used by the backfill and the reconcile sweep. */
export function stagesForLeadState(lead: { qualificationStatus: string | null; status: string | null; hasSale: boolean }): MetaConversionStage[] {
  const stages: MetaConversionStage[] = ["lead_received", ...stagesForQualificationStatus(lead.qualificationStatus)];
  if (lead.hasSale || lead.status === "converted") stages.push("sale");
  return stages;
}

export function metaConversionEventId(leadId: string, stage: MetaConversionStage) {
  return `crm:${leadId}:${stage}`;
}

/** Digits with country code; Brazilian numbers without it get 55. */
export function normalizeMetaPhone(value: string | null | undefined): string | null {
  let digits = (value ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

export function normalizeMetaEmail(value: string | null | undefined): string | null {
  const email = (value ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/** The event time Meta accepts: after the lead was created and never in the future. */
export function resolveMetaConversionEventTime(input: { at: Date; leadCreatedAt: Date; now?: Date }) {
  const now = input.now ?? new Date();
  const afterCreation = input.leadCreatedAt.getTime() + 1000;
  const time = Math.min(Math.max(input.at.getTime(), afterCreation), now.getTime());
  return new Date(time);
}

export function isMetaConversionEventExpired(eventTime: Date, now: Date = new Date()) {
  return now.getTime() - eventTime.getTime() > META_CONVERSION_MAX_AGE_MS;
}

export type MetaConversionEvent = {
  event_name: string;
  event_time: number;
  event_id: string;
  action_source: "system_generated";
  custom_data: { event_source: "crm"; lead_event_source: string };
  user_data: { lead_id: string; ph?: string[]; em?: string[] };
};

export function buildMetaConversionEvent(input: {
  stage: MetaConversionStage;
  eventId: string;
  metaLeadId: string;
  eventTime: Date;
  phone?: string | null;
  email?: string | null;
}): MetaConversionEvent {
  const phone = normalizeMetaPhone(input.phone);
  const email = normalizeMetaEmail(input.email);
  return {
    event_name: META_CONVERSION_EVENT_NAMES[input.stage],
    event_time: Math.floor(input.eventTime.getTime() / 1000),
    event_id: input.eventId,
    action_source: "system_generated",
    custom_data: { event_source: "crm", lead_event_source: META_CONVERSION_LEAD_EVENT_SOURCE },
    user_data: {
      lead_id: input.metaLeadId.trim(),
      ...(phone ? { ph: [sha256Hex(phone)] } : {}),
      ...(email ? { em: [sha256Hex(email)] } : {}),
    },
  };
}

/**
 * Request body for POST /{dataset}/events. lead_id is an int64 in Meta's spec
 * and larger than a safe JS number, so it is written as a raw JSON number from
 * its digit string instead of going through Number().
 */
export function serializeMetaConversionPayload(events: MetaConversionEvent[], testEventCode?: string | null) {
  const body = JSON.stringify({ data: events, ...(testEventCode?.trim() ? { test_event_code: testEventCode.trim() } : {}) });
  return body.replace(/"lead_id":"(\d{1,20})"/g, "\"lead_id\":$1");
}

/** 4/17/32/613 are app/user/page limits; 80000-80014 the Business Use Case limits (80004 = ads management). */
export function isMetaConversionRateLimit(code: number | null | undefined, status?: number) {
  const value = code ?? 0;
  return [4, 17, 32, 613].includes(value) || (value >= 80000 && value <= 80014) || status === 429;
}

/** Token, permission or dataset access refused: retrying the same token will not help. */
export function isMetaConversionAuthError(code: number | null | undefined) {
  return [10, 190, 200].includes(code ?? 0);
}

/** Exponential backoff: 2, 4, 8 ... minutes, capped at 6 hours. */
export function metaConversionRetryDelayMs(attempts: number) {
  const minutes = Math.min(2 ** Math.max(attempts, 1), 360);
  return minutes * 60_000;
}
