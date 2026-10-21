import "server-only";

import { and, eq, gte, inArray, isNull, sql, type SQL } from "drizzle-orm";

import { MOTIVO_PERDA_LABELS, type MotivoPerda } from "@/features/leads/lead-status-constants";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import { APPROACHES, type ApproachId } from "./approaches";
import { CADENCE, type TurboState } from "./cadence";
import { replyRate } from "./experiments";
import { RECOMMENDED_TEMPLATES } from "./templates-pack";

/**
 * Director's qualification funnel (plan 2026-10-21, Fase 0): the leads that
 * arrived in the period followed from the first message to the sale, where they
 * are now, the A/B results, which reminder brought the reply and the estimated
 * Meta cost. Cohort by arrival: every rate divides numbers of the same leads.
 */
export const FUNNEL_PERIODS = [7, 30, 90] as const;
export type FunnelPeriod = (typeof FUNNEL_PERIODS)[number];

export function parseFunnelPeriod(value: string | undefined | null): FunnelPeriod {
  const number = Number(value);
  return (FUNNEL_PERIODS as readonly number[]).includes(number) ? (number as FunnelPeriod) : 7;
}

/** Meta, Brazil, per delivered message since 1/10/2026 (official BRL rate card). */
export const META_RATE_BRL = { MARKETING: 0.3217, UTILITY: 0.035, AUTHENTICATION: 0.035 } as const;

export type FunnelStage = { key: string; label: string; count: number };

export type QualificationFunnel = {
  period: FunnelPeriod;
  since: string;
  stages: FunnelStage[];
  medianMinutesToReply: number | null;
  now: Array<{ key: string; label: string; count: number; hint: string }>;
  lossReasons: Array<{ label: string; count: number }>;
  variants: Array<{ approach: string; variant: string; label: string; sent: number; replied: number; qualified: number; rate: number; low: number; high: number }>;
  touches: Array<{ touch: string; label: string; sent: number; repliesAfter: number }>;
  /** Company-wide Meta cost: only for the director (a manager's unit numbers would not match it). */
  cost: { total: number; marketing: number; utility: number; templatesDelivered: number; perQualified: number | null; source: "meta" | "estimate" } | null;
};

/**
 * Real charge from Meta's per-message pricing (columns of drizzle/0212, read by raw SQL so the
 * page works before the migration). Null when the columns or the data are not there yet.
 */
async function realMetaCost(tenantId: string, since: Date) {
  try {
    const result = await getDatabase().execute(sql`select upper(pricing_category) as category, count(*)::int as count
      from whatsapp_outbound_messages
      where tenant_id = ${tenantId} and recipient_type = 'lead' and pricing_billable = true and sent_at >= ${since}
      group by 1`);
    const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as Array<{ category: string | null; count: number }>;
    if (!rows.length) return null;
    let marketing = 0;
    let utility = 0;
    let delivered = 0;
    for (const row of rows) {
      const count = Number(row.count);
      delivered += count;
      if (row.category === "MARKETING") marketing += count * META_RATE_BRL.MARKETING;
      else utility += count * META_RATE_BRL.UTILITY;
    }
    return { marketing, utility, delivered };
  } catch {
    return null;
  }
}

const TOUCH_LABEL: Record<string, string> = {
  t0: "1ª mensagem",
  t1: "Lembrete 20 min",
  t2: "Reengajamento 3h",
  t3: "Oferta de ligação",
  t4: "Despedida",
};

const VARIANT_LABEL = new Map<string, string>([
  ...RECOMMENDED_TEMPLATES.map((template) => [template.name, template.label] as [string, string]),
  ["padrao", "Template atual (configurado)"],
]);

function scopeFilter(context: TenantContext): SQL | undefined {
  // Director: the whole company. Anyone else: their unit (the page refuses a manager without one).
  if (context.role === "director") return undefined;
  if (!context.branchId) throw new Error("Funil disponível só para a unidade do gestor.");
  return eq(schema.leads.branchId, context.branchId);
}

export async function getQualificationFunnel(context: TenantContext, period: FunnelPeriod): Promise<QualificationFunnel> {
  const db = getDatabase();
  const since = new Date(Date.now() - period * 24 * 60 * 60_000);
  const cohort = and(
    eq(schema.leads.tenantId, context.tenantId),
    gte(schema.leads.createdAt, since),
    isNull(schema.leads.deletedAt),
    scopeFilter(context),
  );

  const firstContact = sql`exists (select 1 from ${schema.whatsappOutboundMessages} o
    where o.tenant_id = ${schema.leads.tenantId} and o.recipient_id = ${schema.leads.id}
      and o.recipient_type = 'lead' and o.purpose = 'leadQualification'
      and o.status in ('sent','delivered','read')`;
  const anyInbound = sql`exists (select 1 from ${schema.whatsappMessages} m
    where m.tenant_id = ${schema.leads.tenantId} and m.lead_id = ${schema.leads.id}
      and m.direction in ('incoming','inbound'))`;

  const [totals] = await db.select({
    arrived: sql<number>`count(*)::int`,
    sent: sql<number>`count(*) filter (where ${firstContact}))::int`,
    delivered: sql<number>`count(*) filter (where ${firstContact} and (o.delivered_at is not null or o.read_at is not null or o.status in ('delivered','read'))))::int`,
    read: sql<number>`count(*) filter (where ${firstContact} and (o.read_at is not null or o.status = 'read')))::int`,
    replied: sql<number>`count(*) filter (where ${anyInbound})::int`,
    qualified: sql<number>`count(*) filter (where ${schema.leads.qualificationStatus} in ('qualified','hot','warm') or ${schema.leads.qualificationState} = 'QUALIFIED')::int`,
    hot: sql<number>`count(*) filter (where ${schema.leads.qualificationStatus} = 'hot')::int`,
    assigned: sql<number>`count(*) filter (where ${schema.leads.corretorId} is not null)::int`,
    converted: sql<number>`count(*) filter (where ${schema.leads.status} = 'converted')::int`,
    qualifying: sql<number>`count(*) filter (where ${schema.leads.qualificationStatus} = 'qualifying')::int`,
    waitingBroker: sql<number>`count(*) filter (where ${schema.leads.corretorId} is null and ${schema.leads.qualificationStatus} in ('qualified','hot','warm','waiting_human') and ${schema.leads.status} not in ('converted','lost'))::int`,
    withBroker: sql<number>`count(*) filter (where ${schema.leads.corretorId} is not null and ${schema.leads.status} not in ('converted','lost'))::int`,
    coldNoReply: sql<number>`count(*) filter (where ${schema.leads.qualificationStatus} = 'cold' and ${schema.leads.corretorId} is null and ${schema.leads.status} not in ('converted','lost'))::int`,
    outOfReach: sql<number>`count(*) filter (where ${schema.leads.qualificationStatus} in ('disqualified','no_whatsapp_contact','meta_blocked') and ${schema.leads.status} not in ('converted','lost'))::int`,
    lost: sql<number>`count(*) filter (where ${schema.leads.status} = 'lost')::int`,
  }).from(schema.leads).where(cohort);

  const n = (value: number | undefined) => Number(value ?? 0);
  const stages: FunnelStage[] = [
    { key: "arrived", label: "Chegaram", count: n(totals?.arrived) },
    { key: "sent", label: "1ª mensagem enviada", count: n(totals?.sent) },
    { key: "delivered", label: "Entregue", count: n(totals?.delivered) },
    { key: "read", label: "Lida", count: n(totals?.read) },
    { key: "replied", label: "Respondeu", count: n(totals?.replied) },
    { key: "qualified", label: "Qualificado", count: n(totals?.qualified) },
    { key: "assigned", label: "Com corretor", count: n(totals?.assigned) },
    { key: "converted", label: "Venda", count: n(totals?.converted) },
  ];

  const [losses, replyTimes, turboLeads, costRows] = await Promise.all([
    db.select({ reason: schema.leads.motivoPerda, count: sql<number>`count(*)::int` })
      .from(schema.leads).where(and(cohort, eq(schema.leads.status, "lost")))
      .groupBy(schema.leads.motivoPerda).orderBy(sql`2 desc`).limit(6),
    db.select({
      median: sql<number | null>`percentile_cont(0.5) within group (order by extract(epoch from (r.first_in - f.first_out)) / 60)`,
    }).from(schema.leads)
      .innerJoin(sql`lateral (select min(o.sent_at) as first_out from ${schema.whatsappOutboundMessages} o where o.tenant_id = ${schema.leads.tenantId} and o.recipient_id = ${schema.leads.id} and o.purpose = 'leadQualification' and o.sent_at is not null) f`, sql`true`)
      .innerJoin(sql`lateral (select min(m.sent_at) as first_in from ${schema.whatsappMessages} m where m.tenant_id = ${schema.leads.tenantId} and m.lead_id = ${schema.leads.id} and m.direction in ('incoming','inbound') and m.sent_at > f.first_out) r`, sql`true`)
      .where(and(cohort, sql`f.first_out is not null and r.first_in is not null`)),
    db.select({
      id: schema.leads.id,
      qualificationStatus: schema.leads.qualificationStatus,
      turbo: sql<TurboState | null>`${schema.leads.qualificationDetails}->'turbo'`,
      // Qualified outer columns: see loadVariantStats in service.ts.
      firstReplyAt: sql<string | null>`(select min(m.sent_at) from whatsapp_messages m where m.tenant_id = "leads"."tenant_id" and m.lead_id = "leads"."id" and m.direction in ('incoming','inbound') and m.sent_at > ("leads"."qualification_details"->'turbo'->>'firstContactAt')::timestamptz)`,
    }).from(schema.leads).where(and(cohort, sql`${schema.leads.qualificationDetails}->'turbo'->>'firstContactAt' is not null`)).limit(5000),
    db.select({
      templateName: schema.whatsappOutboundMessages.templateName,
      category: schema.metaWhatsAppTemplates.category,
      count: sql<number>`count(*)::int`,
    }).from(schema.whatsappOutboundMessages)
      .leftJoin(schema.metaWhatsAppTemplates, and(
        eq(schema.metaWhatsAppTemplates.tenantId, schema.whatsappOutboundMessages.tenantId),
        eq(schema.metaWhatsAppTemplates.name, schema.whatsappOutboundMessages.templateName),
        isNull(schema.metaWhatsAppTemplates.deletedAt),
      ))
      .where(and(
        eq(schema.whatsappOutboundMessages.tenantId, context.tenantId),
        eq(schema.whatsappOutboundMessages.recipientType, "lead"),
        eq(schema.whatsappOutboundMessages.messageType, "template"),
        inArray(schema.whatsappOutboundMessages.status, ["delivered", "read"]),
        gte(schema.whatsappOutboundMessages.sentAt, since),
      ))
      .groupBy(schema.whatsappOutboundMessages.templateName, schema.metaWhatsAppTemplates.category),
  ]);

  // A/B: per approach and first-contact variant.
  const variantMap = new Map<string, { approach: string; variant: string; sent: number; replied: number; qualified: number }>();
  const touchMap = new Map<string, { sent: number; repliesAfter: number }>();
  for (const lead of turboLeads) {
    const state = lead.turbo;
    if (!state?.firstContactAt) continue;
    const key = `${state.approach}|${state.variant ?? "padrao"}`;
    const row = variantMap.get(key) ?? { approach: state.approach, variant: state.variant ?? "padrao", sent: 0, replied: 0, qualified: 0 };
    row.sent += 1;
    if (lead.firstReplyAt) row.replied += 1;
    if (["qualified", "hot", "warm"].includes(lead.qualificationStatus ?? "")) row.qualified += 1;
    variantMap.set(key, row);
    // Which touch was the last one before the first reply.
    const replyAt = lead.firstReplyAt ? new Date(lead.firstReplyAt).getTime() : null;
    let lastBeforeReply: string | null = null;
    for (const touch of state.touches ?? []) {
      if (touch.status !== "sent") continue;
      const entry = touchMap.get(touch.touch) ?? { sent: 0, repliesAfter: 0 };
      entry.sent += 1;
      touchMap.set(touch.touch, entry);
      if (replyAt !== null && new Date(touch.at).getTime() <= replyAt) lastBeforeReply = touch.touch;
    }
    if (lastBeforeReply) touchMap.get(lastBeforeReply)!.repliesAfter += 1;
  }
  const variants = [...variantMap.values()]
    .map((row) => ({
      ...row,
      approach: APPROACHES[row.approach as ApproachId]?.label ?? row.approach,
      label: VARIANT_LABEL.get(row.variant) ?? row.variant,
      ...replyRate(row.sent, row.replied),
    }))
    .sort((a, b) => b.sent - a.sent);
  const touches = ["t0", ...CADENCE.map((step) => step.touch)].map((touch) => ({
    touch,
    label: TOUCH_LABEL[touch] ?? touch,
    sent: touchMap.get(touch)?.sent ?? 0,
    repliesAfter: touchMap.get(touch)?.repliesAfter ?? 0,
  }));

  const packCategory = new Map(RECOMMENDED_TEMPLATES.map((template) => [template.name, template.category]));
  let marketing = 0;
  let utility = 0;
  let templatesDelivered = 0;
  for (const row of costRows) {
    const category = (row.category ?? packCategory.get(row.templateName) ?? "MARKETING").toUpperCase();
    const count = Number(row.count);
    templatesDelivered += count;
    if (category === "MARKETING") marketing += count * META_RATE_BRL.MARKETING;
    else utility += count * META_RATE_BRL.UTILITY;
  }
  // Meta's own pricing (billable messages, including service replies) when recorded; else the estimate.
  const real = await realMetaCost(context.tenantId, since);
  if (real) {
    marketing = real.marketing;
    utility = real.utility;
    templatesDelivered = real.delivered;
  }
  const total = marketing + utility;
  const qualified = n(totals?.qualified);

  return {
    period,
    since: since.toISOString(),
    stages,
    medianMinutesToReply: replyTimes[0]?.median === null || replyTimes[0]?.median === undefined ? null : Math.round(Number(replyTimes[0].median)),
    now: [
      { key: "qualifying", label: "Em qualificação", count: n(totals?.qualifying), hint: "Conversando com a assistente agora" },
      { key: "waiting", label: "Prontos, esperando corretor", count: n(totals?.waitingBroker), hint: "Qualificados sem corretor ainda" },
      { key: "broker", label: "Em atendimento com corretor", count: n(totals?.withBroker), hint: "Com corretor, sem venda ou perda" },
      { key: "cold", label: "Sem resposta (frios)", count: n(totals?.coldNoReply), hint: "Recebem os lembretes automáticos" },
      { key: "out", label: "Fora de alcance", count: n(totals?.outOfReach), hint: "Sem WhatsApp, bloqueados ou sem interesse" },
      { key: "lost", label: "Perdidos", count: n(totals?.lost), hint: "Marcados como perdidos" },
      { key: "converted", label: "Vendas", count: n(totals?.converted), hint: "Convertidos" },
    ],
    lossReasons: losses.map((row) => ({
      label: row.reason ? MOTIVO_PERDA_LABELS[row.reason as MotivoPerda] ?? row.reason : "Sem motivo informado",
      count: Number(row.count),
    })),
    variants,
    touches,
    cost: context.role !== "director" ? null : {
      total,
      marketing,
      utility,
      templatesDelivered,
      perQualified: qualified ? total / qualified : null,
      source: real ? "meta" : "estimate",
    },
  };
}
