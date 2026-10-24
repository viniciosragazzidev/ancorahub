import "server-only";

import { and, eq, gte, inArray, isNull, sql } from "drizzle-orm";

import { MOTIVO_PERDA_LABELS, type MotivoPerda } from "@/features/leads/lead-status-constants";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import { APPROACHES, type ApproachId } from "./approaches";
import { CADENCE, type TurboState } from "./cadence";
import { replyRate } from "./experiments";
import { RECOMMENDED_TEMPLATES } from "./templates-pack";
import { resolveFunnelBranchScope } from "./funnel-scope";

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
      where tenant_id = ${tenantId} and created_at >= ${since.toISOString()}::timestamptz and recipient_type = 'lead' and pricing_billable = true and sent_at >= ${since.toISOString()}::timestamptz
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

/** Director: the whole company. Anyone else: their unit (the page refuses a manager without one). */
type CohortRow = {
  id: string;
  status: string;
  qualification_status: string | null;
  qualification_state: string | null;
  corretor_id: string | null;
  motivo_perda: string | null;
  turbo: TurboState | null;
  first_out: string | Date | null;
  delivered: boolean | null;
  read: boolean | null;
  first_in: string | Date | null;
  first_in_after_out: string | Date | null;
  first_in_after_turbo: string | Date | null;
};

function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as T[];
}

function time(value: string | Date | null) {
  return value ? new Date(value).getTime() : null;
}

/**
 * One pass per table (21/10, the first version was slow): the leads of the period, their
 * first-contact sends (outbound read by its tenant + created_at index, there is no index by
 * recipient) and their inbound messages (by the tenant + lead index). Counts are made here.
 */
async function loadCohort(tenantId: string, since: Date, branchId: string | null) {
  // Raw SQL with postgres.js: a Date parameter is sent as Date.toString(), which Postgres
  // rejects ("Wed Oct 14 2026 ... GMT+0000"); send ISO text with an explicit cast.
  const sinceIso = since.toISOString();
  const result = await getDatabase().execute(sql`
    with cohort as (
      select l.id, l.status, l.qualification_status, l.qualification_state, l.corretor_id, l.motivo_perda,
        l.qualification_details->'turbo' as turbo,
        (l.qualification_details->'turbo'->>'firstContactAt')::timestamptz as turbo_at
      from leads l
      where l.tenant_id = ${tenantId} and l.created_at >= ${sinceIso}::timestamptz and l.deleted_at is null
        ${branchId ? sql`and l.branch_id = ${branchId}` : sql``}
    ),
    fc as (
      select o.recipient_id as lead_id, min(o.sent_at) as first_out,
        bool_or(o.delivered_at is not null or o.read_at is not null or o.status in ('delivered','read')) as delivered,
        bool_or(o.read_at is not null or o.status = 'read') as read
      from whatsapp_outbound_messages o
      where o.tenant_id = ${tenantId} and o.created_at >= ${sinceIso}::timestamptz
        and o.recipient_type = 'lead' and o.purpose = 'leadQualification' and o.status in ('sent','delivered','read')
      group by o.recipient_id
    ),
    inb as (
      select c.id as lead_id,
        min(m.sent_at) as first_in,
        min(m.sent_at) filter (where fc.first_out is not null and m.sent_at > fc.first_out) as first_in_after_out,
        min(m.sent_at) filter (where c.turbo_at is not null and m.sent_at > c.turbo_at) as first_in_after_turbo
      from cohort c
      join whatsapp_messages m on m.tenant_id = ${tenantId} and m.lead_id = c.id and m.direction in ('incoming','inbound')
      left join fc on fc.lead_id = c.id
      group by c.id
    )
    select c.id, c.status, c.qualification_status, c.qualification_state, c.corretor_id, c.motivo_perda, c.turbo,
      fc.first_out, fc.delivered, fc.read, inb.first_in, inb.first_in_after_out, inb.first_in_after_turbo
    from cohort c
    left join fc on fc.lead_id = c.id
    left join inb on inb.lead_id = c.id
  `);
  return rowsOf<CohortRow>(result);
}

/** `requestedBranchId` is supplied only after the dashboard page validates the viewer's allowed units. */
export async function getQualificationFunnel(
  context: TenantContext,
  period: FunnelPeriod,
  requestedBranchId?: string | null,
): Promise<QualificationFunnel> {
  const db = getDatabase();
  const since = new Date(Date.now() - period * 24 * 60 * 60_000);
  const isDirector = context.role === "director";
  const branchId = resolveFunnelBranchScope(context, requestedBranchId);
  const includeCompanyCost = isDirector && branchId === null;

  const [rows, costRows, real] = await Promise.all([
    loadCohort(context.tenantId, since, branchId),
    includeCompanyCost
      ? db.select({
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
          // created_at uses the tenant index; sent_at keeps the period exact.
          gte(schema.whatsappOutboundMessages.createdAt, since),
          gte(schema.whatsappOutboundMessages.sentAt, since),
          eq(schema.whatsappOutboundMessages.recipientType, "lead"),
          eq(schema.whatsappOutboundMessages.messageType, "template"),
          inArray(schema.whatsappOutboundMessages.status, ["delivered", "read"]),
        ))
        .groupBy(schema.whatsappOutboundMessages.templateName, schema.metaWhatsAppTemplates.category)
      : Promise.resolve([]),
    includeCompanyCost ? realMetaCost(context.tenantId, since) : Promise.resolve(null),
  ]);

  const count = (predicate: (row: CohortRow) => boolean) => rows.reduce((total, row) => total + (predicate(row) ? 1 : 0), 0);
  const open = (row: CohortRow) => row.status !== "converted" && row.status !== "lost";
  const isQualified = (row: CohortRow) => ["qualified", "hot", "warm"].includes(row.qualification_status ?? "") || row.qualification_state === "QUALIFIED";
  const qualified = count(isQualified);

  const stages: FunnelStage[] = [
    { key: "arrived", label: "Chegaram", count: rows.length },
    { key: "sent", label: "1ª mensagem enviada", count: count((row) => row.first_out !== null) },
    { key: "delivered", label: "Entregue", count: count((row) => row.delivered === true) },
    { key: "read", label: "Lida", count: count((row) => row.read === true) },
    { key: "replied", label: "Respondeu", count: count((row) => row.first_in !== null) },
    { key: "qualified", label: "Qualificado", count: qualified },
    { key: "assigned", label: "Com corretor", count: count((row) => row.corretor_id !== null) },
    { key: "converted", label: "Venda", count: count((row) => row.status === "converted") },
  ];

  // Median minutes from the first contact to the first reply after it.
  const replyMinutes = rows
    .map((row) => {
      const out = time(row.first_out);
      const reply = time(row.first_in_after_out);
      return out !== null && reply !== null ? (reply - out) / 60_000 : null;
    })
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  const median = replyMinutes.length
    ? replyMinutes.length % 2
      ? replyMinutes[(replyMinutes.length - 1) / 2]
      : (replyMinutes[replyMinutes.length / 2 - 1] + replyMinutes[replyMinutes.length / 2]) / 2
    : null;

  const lossCounts = new Map<string, number>();
  for (const row of rows) if (row.status === "lost") lossCounts.set(row.motivo_perda ?? "", (lossCounts.get(row.motivo_perda ?? "") ?? 0) + 1);
  const lossReasons = [...lossCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([reason, total]) => ({ label: reason ? MOTIVO_PERDA_LABELS[reason as MotivoPerda] ?? reason : "Sem motivo informado", count: total }));

  // A/B per approach and first-contact variant; which touch came right before the first reply.
  const variantMap = new Map<string, { approach: string; variant: string; sent: number; replied: number; qualified: number }>();
  const touchMap = new Map<string, { sent: number; repliesAfter: number }>();
  for (const row of rows) {
    const state = row.turbo;
    if (!state?.firstContactAt) continue;
    const key = `${state.approach}|${state.variant ?? "padrao"}`;
    const entry = variantMap.get(key) ?? { approach: state.approach, variant: state.variant ?? "padrao", sent: 0, replied: 0, qualified: 0 };
    entry.sent += 1;
    if (row.first_in_after_turbo) entry.replied += 1;
    if (isQualified(row)) entry.qualified += 1;
    variantMap.set(key, entry);
    const replyAt = time(row.first_in_after_turbo);
    let lastBeforeReply: string | null = null;
    for (const touch of state.touches ?? []) {
      if (touch.status !== "sent") continue;
      const touchEntry = touchMap.get(touch.touch) ?? { sent: 0, repliesAfter: 0 };
      touchEntry.sent += 1;
      touchMap.set(touch.touch, touchEntry);
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

  let marketing = 0;
  let utility = 0;
  let templatesDelivered = 0;
  if (real) {
    // Meta's own pricing (billable messages, including service replies) when recorded.
    ({ marketing, utility } = real);
    templatesDelivered = real.delivered;
  } else {
    const packCategory = new Map(RECOMMENDED_TEMPLATES.map((template) => [template.name, template.category]));
    for (const row of costRows) {
      const category = (row.category ?? packCategory.get(row.templateName) ?? "MARKETING").toUpperCase();
      const total = Number(row.count);
      templatesDelivered += total;
      if (category === "MARKETING") marketing += total * META_RATE_BRL.MARKETING;
      else utility += total * META_RATE_BRL.UTILITY;
    }
  }
  const total = marketing + utility;

  return {
    period,
    since: since.toISOString(),
    stages,
    medianMinutesToReply: median === null ? null : Math.round(median),
    now: [
      { key: "qualifying", label: "Em qualificação", count: count((row) => row.qualification_status === "qualifying"), hint: "Conversando com a assistente agora" },
      { key: "waiting", label: "Prontos, esperando corretor", count: count((row) => row.corretor_id === null && ["qualified", "hot", "warm", "waiting_human"].includes(row.qualification_status ?? "") && open(row)), hint: "Qualificados sem corretor ainda" },
      { key: "broker", label: "Em atendimento com corretor", count: count((row) => row.corretor_id !== null && open(row)), hint: "Com corretor, sem venda ou perda" },
      { key: "cold", label: "Sem resposta (frios)", count: count((row) => row.qualification_status === "cold" && row.corretor_id === null && open(row)), hint: "Recebem os lembretes automáticos" },
      { key: "out", label: "Fora de alcance", count: count((row) => ["disqualified", "no_whatsapp_contact", "meta_blocked"].includes(row.qualification_status ?? "") && open(row)), hint: "Sem WhatsApp, bloqueados ou sem interesse" },
      { key: "lost", label: "Perdidos", count: count((row) => row.status === "lost"), hint: "Marcados como perdidos" },
      { key: "converted", label: "Vendas", count: count((row) => row.status === "converted"), hint: "Convertidos" },
    ],
    lossReasons,
    variants,
    touches,
    cost: !includeCompanyCost ? null : {
      total,
      marketing,
      utility,
      templatesDelivered,
      perQualified: qualified ? total / qualified : null,
      source: real ? "meta" : "estimate",
    },
  };
}
