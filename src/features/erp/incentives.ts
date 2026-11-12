import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { getDatabase, schema } from "@/shared/db";
import { auditErp, canSeeAgencyBooks, getErpEffectiveAccess, requireErpAccess, type ErpDatabase, type ErpTransaction } from "./access";
import { assertIndependentReview, ErpError, recordIdSchema } from "./contracts";
import { lockErpTenant } from "./finance";
import { scopeIncludes } from "./scope";
import type { ErpAccess } from "./records";
import {
  INCENTIVE_METRICS, INCENTIVE_STATUSES, INCENTIVE_TIME_ZONE, incentiveCampaignInputSchema, incentiveDigestInput, incentiveSnapshotSchema,
  rankIncentiveFacts, todayInSaoPaulo, visibleRanking, type IncentiveCampaignInput, type IncentiveFact, type IncentiveMetric, type IncentiveSnapshot, type IncentiveStatus,
} from "./incentive-core";

const MAX_FACTS = 20_000;
const campaigns = schema.erpIncentiveCampaigns;
const results = schema.erpIncentiveResults;
type Campaign = typeof campaigns.$inferSelect;

const versionedSchema = z.object({ id: recordIdSchema, expectedVersion: z.number().int().positive() }).strict();
const updateSchema = z.object({ id: recordIdSchema, expectedVersion: z.number().int().positive(), campaign: z.unknown() }).strict();
const cancelSchema = versionedSchema.extend({ reason: z.string().trim().min(5, "Explique o motivo do cancelamento.").max(500) });
const runSchema = versionedSchema.extend({ kind: z.enum(["preliminary", "final"]) });
const contestSchema = z.object({ resultId: recordIdSchema, note: z.string().trim().min(5, "Descreva a contestação com pelo menos 5 caracteres.").max(1000) }).strict();

export function incentiveDigest(snapshot: IncentiveSnapshot) {
  return createHash("sha256").update(incentiveDigestInput(snapshot)).digest("hex");
}

async function incentiveTransaction<T>(work: (tx: ErpTransaction, auth: ErpAccess) => Promise<T>) {
  // Resolve the session before reserving a pooled transaction socket; recheck inside the tenant lock.
  const initial = await requireErpAccess("incentives", "erp_manage_incentives");
  return getDatabase().transaction(async (tx) => {
    await lockErpTenant(tx, initial.context.tenantId);
    const auth = await requireErpAccess("incentives", "erp_manage_incentives", tx);
    if (auth.context.viewAs) throw new ErpError("A visualização de suporte é somente leitura.");
    return work(tx, auth);
  });
}

function textArray(values: readonly string[]) {
  return sql`ARRAY[${sql.join(values.map((value) => sql`${value}`), sql`, `)}]::text[]`;
}

/** Units a viewer can relate to; campaigns with no explicit unit cover the whole company. */
function viewerUnits(auth: ErpAccess): readonly string[] | "all" {
  const scope = auth.scope;
  if (scope.mode === "tenant") return "all";
  if (scope.mode === "units") return scope.unitIds;
  if (scope.mode === "owners") return scope.unitIds ?? (auth.context.branchId ? [auth.context.branchId] : []);
  return [];
}
function visibleCampaignSql(auth: ErpAccess, manager: boolean): SQL {
  const units = viewerUnits(auth);
  const coverage = units === "all" ? sql`true` : units.length ? sql`(cardinality(${campaigns.branchIds}) = 0 OR ${campaigns.branchIds} && ${textArray(units)})` : sql`cardinality(${campaigns.branchIds}) = 0`;
  return manager ? coverage : sql`${coverage} AND ${campaigns.approvedAt} IS NOT NULL`;
}

function assertCampaignInScope(auth: ErpAccess, branchIds: readonly string[]) {
  const scope = auth.scope;
  if (scope.mode === "tenant") return;
  if (scope.mode === "units" && branchIds.length && branchIds.every((id) => scope.unitIds.includes(id))) return;
  throw new ErpError("Esta campanha abrange unidades fora do seu escopo.");
}

async function resolveBranches(db: ErpDatabase, auth: ErpAccess, requested: readonly string[]) {
  const scope = auth.scope;
  if (scope.mode !== "tenant" && scope.mode !== "units") throw new ErpError("Campanhas exigem escopo de unidade ou empresa.");
  // Empty means every unit in the preparer's scope; a unit-scoped preparer gets them listed explicitly.
  if (!requested.length) return scope.mode === "tenant" ? [] : [...scope.unitIds].sort();
  if (scope.mode === "units" && requested.some((id) => !scope.unitIds.includes(id))) throw new ErpError("Selecione apenas unidades do seu escopo.");
  const rows = await db.select({ id: schema.branches.id }).from(schema.branches).where(and(eq(schema.branches.tenantId, auth.context.tenantId), inArray(schema.branches.id, [...requested])));
  if (rows.length !== requested.length) throw new ErpError("Unidade não encontrada no seu escopo.");
  return [...requested].sort();
}

async function lockedCampaign(tx: ErpTransaction, auth: ErpAccess, id: string, expectedVersion: number) {
  const [campaign] = await tx.select().from(campaigns).where(and(eq(campaigns.tenantId, auth.context.tenantId), eq(campaigns.id, id))).limit(1).for("update");
  if (!campaign) throw new ErpError("Campanha não encontrada no seu escopo.");
  assertCampaignInScope(auth, campaign.branchIds);
  if (campaign.version !== expectedVersion) throw new ErpError("A campanha mudou. Atualize a página e confira novamente.");
  return campaign;
}

function campaignValues(input: IncentiveCampaignInput, branchIds: string[]) {
  return { name: input.name, regulation: input.regulation, metric: input.metric, startsOn: input.startsOn, endsOn: input.endsOn, branchIds, prize: input.prize, showNames: input.showNames };
}

export async function createIncentiveCampaign(raw: unknown) {
  const input = incentiveCampaignInputSchema.parse(raw);
  return incentiveTransaction(async (tx, auth) => {
    const branchIds = await resolveBranches(tx, auth, input.branchIds);
    const id = crypto.randomUUID();
    await tx.insert(campaigns).values({ id, tenantId: auth.context.tenantId, ...campaignValues(input, branchIds), status: "draft", version: 1, createdBy: auth.context.userId });
    await auditErp(tx, { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: "erp.incentive.created", entityType: "erp_incentive_campaign", entityId: id, metadata: { version: 1, ...campaignValues(input, branchIds) } });
    return id;
  });
}

/** Only drafts change; the person who prepares the new version becomes its preparer, so they cannot approve it. */
export async function updateIncentiveCampaign(raw: unknown) {
  const { id, expectedVersion, campaign: rawCampaign } = updateSchema.parse(raw);
  const input = incentiveCampaignInputSchema.parse(rawCampaign);
  return incentiveTransaction(async (tx, auth) => {
    const current = await lockedCampaign(tx, auth, id, expectedVersion);
    if (current.status !== "draft") throw new ErpError("Somente rascunhos podem ser editados. Para mudar o regulamento, cancele e crie outra campanha.");
    const branchIds = await resolveBranches(tx, auth, input.branchIds);
    const version = current.version + 1;
    await tx.update(campaigns).set({ ...campaignValues(input, branchIds), version, createdBy: auth.context.userId }).where(and(eq(campaigns.tenantId, auth.context.tenantId), eq(campaigns.id, id)));
    await auditErp(tx, { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: "erp.incentive.updated", entityType: "erp_incentive_campaign", entityId: id, metadata: { version, previous: { version: current.version, preparedBy: current.createdBy }, ...campaignValues(input, branchIds) } });
    return id;
  });
}

export async function approveIncentiveCampaign(raw: unknown) {
  const input = versionedSchema.parse(raw);
  return incentiveTransaction(async (tx, auth) => {
    const current = await lockedCampaign(tx, auth, input.id, input.expectedVersion);
    if (current.status !== "draft") throw new ErpError("Somente rascunhos podem ser aprovados.");
    assertIndependentReview(auth.context.userId, current.createdBy);
    await tx.update(campaigns).set({ status: "approved", approvedBy: auth.context.userId, approvedAt: new Date() }).where(and(eq(campaigns.tenantId, auth.context.tenantId), eq(campaigns.id, current.id)));
    await auditErp(tx, { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: "erp.incentive.approved", entityType: "erp_incentive_campaign", entityId: current.id, metadata: { version: current.version, preparedBy: current.createdBy } });
    return current.id;
  });
}

export async function cancelIncentiveCampaign(raw: unknown) {
  const input = cancelSchema.parse(raw);
  return incentiveTransaction(async (tx, auth) => {
    const current = await lockedCampaign(tx, auth, input.id, input.expectedVersion);
    if (current.status !== "draft" && current.status !== "approved") throw new ErpError("Esta campanha já foi encerrada ou cancelada.");
    await tx.update(campaigns).set({ status: "cancelled", reason: input.reason }).where(and(eq(campaigns.tenantId, auth.context.tenantId), eq(campaigns.id, current.id)));
    await auditErp(tx, { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: "erp.incentive.cancelled", entityType: "erp_incentive_campaign", entityId: current.id, metadata: { version: current.version, previousStatus: current.status, reason: input.reason } });
    return current.id;
  });
}

async function eligibleFacts(db: ErpDatabase, tenantId: string, campaign: Pick<Campaign, "metric" | "startsOn" | "endsOn" | "branchIds">): Promise<IncentiveFact[]> {
  const metric = z.enum(INCENTIVE_METRICS).parse(campaign.metric);
  if (metric === "implanted_count") {
    const branch = sql<string | null>`coalesce(${schema.erpImplantations.branchId}, ${schema.leads.branchId})`;
    const rows = await db.select({ id: schema.erpImplantations.id, brokerId: schema.erpImplantations.brokerId, branchId: branch, at: sql<string>`${schema.erpImplantations.coverageStartsOn}::text` })
      .from(schema.erpImplantations).innerJoin(schema.leads, and(eq(schema.leads.id, schema.erpImplantations.leadId), eq(schema.leads.tenantId, tenantId)))
      .where(and(eq(schema.erpImplantations.tenantId, tenantId), eq(schema.erpImplantations.status, "implanted"),
        sql`${schema.erpImplantations.coverageStartsOn} BETWEEN ${campaign.startsOn}::date AND ${campaign.endsOn}::date`,
        campaign.branchIds.length ? sql`${branch} IN (${sql.join(campaign.branchIds.map((id) => sql`${id}`), sql`, `)})` : undefined))
      .orderBy(schema.erpImplantations.id).limit(MAX_FACTS + 1);
    if (rows.length > MAX_FACTS) throw new ErpError("A apuração excede o volume permitido. Solicite processamento em lote ao administrador.");
    return rows.map((row) => ({ ...row, value: 1 }));
  }
  const rows = await db.select({ id: schema.sales.id, brokerId: schema.sales.brokerId, branchId: schema.leads.branchId,
    at: sql<string>`to_char(${schema.sales.saleDate} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
    cents: sql<string>`round(coalesce(${schema.sales.approvedValue}, ${schema.sales.saleValue}) * 100)::bigint::text` })
    .from(schema.sales).innerJoin(schema.leads, and(eq(schema.leads.id, schema.sales.leadId), eq(schema.leads.tenantId, tenantId)))
    .where(and(eq(schema.sales.tenantId, tenantId), eq(schema.sales.status, "active"),
      sql`(${schema.sales.saleDate} AT TIME ZONE ${INCENTIVE_TIME_ZONE})::date BETWEEN ${campaign.startsOn}::date AND ${campaign.endsOn}::date`,
      campaign.branchIds.length ? inArray(schema.leads.branchId, campaign.branchIds) : undefined))
    .orderBy(schema.sales.id).limit(MAX_FACTS + 1);
  if (rows.length > MAX_FACTS) throw new ErpError("A apuração excede o volume permitido. Solicite processamento em lote ao administrador.");
  return rows.map(({ cents, ...row }) => {
    const value = metric === "sales_count" ? 1 : Number(cents);
    if (!Number.isSafeInteger(value) || value < 0) throw new ErpError("Uma venda tem valor inválido para apuração. Confira o cadastro da venda.");
    return { ...row, value };
  });
}

export function buildIncentiveSnapshot(campaign: Pick<Campaign, "id" | "version" | "metric" | "startsOn" | "endsOn" | "branchIds">, facts: readonly IncentiveFact[], calculatedAt = new Date()): IncentiveSnapshot {
  return { version: 1, campaignId: campaign.id, campaignVersion: campaign.version, metric: z.enum(INCENTIVE_METRICS).parse(campaign.metric),
    period: { startsOn: campaign.startsOn, endsOn: campaign.endsOn, timeZone: INCENTIVE_TIME_ZONE }, branchIds: [...campaign.branchIds].sort(),
    rows: rankIncentiveFacts(facts), calculatedAt: calculatedAt.toISOString() };
}

export async function runIncentiveCalculation(raw: unknown) {
  const input = runSchema.parse(raw);
  return incentiveTransaction(async (tx, auth) => {
    const campaign = await lockedCampaign(tx, auth, input.id, input.expectedVersion);
    if (campaign.status !== "approved") throw new ErpError("Somente campanhas aprovadas e não encerradas podem ser apuradas.");
    if (input.kind === "final" && todayInSaoPaulo() <= campaign.endsOn) throw new ErpError("A apuração final só pode ser feita depois do último dia da campanha.");
    const snapshot = buildIncentiveSnapshot(campaign, await eligibleFacts(tx, auth.context.tenantId, campaign));
    const digest = incentiveDigest(snapshot); const id = crypto.randomUUID();
    await tx.insert(results).values({ id, tenantId: auth.context.tenantId, campaignId: campaign.id, kind: input.kind, campaignVersion: campaign.version, snapshot, digest, createdBy: auth.context.userId });
    if (input.kind === "final") await tx.update(campaigns).set({ status: "closed" }).where(and(eq(campaigns.tenantId, auth.context.tenantId), eq(campaigns.id, campaign.id)));
    await auditErp(tx, { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: `erp.incentive.calculated.${input.kind}`, entityType: "erp_incentive_campaign", entityId: campaign.id, metadata: { resultId: id, digest, campaignVersion: campaign.version, participants: snapshot.rows.length, facts: snapshot.rows.reduce((total, row) => total + row.facts.length, 0) } });
    return id;
  });
}

export async function contestIncentiveResult(raw: unknown) {
  const input = contestSchema.parse(raw);
  const auth = await requireErpAccess("incentives", "erp_view_analytics");
  if (auth.context.viewAs) throw new ErpError("A visualização de suporte é somente leitura.");
  const db = getDatabase();
  const [row] = await db.select({ result: results, campaign: campaigns }).from(results)
    .innerJoin(campaigns, and(eq(campaigns.tenantId, auth.context.tenantId), eq(campaigns.id, results.campaignId)))
    .where(and(eq(results.tenantId, auth.context.tenantId), eq(results.id, input.resultId), visibleCampaignSql(auth, false))).limit(1);
  if (!row) throw new ErpError("Apuração não encontrada no seu escopo.");
  const participant = incentiveSnapshotSchema.parse(row.result.snapshot).rows.find((entry) => entry.brokerId === auth.context.userId);
  if (!participant) throw new ErpError("Somente participantes desta apuração podem contestá-la.");
  // Contestation is a record for review: it never changes the stored result.
  await auditErp(db, { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: "erp.incentive.contested", entityType: "erp_incentive_result", entityId: row.result.id, metadata: { campaignId: row.campaign.id, note: input.note, position: participant.position, digest: row.result.digest } });
  return row.result.id;
}

async function viewer() {
  const auth = await requireErpAccess("incentives", "erp_view_analytics");
  const access = await getErpEffectiveAccess(auth.context);
  const canManage = !auth.context.viewAs && access.capabilities.has("erp_manage_incentives") && (auth.scope.mode === "tenant" || auth.scope.mode === "units");
  return { auth, canManage };
}

async function scopedBranches(auth: ErpAccess) {
  const scope = auth.scope;
  if (scope.mode !== "tenant" && scope.mode !== "units") return [];
  return getDatabase().select({ id: schema.branches.id, name: schema.branches.name }).from(schema.branches)
    .where(and(eq(schema.branches.tenantId, auth.context.tenantId), eq(schema.branches.status, "active"), scope.mode === "units" ? inArray(schema.branches.id, [...scope.unitIds]) : undefined))
    .orderBy(schema.branches.name).limit(200);
}

function campaignView(campaign: Campaign) {
  return { id: campaign.id, name: campaign.name, regulation: campaign.regulation, metric: campaign.metric as IncentiveMetric, startsOn: campaign.startsOn, endsOn: campaign.endsOn,
    branchIds: campaign.branchIds, prize: campaign.prize, showNames: campaign.showNames, status: z.enum(INCENTIVE_STATUSES).parse(campaign.status) as IncentiveStatus,
    reason: campaign.reason, version: campaign.version };
}

export async function getIncentiveCampaigns() {
  const { auth, canManage } = await viewer();
  const lastCalculatedAt = sql<string | null>`(SELECT max(r.created_at)::text FROM erp_incentive_results r WHERE r.tenant_id = ${campaigns.tenantId} AND r.campaign_id = ${campaigns.id})`;
  const rows = await getDatabase().select({ campaign: campaigns, lastCalculatedAt }).from(campaigns)
    .where(and(eq(campaigns.tenantId, auth.context.tenantId), visibleCampaignSql(auth, canManage))).orderBy(desc(campaigns.startsOn), campaigns.id).limit(100);
  return { canManage, today: todayInSaoPaulo(), branches: canManage ? await scopedBranches(auth) : [], rows: rows.map((row) => ({ ...campaignView(row.campaign), lastCalculatedAt: row.lastCalculatedAt })) };
}

export async function getIncentiveCampaign(rawId: unknown) {
  const id = recordIdSchema.parse(rawId);
  const { auth, canManage } = await viewer();
  const db = getDatabase(); const tenantId = auth.context.tenantId;
  const [campaign] = await db.select().from(campaigns).where(and(eq(campaigns.tenantId, tenantId), eq(campaigns.id, id), visibleCampaignSql(auth, canManage))).limit(1);
  if (!campaign) throw new ErpError("Campanha não encontrada no seu escopo.");
  const history = await db.select({ id: results.id, kind: results.kind, campaignVersion: results.campaignVersion, digest: results.digest, createdAt: results.createdAt, createdBy: results.createdBy })
    .from(results).where(and(eq(results.tenantId, tenantId), eq(results.campaignId, campaign.id))).orderBy(desc(results.createdAt), desc(results.id)).limit(50);
  const latestId = history[0]?.id;
  const [latest] = latestId ? await db.select({ snapshot: results.snapshot }).from(results).where(and(eq(results.tenantId, tenantId), eq(results.id, latestId))).limit(1) : [];
  const snapshot = latest ? incentiveSnapshotSchema.parse(latest.snapshot) : null;
  const showNames = campaign.showNames || canManage;
  const contestedRows = await db.select({ id: schema.erpEvents.id, actorId: schema.erpEvents.actorId, resultId: schema.erpEvents.entityId, metadata: schema.erpEvents.metadata, createdAt: schema.erpEvents.createdAt })
    .from(schema.erpEvents).where(and(eq(schema.erpEvents.tenantId, tenantId), eq(schema.erpEvents.action, "erp.incentive.contested"), sql`${schema.erpEvents.metadata}->>'campaignId' = ${campaign.id}`,
      canManage ? undefined : eq(schema.erpEvents.actorId, auth.context.userId))).orderBy(desc(schema.erpEvents.createdAt)).limit(100);
  const people = [...new Set([campaign.createdBy, campaign.approvedBy, ...history.map((row) => row.createdBy), ...contestedRows.map((row) => row.actorId), ...(showNames && snapshot ? snapshot.rows.map((row) => row.brokerId) : [])].filter((value): value is string => !!value))];
  const names = new Map(people.length ? (await db.select({ id: schema.user.id, name: schema.user.name }).from(schema.user).innerJoin(schema.tenantMemberships, and(eq(schema.tenantMemberships.userId, schema.user.id), eq(schema.tenantMemberships.tenantId, tenantId))).where(inArray(schema.user.id, people))).map((row) => [row.id, row.name] as const) : []);
  const branchNames = campaign.branchIds.length ? await db.select({ id: schema.branches.id, name: schema.branches.name }).from(schema.branches).where(and(eq(schema.branches.tenantId, tenantId), inArray(schema.branches.id, campaign.branchIds))) : [];
  const valueVisible = canSeeAgencyBooks(auth.context) && auth.scope.mode !== "owners";
  const ranking = snapshot ? visibleRanking(snapshot.rows, { userId: auth.context.userId, showNames, metric: snapshot.metric, names,
    canSeeValue: (row) => valueVisible && scopeIncludes(auth.scope, { branchId: row.branchId, ownerId: row.brokerId }) }) : [];
  const today = todayInSaoPaulo(); const preparedByViewer = campaign.createdBy === auth.context.userId;
  await auditErp(db, { tenantId, actorId: auth.context.viewAs?.adminUserId ?? auth.context.userId, action: "erp.incentive.viewed", entityType: "erp_incentive_campaign", entityId: campaign.id, metadata: { resultId: latestId ?? null } });
  return {
    campaign: { ...campaignView(campaign), branchNames: branchNames.map((row) => row.name).sort(), preparedBy: names.get(campaign.createdBy) ?? "Pessoa removida", approvedBy: campaign.approvedBy ? names.get(campaign.approvedBy) ?? "Pessoa removida" : null },
    today, canManage, branches: canManage ? await scopedBranches(auth) : [],
    can: {
      edit: canManage && campaign.status === "draft",
      approve: canManage && campaign.status === "draft" && !preparedByViewer,
      preliminary: canManage && campaign.status === "approved",
      final: canManage && campaign.status === "approved" && today > campaign.endsOn,
      cancel: canManage && (campaign.status === "draft" || campaign.status === "approved"),
      contest: !auth.context.viewAs && !!snapshot?.rows.some((row) => row.brokerId === auth.context.userId),
    },
    preparedByViewer,
    latest: snapshot && history[0] ? { id: history[0].id, kind: history[0].kind, createdAt: history[0].createdAt.toISOString(), campaignVersion: snapshot.campaignVersion, metric: snapshot.metric, ranking } : null,
    history: history.map((row) => ({ id: row.id, kind: row.kind, campaignVersion: row.campaignVersion, digest: row.digest.slice(0, 12), createdAt: row.createdAt.toISOString(), createdBy: names.get(row.createdBy) ?? "Pessoa removida" })),
    contestations: contestedRows.map((row) => ({ id: row.id, resultId: row.resultId, note: typeof row.metadata.note === "string" ? row.metadata.note : "", position: typeof row.metadata.position === "number" ? row.metadata.position : null, createdAt: row.createdAt.toISOString(), author: row.actorId === auth.context.userId ? "Você" : names.get(row.actorId) ?? "Participante" })),
  };
}
