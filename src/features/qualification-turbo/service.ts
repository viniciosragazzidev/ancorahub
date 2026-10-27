import "server-only";

import { and, eq, gte, isNull, sql } from "drizzle-orm";

import { getSystemSetting, setSystemSetting } from "@/features/system-settings/queries";
import { getActiveWabaId } from "@/features/communication-channels/message-policy-service";
import { getDatabase, schema } from "@/shared/db";

import { APPROACHES, isNightInSaoPaulo, NIGHT_TEMPLATE, qualificationTemplateVariables, requestedOperator, resolveApproach, type ApproachInput, type ApproachId } from "./approaches";
import type { TurboState } from "./cadence";
import { assignVariant, type VariantStats } from "./experiments";

/**
 * Per-company switches of the qualification turbo (same per-tenant key
 * pattern as meta_lead_capture_mode_<tenantId>; no migration). Defaults on:
 * nothing changes for a lead until its templates are approved by Meta.
 */
export type TurboSettings = {
  /** First contact by approach and A/B among approved templates. */
  enabled: boolean;
  /** T1 to T4 reminders. */
  cadence: boolean;
  /** Favour the variant with more replies once there is a sample. */
  learn: boolean;
  /** Name shown to the client in {{empresa}}; empty uses the company name. */
  companyDisplayName: string;
};

export const DEFAULT_TURBO_SETTINGS: TurboSettings = { enabled: true, cadence: true, learn: true, companyDisplayName: "" };

function settingKey(tenantId: string) {
  return `qualification_turbo_${tenantId}`;
}

export function parseTurboSettings(raw: string | null | undefined): TurboSettings {
  if (!raw) return { ...DEFAULT_TURBO_SETTINGS };
  try {
    const value = JSON.parse(raw) as Partial<TurboSettings>;
    return {
      enabled: value.enabled !== false,
      cadence: value.cadence !== false,
      learn: value.learn !== false,
      companyDisplayName: typeof value.companyDisplayName === "string" ? value.companyDisplayName.slice(0, 60) : "",
    };
  } catch {
    return { ...DEFAULT_TURBO_SETTINGS };
  }
}

export async function getTurboSettings(tenantId: string) {
  return parseTurboSettings(await getSystemSetting(settingKey(tenantId)).catch(() => null));
}

export async function saveTurboSettings(tenantId: string, settings: TurboSettings) {
  await setSystemSetting(settingKey(tenantId), JSON.stringify(settings));
}

/** Eligible Utility templates of the active WABA; Marketing touches are skipped. */
export async function listApprovedTemplateNames(tenantId: string) {
  const wabaId = await getActiveWabaId(tenantId);
  if (!wabaId) return new Set<string>();
  const rows = await getDatabase().select({ name: schema.metaWhatsAppTemplates.name })
    .from(schema.metaWhatsAppTemplates)
    .where(and(
      eq(schema.metaWhatsAppTemplates.tenantId, tenantId),
      eq(schema.metaWhatsAppTemplates.wabaId, wabaId),
      eq(schema.metaWhatsAppTemplates.status, "APPROVED"),
      eq(schema.metaWhatsAppTemplates.category, "UTILITY"),
      isNull(schema.metaWhatsAppTemplates.deletedAt),
    ));
  return new Set(rows.map((row) => row.name));
}

/** First contacts sent and answered per variant in the last 30 days (A/B learning). */
export async function loadVariantStats(tenantId: string, approach: ApproachId): Promise<VariantStats[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60_000);
  const rows = await getDatabase().select({
    variant: sql<string>`${schema.leads.qualificationDetails}->'turbo'->>'variant'`,
    sent: sql<number>`count(*)::int`,
    // Outer columns written qualified: a single-table select renders interpolated columns bare,
    // which inside "from whatsapp_messages m" would bind to m.id/m.tenant_id.
    replied: sql<number>`count(*) filter (where exists (
      select 1 from whatsapp_messages m
      where m.tenant_id = "leads"."tenant_id" and m.lead_id = "leads"."id"
        and m.direction in ('incoming','inbound')
        and m.sent_at > ("leads"."qualification_details"->'turbo'->>'firstContactAt')::timestamptz
    ))::int`,
  }).from(schema.leads).where(and(
    eq(schema.leads.tenantId, tenantId),
    gte(schema.leads.createdAt, since),
    sql`${schema.leads.qualificationDetails}->'turbo'->>'approach' = ${approach}`,
    sql`${schema.leads.qualificationDetails}->'turbo'->>'variant' is not null`,
  )).groupBy(sql`1`);
  return rows.map((row) => ({ variant: row.variant, sent: Number(row.sent), replied: Number(row.replied) }));
}

/** First contact that asks WhatsApp or call, without a qualification question. */
const CHANNEL_TEMPLATE = "anc_t0_canal";

export type FirstContactChoice = {
  approach: ApproachId;
  /** Template chosen for this lead, or null to keep the configured FIRST_CONTACT. */
  templateName: string | null;
  variant: string | null;
  /** Variables in FIRST_CONTACT order: nome, nome_bot, empresa, operadora. */
  variables: string[];
};

export async function companyNameFor(tenantId: string, settings?: TurboSettings) {
  const configured = (settings ?? await getTurboSettings(tenantId)).companyDisplayName.trim();
  if (configured) return configured;
  const [tenant] = await getDatabase().select({ name: schema.tenants.name }).from(schema.tenants).where(eq(schema.tenants.id, tenantId)).limit(1);
  return tenant?.name?.trim() || "nossa corretora";
}

/**
 * The first contact for a new lead: its approach, the night template when it
 * arrives between 22h and 7h, otherwise a stable A/B among the approach's
 * approved templates. Returns templateName null when none is approved yet.
 */
export async function chooseFirstContact(input: {
  tenantId: string;
  leadId: string;
  leadName: string;
  botName: string;
  lead: ApproachInput;
  /** The form already answered the first question (plan type, or CNPJ for a company). */
  firstQuestionAnswered?: boolean;
  now?: Date;
}): Promise<FirstContactChoice> {
  const settings = await getTurboSettings(input.tenantId);
  const approach = resolveApproach(input.lead);
  const empresa = await companyNameFor(input.tenantId, settings);
  const variables = qualificationTemplateVariables(input.leadName, input.botName, empresa, requestedOperator(input.lead));
  const none: FirstContactChoice = { approach: approach.id, templateName: null, variant: null, variables };
  if (!settings.enabled || !approach.firstContactTemplates.length) return none;

  const approved = await listApprovedTemplateNames(input.tenantId);
  if (approach.id !== "pme" && approach.id !== "operadora" && isNightInSaoPaulo(input.now ?? new Date()) && approved.has(NIGHT_TEMPLATE)) {
    return { ...none, templateName: NIGHT_TEMPLATE, variant: NIGHT_TEMPLATE };
  }
  // When the form already answered "para quem é o plano", ask how to continue instead of repeating it.
  const preferred = input.firstQuestionAnswered && approved.has(CHANNEL_TEMPLATE) ? [CHANNEL_TEMPLATE] : null;
  const candidates = preferred ?? approach.firstContactTemplates.filter((name) => approved.has(name));
  if (!candidates.length) return none;
  const stats = settings.learn && candidates.length > 1 ? await loadVariantStats(input.tenantId, approach.id) : [];
  const variant = assignVariant({ leadId: input.leadId, experiment: `t0:${approach.id}`, variants: candidates, stats, learn: settings.learn });
  return { ...none, templateName: variant, variant };
}

/** Writes qualificationDetails.turbo atomically (other writers merge the rest of the JSON). */
export async function writeTurboState(tenantId: string, leadId: string, state: TurboState) {
  await getDatabase().update(schema.leads).set({
    qualificationDetails: sql`jsonb_set(coalesce(${schema.leads.qualificationDetails}, '{}'::jsonb), '{turbo}', ${JSON.stringify(state)}::jsonb, true)`,
  }).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, tenantId)));
}

export function readTurboState(qualificationDetails: unknown): TurboState | null {
  if (!qualificationDetails || typeof qualificationDetails !== "object") return null;
  const turbo = (qualificationDetails as Record<string, unknown>).turbo;
  if (!turbo || typeof turbo !== "object") return null;
  const state = turbo as TurboState;
  return state.firstContactAt && Array.isArray(state.touches) ? state : null;
}

export { APPROACHES };
