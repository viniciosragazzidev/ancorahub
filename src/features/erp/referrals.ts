import "server-only";
import { and, count, desc, eq, ilike, inArray, isNull, ne, notInArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDatabase, schema } from "@/shared/db";
import { auditErp, erpScopeSql, getErpEffectiveAccess, requireErpAccess, type ErpDatabase, type ErpTransaction } from "./access";
import { ErpError, recordIdSchema } from "./contracts";
import { scopedLead, type ErpAccess } from "./records";
import { scopeIncludes } from "./scope";
import { PAGE_SIZE, pageSchema } from "./shared";
import { canAccessRoute } from "@/features/custom-roles/effective-access";
import { getRouteDefinition } from "@/features/custom-roles/routes";

export const REFERRAL_STATUSES = ["registered", "validated", "contacting", "opportunity", "converted", "lost", "duplicate"] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];
export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  registered: "Registrada",
  validated: "Validada",
  contacting: "Em contato",
  opportunity: "Oportunidade",
  converted: "Convertida",
  lost: "Perdida",
  duplicate: "Duplicada",
};
export const REFERRAL_CHANNELS = ["cliente", "parceiro", "colaborador", "evento", "outro"] as const;
export type ReferralChannel = (typeof REFERRAL_CHANNELS)[number];
export const REFERRAL_CHANNEL_LABELS: Record<ReferralChannel, string> = {
  cliente: "Cliente", parceiro: "Parceiro", colaborador: "Colaborador", evento: "Evento", outro: "Outro",
};
const EVENT_LABELS: Record<string, string> = {
  "erp.referral.registered": "Indicação registrada",
  "erp.referral.status_changed": "Etapa alterada",
  "erp.referral.lead_linked": "Negócio vinculado",
};

const transitions: Record<ReferralStatus, readonly ReferralStatus[]> = {
  registered: ["validated", "lost", "duplicate"],
  validated: ["contacting", "lost", "duplicate"],
  contacting: ["opportunity", "lost"],
  opportunity: ["converted", "lost"],
  converted: [],
  lost: ["validated"],
  duplicate: ["validated"],
};
/** Statuses after which linking a lead must not move the referral backwards. */
const LINKABLE: readonly ReferralStatus[] = ["registered", "validated", "contacting", "opportunity"];
/** Statuses that free the linked lead (mirrors the partial unique index on erp_referrals). */
const INACTIVE: ReferralStatus[] = ["lost", "duplicate"];
export const REFERRAL_TIMELINE_PAGE_SIZE = 20;
const ACTIVE_LEAD_UNIQUE = "erp_referrals_tenant_active_lead_unique";
export const REFERRAL_LEAD_TAKEN_MESSAGE = "Este negócio já está vinculado a outra indicação ativa.";
const STALE_MESSAGE = "A indicação mudou. Atualize a página e confira novamente.";

export function availableReferralStatuses(from: ReferralStatus) {
  return transitions[from];
}

/** National digits (without Brazil's 55) plus the international form; both match stored phones. */
export function normalizeReferralPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) throw new ErpError("Informe o telefone com DDD (10 a 13 dígitos).");
  const national = (digits.length === 12 || digits.length === 13) && digits.startsWith("55") ? digits.slice(2) : digits;
  if (national.length < 10 || national.length > 11) throw new ErpError("Informe o telefone com DDD (10 a 13 dígitos).");
  return { digits: national, candidates: [national, `55${national}`] };
}

export function assertReferralTransition(
  current: { status: ReferralStatus; consent: boolean; leadId: string | null },
  input: { status: ReferralStatus; reason: string; leadId: string | null },
) {
  if (current.status === input.status) throw new ErpError("A indicação já está nesta etapa.");
  if (!transitions[current.status].includes(input.status)) throw new ErpError("Essa mudança de etapa não é permitida a partir da etapa atual.");
  if (input.status === "lost" && input.reason.length < 5) throw new ErpError("Explique o motivo da perda (mínimo de 5 caracteres).");
  if (INACTIVE.includes(current.status) && input.reason.length < 5) throw new ErpError("Informe o motivo da reabertura (mínimo de 5 caracteres).");
  if (input.status === "contacting" && !current.consent) throw new ErpError("Registre o consentimento de contato antes de iniciar o atendimento.");
  if (input.status === "duplicate" && !(input.leadId ?? current.leadId)) throw new ErpError("Selecione o negócio existente para marcar como duplicada.");
  if (["opportunity", "converted"].includes(input.status) && !current.leadId) throw new ErpError("Vincule o negócio criado em /leads antes de avançar.");
}

export function isConvertedLead(lead: { status: string }, hasActiveSale: boolean) {
  return lead.status === "converted" || hasActiveSale;
}

/** True when the error (or one of its causes) is the unique violation of one active referral per lead. */
export function isActiveLeadConflict(error: unknown) {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth += 1) {
    const candidate = current as { code?: unknown; constraint_name?: unknown; constraint?: unknown; cause?: unknown };
    const constraint = candidate.constraint_name ?? candidate.constraint;
    if (candidate.code === "23505" && constraint === ACTIVE_LEAD_UNIQUE) return true;
    current = candidate.cause;
  }
  return false;
}

/** Concurrent links of the same lead both pass the read check; the database index decides, with a clear message. */
async function withActiveLeadGuard<T>(work: () => Promise<T>) {
  try {
    return await work();
  } catch (error) {
    if (isActiveLeadConflict(error)) throw new ErpError(REFERRAL_LEAD_TAKEN_MESSAGE);
    throw error;
  }
}

const text = (max: number) => z.string().trim().max(max);
export const referralInputSchema = z.object({
  requestId: z.string().uuid("Atualize a página e tente novamente."),
  referrerName: z.string().trim().min(2, "Informe quem indicou.").max(120),
  referrerUserId: recordIdSchema.nullable(),
  referrerContact: text(120),
  channel: z.enum(REFERRAL_CHANNELS, "Selecione o canal da indicação."),
  referredName: z.string().trim().min(2, "Informe o nome da pessoa indicada.").max(120),
  referredPhone: z.string().trim().min(1, "Informe o telefone da pessoa indicada.").max(30),
  consent: z.boolean(),
  notes: text(1000),
  ownerId: recordIdSchema.nullable(),
}).strict();
export const referralStatusInputSchema = z.object({
  id: recordIdSchema, expectedVersion: z.number().int().positive(), status: z.enum(REFERRAL_STATUSES), reason: text(500), leadId: recordIdSchema.nullable(),
}).strict();
export const referralLinkInputSchema = z.object({ id: recordIdSchema, expectedVersion: z.number().int().positive(), leadId: recordIdSchema }).strict();
export const referralFiltersSchema = z.object({
  q: text(100).default(""),
  status: z.enum(["all", ...REFERRAL_STATUSES]).catch("all"),
  page: pageSchema.catch(1),
  id: recordIdSchema.optional().catch(undefined),
});
export const referralTimelineInputSchema = z.object({ id: recordIdSchema, page: pageSchema.catch(1) }).strict();

export class ReferralDuplicateError extends ErpError {
  constructor(message: string, readonly href: string | null) {
    super(message);
    this.name = "ReferralDuplicateError";
  }
}

const scoped = (auth: ErpAccess) => and(
  eq(schema.erpReferrals.tenantId, auth.context.tenantId),
  erpScopeSql(auth.scope, schema.erpReferrals.branchId, schema.erpReferrals.ownerId),
);

async function scopedReferral(db: ErpDatabase, auth: ErpAccess, id: string, lock = false) {
  const query = db.select().from(schema.erpReferrals).where(and(eq(schema.erpReferrals.id, id), scoped(auth))).limit(1);
  const [row] = lock ? await query.for("update") : await query;
  if (!row) throw new ErpError("Indicação não encontrada no seu escopo.");
  return { ...row, status: z.enum(REFERRAL_STATUSES).parse(row.status) };
}

async function scopedMember(db: ErpDatabase, auth: ErpAccess, userId: string, label: string) {
  const [member] = await db.select({ id: schema.tenantMemberships.userId, branchId: schema.tenantMemberships.branchId }).from(schema.tenantMemberships)
    .where(and(
      eq(schema.tenantMemberships.tenantId, auth.context.tenantId),
      eq(schema.tenantMemberships.userId, userId),
      eq(schema.tenantMemberships.status, "active"),
    )).limit(1);
  if (!member || !scopeIncludes(auth.scope, { branchId: member.branchId, ownerId: member.id })) throw new ErpError(`${label} não encontrado no seu escopo.`);
  return member;
}

const leadPhoneDigits = sql`regexp_replace(${schema.leads.telefone}, '\\D', '', 'g')`;
const lockContact = (tx: ErpTransaction, tenantId: string, digits: string) =>
  tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`erp_referral:${tenantId}:${digits}`}, 0))`);

/** Serialized per tenant + contact, so concurrent registrations cannot both pass deduplication. */
export async function registerReferralInTransaction(tx: ErpTransaction, auth: ErpAccess, raw: unknown) {
  const input = referralInputSchema.parse(raw);
  const phone = normalizeReferralPhone(input.referredPhone);
  const tenantId = auth.context.tenantId;
  await lockContact(tx, tenantId, phone.digits);
  const [existingRequest] = await tx.select({
    id: schema.erpReferrals.id, branchId: schema.erpReferrals.branchId, ownerId: schema.erpReferrals.ownerId, createdBy: schema.erpReferrals.createdBy,
  }).from(schema.erpReferrals).where(and(eq(schema.erpReferrals.tenantId, tenantId), eq(schema.erpReferrals.requestId, input.requestId))).limit(1);
  if (existingRequest) {
    if (existingRequest.createdBy !== auth.context.userId && !scopeIncludes(auth.scope, existingRequest)) throw new ErpError("Atualize a página e tente novamente.");
    return existingRequest.id;
  }
  const [referral] = await tx.select({ id: schema.erpReferrals.id, branchId: schema.erpReferrals.branchId, ownerId: schema.erpReferrals.ownerId })
    .from(schema.erpReferrals)
    .where(and(eq(schema.erpReferrals.tenantId, tenantId), inArray(schema.erpReferrals.phoneDigits, phone.candidates), ne(schema.erpReferrals.status, "lost")))
    .limit(1);
  if (referral) {
    if (scopeIncludes(auth.scope, referral)) {
      throw new ReferralDuplicateError("Este contato já tem uma indicação registrada. Abra a indicação existente.", `/indicacoes?id=${encodeURIComponent(referral.id)}`);
    }
    throw new ReferralDuplicateError("Já existe um atendimento para este contato; fale com a gestão.", null);
  }
  const [lead] = await tx.select({ id: schema.leads.id, branchId: schema.leads.branchId, ownerId: schema.leads.corretorId }).from(schema.leads)
    .where(and(eq(schema.leads.tenantId, tenantId), isNull(schema.leads.deletedAt), inArray(leadPhoneDigits, phone.candidates))).limit(1);
  if (lead) {
    if (scopeIncludes(auth.scope, lead)) {
      throw new ReferralDuplicateError("Este contato já é um negócio no CRM. Abra o negócio existente.", `/leads/${encodeURIComponent(lead.id)}`);
    }
    throw new ReferralDuplicateError("Já existe um atendimento para este contato; fale com a gestão.", null);
  }
  const ownerId = input.ownerId ?? auth.context.userId;
  if (ownerId !== auth.context.userId && !["director", "manager"].includes(auth.context.role)) throw new ErpError("Somente a gestão pode definir outro responsável.");
  const owner = await scopedMember(tx, auth, ownerId, "Responsável");
  if (input.referrerUserId) await scopedMember(tx, auth, input.referrerUserId, "Indicador");
  const id = crypto.randomUUID();
  await tx.insert(schema.erpReferrals).values({
    id, tenantId, requestId: input.requestId,
    referrerName: input.referrerName, referrerUserId: input.referrerUserId, referrerContact: input.referrerContact, channel: input.channel,
    referredName: input.referredName, referredPhone: input.referredPhone, phoneDigits: phone.digits, consent: input.consent, notes: input.notes,
    branchId: owner.branchId, ownerId, status: "registered", createdBy: auth.context.userId, updatedBy: auth.context.userId,
  });
  await auditErp(tx, {
    tenantId, actorId: auth.context.userId, action: "erp.referral.registered", entityType: "erp_referral", entityId: id,
    metadata: { before: null, after: { status: "registered", version: 1, ownerId, branchId: owner.branchId, channel: input.channel, consent: input.consent } },
  });
  return id;
}

export async function registerReferral(raw: unknown) {
  await requireErpAccess("referrals", "erp_manage_referrals");
  return getDatabase().transaction(async (tx) => registerReferralInTransaction(tx, await requireErpAccess("referrals", "erp_manage_referrals", tx), raw));
}

async function leadConversionFacts(db: ErpDatabase, tenantId: string, leadId: string) {
  const [lead] = await db.select({ status: schema.leads.status }).from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, tenantId), isNull(schema.leads.deletedAt))).limit(1);
  if (!lead) return false;
  const [sale] = await db.select({ id: schema.sales.id }).from(schema.sales)
    .where(and(eq(schema.sales.tenantId, tenantId), eq(schema.sales.leadId, leadId), eq(schema.sales.status, "active"))).limit(1);
  return isConvertedLead(lead, !!sale);
}

async function assertLeadFree(db: ErpDatabase, tenantId: string, leadId: string, referralId: string) {
  const [other] = await db.select({ id: schema.erpReferrals.id }).from(schema.erpReferrals)
    .where(and(
      eq(schema.erpReferrals.tenantId, tenantId),
      eq(schema.erpReferrals.leadId, leadId),
      ne(schema.erpReferrals.id, referralId),
      notInArray(schema.erpReferrals.status, INACTIVE),
    )).limit(1);
  if (other) throw new ErpError(REFERRAL_LEAD_TAKEN_MESSAGE);
}

export async function changeReferralStatus(raw: unknown) {
  await requireErpAccess("referrals", "erp_manage_referrals");
  return withActiveLeadGuard(() => getDatabase().transaction(async (tx) => {
    const auth = await requireErpAccess("referrals", "erp_manage_referrals", tx);
    const input = referralStatusInputSchema.parse(raw);
    const tenantId = auth.context.tenantId;
    const current = await scopedReferral(tx, auth, input.id, true);
    if (current.version !== input.expectedVersion) throw new ErpError(STALE_MESSAGE);
    assertReferralTransition(current, input);
    let leadId = current.leadId;
    if (input.status === "duplicate") leadId = (await scopedLead(tx, auth, input.leadId ?? current.leadId ?? "")).id;
    if (input.status === "converted" && (!leadId || !await leadConversionFacts(tx, tenantId, leadId))) {
      throw new ErpError("A conversão exige o negócio vinculado convertido ou com venda ativa no CRM.");
    }
    if (input.status === "validated" && INACTIVE.includes(current.status)) {
      await lockContact(tx, tenantId, current.phoneDigits);
      const [active] = await tx.select({ id: schema.erpReferrals.id }).from(schema.erpReferrals).where(and(
        eq(schema.erpReferrals.tenantId, tenantId),
        eq(schema.erpReferrals.phoneDigits, current.phoneDigits),
        ne(schema.erpReferrals.id, current.id),
        notInArray(schema.erpReferrals.status, INACTIVE),
      )).limit(1);
      if (active) throw new ErpError("Este contato já tem outra indicação em andamento; fale com a gestão.");
      if (leadId) await assertLeadFree(tx, tenantId, leadId, current.id);
    }
    const version = current.version + 1;
    const lostReason = input.status === "lost" ? input.reason : "";
    await tx.update(schema.erpReferrals).set({ status: input.status, leadId, lostReason, version, updatedBy: auth.context.userId, updatedAt: new Date() })
      .where(and(eq(schema.erpReferrals.id, current.id), eq(schema.erpReferrals.tenantId, tenantId), eq(schema.erpReferrals.version, current.version)));
    await auditErp(tx, {
      tenantId, actorId: auth.context.userId, action: "erp.referral.status_changed", entityType: "erp_referral", entityId: current.id,
      metadata: {
        before: { status: current.status, version: current.version, leadId: current.leadId },
        after: { status: input.status, version, leadId },
        reason: input.reason || null,
      },
    });
    return current.id;
  }));
}

export async function linkReferralLead(raw: unknown) {
  await requireErpAccess("referrals", "erp_manage_referrals");
  return withActiveLeadGuard(() => getDatabase().transaction(async (tx) => {
    const auth = await requireErpAccess("referrals", "erp_manage_referrals", tx);
    const input = referralLinkInputSchema.parse(raw);
    const tenantId = auth.context.tenantId;
    const current = await scopedReferral(tx, auth, input.id, true);
    if (current.version !== input.expectedVersion) throw new ErpError(STALE_MESSAGE);
    if (!LINKABLE.includes(current.status)) throw new ErpError("Reabra a indicação antes de vincular um negócio.");
    const lead = await scopedLead(tx, auth, input.leadId);
    await assertLeadFree(tx, tenantId, lead.id, current.id);
    const status: ReferralStatus = "opportunity";
    const version = current.version + 1;
    await tx.update(schema.erpReferrals).set({ leadId: lead.id, status, version, updatedBy: auth.context.userId, updatedAt: new Date() })
      .where(and(eq(schema.erpReferrals.id, current.id), eq(schema.erpReferrals.tenantId, tenantId), eq(schema.erpReferrals.version, current.version)));
    await auditErp(tx, {
      tenantId, actorId: auth.context.userId, action: "erp.referral.lead_linked", entityType: "erp_referral", entityId: current.id,
      metadata: { before: { status: current.status, version: current.version, leadId: current.leadId }, after: { status, version, leadId: lead.id } },
    });
    return current.id;
  }));
}

/** Server search for the "search + add" picker; lost leads stay hidden unless the viewer asks for all. */
export async function searchReferralLeads(rawQuery: unknown, activeOnly = true) {
  const q = text(100).parse(rawQuery);
  if (q.length < 2) return [];
  const auth = await requireErpAccess("referrals", "erp_manage_referrals");
  const digits = q.replace(/\D/g, "");
  const byName = ilike(schema.leads.nome, `%${q.replace(/[%_\\]/g, "\\$&")}%`);
  const byPhone = digits.length >= 4 ? sql`${leadPhoneDigits} LIKE ${`%${digits}%`}` : undefined;
  const rows = await getDatabase()
    .select({ id: schema.leads.id, name: schema.leads.nome, telefone: schema.leads.telefone, status: schema.leads.status })
    .from(schema.leads)
    .where(and(
      eq(schema.leads.tenantId, auth.context.tenantId),
      isNull(schema.leads.deletedAt),
      erpScopeSql(auth.scope, schema.leads.branchId, schema.leads.corretorId),
      activeOnly ? ne(schema.leads.status, "lost") : undefined,
      or(byName, byPhone),
    ))
    .orderBy(desc(schema.leads.updatedAt)).limit(10);
  return rows.map((row) => ({ id: row.id, name: row.name, phoneEnd: row.telefone.replace(/\D/g, "").slice(-4), status: row.status }));
}

const statusLabel = (status: unknown) => REFERRAL_STATUS_LABELS[z.enum(REFERRAL_STATUSES).catch("registered").parse(status)];

/** History of one referral, newest first and paginated, loaded only when its drawer opens. */
export async function getReferralTimeline(raw: unknown) {
  const input = referralTimelineInputSchema.parse(raw);
  const auth = await requireErpAccess("referrals", "erp_manage_referrals");
  const db = getDatabase();
  const referral = await scopedReferral(db, auth, input.id);
  const where = and(
    eq(schema.erpEvents.tenantId, auth.context.tenantId),
    eq(schema.erpEvents.entityType, "erp_referral"),
    eq(schema.erpEvents.entityId, referral.id),
  );
  const [events, totals] = await Promise.all([
    db.select({
      id: schema.erpEvents.id, action: schema.erpEvents.action, metadata: schema.erpEvents.metadata, createdAt: schema.erpEvents.createdAt, actor: schema.user.name,
    }).from(schema.erpEvents).leftJoin(schema.user, eq(schema.user.id, schema.erpEvents.actorId))
      .where(where).orderBy(desc(schema.erpEvents.createdAt), desc(schema.erpEvents.id))
      .limit(REFERRAL_TIMELINE_PAGE_SIZE).offset((input.page - 1) * REFERRAL_TIMELINE_PAGE_SIZE),
    db.select({ value: count() }).from(schema.erpEvents).where(where),
  ]);
  const items = events.map((event) => {
    const metadata = event.metadata as { after?: { status?: string }; reason?: unknown };
    return {
      id: event.id,
      label: EVENT_LABELS[event.action] ?? "Atualização",
      status: metadata.after?.status ? statusLabel(metadata.after.status) : null,
      reason: typeof metadata.reason === "string" ? metadata.reason : null,
      actor: event.actor ?? "Pessoa removida",
      createdAt: event.createdAt.toISOString(),
    };
  });
  return { items, page: input.page, pageSize: REFERRAL_TIMELINE_PAGE_SIZE, total: Number(totals[0]?.value ?? 0) };
}

export async function getReferrals(rawFilters: unknown) {
  const filters = referralFiltersSchema.parse(rawFilters ?? {});
  const auth = await requireErpAccess("referrals", "erp_manage_referrals");
  const db = getDatabase();
  const tenantId = auth.context.tenantId;
  const search = filters.q.replace(/[%_\\]/g, "\\$&");
  const digits = filters.q.replace(/\D/g, "");
  const searchSql = filters.q ? or(
    ilike(schema.erpReferrals.referredName, `%${search}%`),
    ilike(schema.erpReferrals.referrerName, `%${search}%`),
    digits.length >= 4 ? ilike(schema.erpReferrals.phoneDigits, `%${digits}%`) : undefined,
  ) : undefined;
  const conditions = and(
    scoped(auth),
    filters.id ? eq(schema.erpReferrals.id, filters.id) : undefined,
    filters.status === "all" ? undefined : eq(schema.erpReferrals.status, filters.status),
    searchSql,
  );
  const leadJoin = and(eq(schema.leads.id, schema.erpReferrals.leadId), eq(schema.leads.tenantId, tenantId), isNull(schema.leads.deletedAt));
  const [rows, totals, byStatus] = await Promise.all([
    db.select({
      id: schema.erpReferrals.id, referrerName: schema.erpReferrals.referrerName, referrerContact: schema.erpReferrals.referrerContact,
      channel: schema.erpReferrals.channel, referredName: schema.erpReferrals.referredName, referredPhone: schema.erpReferrals.referredPhone,
      consent: schema.erpReferrals.consent, notes: schema.erpReferrals.notes, branchId: schema.erpReferrals.branchId, ownerId: schema.erpReferrals.ownerId,
      ownerName: schema.user.name, leadId: schema.erpReferrals.leadId, leadName: schema.leads.nome, status: schema.erpReferrals.status,
      lostReason: schema.erpReferrals.lostReason, version: schema.erpReferrals.version, createdAt: schema.erpReferrals.createdAt,
    }).from(schema.erpReferrals)
      .leftJoin(schema.user, eq(schema.user.id, schema.erpReferrals.ownerId))
      .leftJoin(schema.leads, leadJoin)
      .where(conditions).orderBy(desc(schema.erpReferrals.createdAt), schema.erpReferrals.id)
      .limit(PAGE_SIZE).offset((filters.page - 1) * PAGE_SIZE),
    db.select({ value: count() }).from(schema.erpReferrals).where(conditions),
    // Numbers on top of the screen: the viewer's whole scope, independent of the list filters.
    db.select({ status: schema.erpReferrals.status, value: count() }).from(schema.erpReferrals).where(scoped(auth)).groupBy(schema.erpReferrals.status),
  ]);
  const countOf = (statuses: readonly string[]) => byStatus.filter((row) => statuses.includes(row.status)).reduce((sum, row) => sum + Number(row.value), 0);
  const summary = {
    fresh: countOf(["registered", "validated"]),
    active: countOf(["contacting", "opportunity"]),
    converted: countOf(["converted"]),
    closed: countOf(["lost", "duplicate"]),
  };
  const access = await getErpEffectiveAccess(auth.context);
  const canManage = !auth.context.viewAs;
  const canAssignOwner = canManage && ["director", "manager"].includes(auth.context.role);
  const members = canManage ? await db.select({ id: schema.user.id, name: schema.user.name }).from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
    .where(and(
      eq(schema.tenantMemberships.tenantId, tenantId),
      eq(schema.tenantMemberships.status, "active"),
      erpScopeSql(auth.scope, schema.tenantMemberships.branchId, schema.tenantMemberships.userId),
    ))
    .orderBy(schema.user.name).limit(500) : [];
  await auditErp(db, {
    tenantId, actorId: auth.context.viewAs?.adminUserId ?? auth.context.userId, action: "erp.referrals.viewed", entityType: "erp_access", entityId: "referrals",
    metadata: { count: rows.length, page: filters.page, status: filters.status },
  });
  const canOpenLead = (row: { leadId: string | null; branchId: string | null }) => !!row.leadId
    && canAccessRoute(access, getRouteDefinition(`/leads/${row.leadId}`))
    && (auth.context.role !== "manager" || auth.context.branchId === row.branchId)
    && (auth.context.role !== "supervisor" || auth.context.supervisorTeamScope === true);
  return {
    filters, total: Number(totals[0]?.value ?? 0), pageSize: PAGE_SIZE, summary, canManage, canAssignOwner, members, currentUserId: auth.context.userId,
    statusOptions: REFERRAL_STATUSES.map((value) => ({ value, label: REFERRAL_STATUS_LABELS[value] })),
    channelOptions: REFERRAL_CHANNELS.map((value) => ({ value, label: REFERRAL_CHANNEL_LABELS[value] })),
    rows: rows.map((row) => {
      const status = z.enum(REFERRAL_STATUSES).catch("registered").parse(row.status);
      const channel = z.enum(REFERRAL_CHANNELS).catch("outro").parse(row.channel);
      return {
        ...row, status, statusLabel: REFERRAL_STATUS_LABELS[status], channelLabel: REFERRAL_CHANNEL_LABELS[channel], createdAt: row.createdAt.toISOString(),
        referrerContact: canManage ? row.referrerContact : "",
        nextStatuses: canManage ? transitions[status].map((value) => ({ value, label: REFERRAL_STATUS_LABELS[value] })) : [],
        canLink: canManage && LINKABLE.includes(status),
        canOpenLead: canOpenLead(row),
      };
    }),
  };
}
