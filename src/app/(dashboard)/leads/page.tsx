import { and, count, desc, eq, gte, ilike, inArray, notInArray, isNull, isNotNull, lt, ne, or, sql } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

import { ManualLeadSheet } from "./_components/manual-lead-sheet";
import { BulkLeadImportDialog } from "./_components/bulk-lead-import-dialog";
import { LeadsLiveSync } from "./_components/leads-live-sync";
import { LeadsFilters } from "./_components/leads-filters";
import { LeadsPagination } from "./_components/leads-pagination";
import { LeadsWorkspace } from "./leads-workspace";
import { LeadsHeaderActions } from "./_components/leads-header-actions";
import { WifiHigh, Plus, Target } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { DashboardHeader } from "@/components/dashboard-header";
import { NextUrgentLeadButton } from "@/components/next-urgent-lead-button";
import { getUrgentLeadForUser } from "@/features/leads/queries";
import { ContextNote } from "@/components/ui/context-note";
import { getSystemSettings } from "@/features/system-settings/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { hasEffectiveCapability } from "@/features/custom-roles/service";
import { getExperienceMode } from "@/features/broker-workspace/experience-mode";
import { LightLeadsList, type LightLeadItem } from "@/features/broker-workspace/components/light-leads-list";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getDatabase, schema } from "@/shared/db";
import { listAvailableCatalogPlans } from "@/features/global-catalog/queries";
import { parsePeriod, periodStart } from "@/shared/period";
import { resolveMetaCampaignEligibility } from "@/features/leads/meta-campaign-eligibility";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    attention?: string;
    status?: string;
    search?: string;
    branch?: string;
    new?: string;
    tipo?: string;
    origem?: string;
    qualification?: string;
    corretor?: string;
    page?: string;
    pageSize?: string;
    period?: string;
    eligibleCampaigns?: string;
  }>;
}) {
  await connection();
  const context = await getRequiredTenantContext();
  const capabilityPromise = hasEffectiveCapability({
    tenantId: context.tenantId,
    role: context.role,
    jobTitle: context.jobTitle,
    customRoleId: context.customRoleId ?? null,
    permission: "acessar_leads",
  });
  const experienceModePromise =
    context.role === "broker" ? getExperienceMode(context) : Promise.resolve("NORMAL" as const);
  if (
    !(await capabilityPromise)
  )
    redirect("/access-denied");

  // ─── Modo Lite (corretor) ──────────────────────────────────────────────
  // Mantém a experiência simples do dashboard lite: lista leve com busca,
  // filtros de situação e acesso direto ao atendimento. As ações de aceitar,
  // abrir e atualizar continuam funcionando no detalhe do lead.
  if (context.role === "broker" && (await experienceModePromise) === "LIGHT") {
    const [slaRow] = await getDatabase()
      .select({ minutes: schema.tenants.slaFirstContactMinutes })
      .from(schema.tenants)
      .where(eq(schema.tenants.id, context.tenantId))
      .limit(1);
    const lightSlaMinutes = Math.max(1, Number(slaRow?.minutes ?? 15));

    const lightLeads = await getDatabase()
      .select({
        id: schema.leads.id,
        nome: schema.leads.nome,
        telefone: schema.leads.telefone,
        status: schema.leads.status,
        qualificationStatus: schema.leads.qualificationStatus,
        qualificationDetails: schema.leads.qualificationDetails,
        planName: schema.carrierPlans.name,
        createdAt: schema.leads.createdAt,
        stageEnteredAt: schema.leads.stageEnteredAt,
        assignedAt: schema.leads.assignedAt,
      })
      .from(schema.leads)
      .leftJoin(schema.carrierPlans, eq(schema.leads.planId, schema.carrierPlans.id))
      .where(
        and(
          eq(schema.leads.tenantId, context.tenantId),
          eq(schema.leads.corretorId, context.userId),
          isNull(schema.leads.deletedAt),
          or(
            ne(schema.leads.status, "distributed"),
            isNotNull(schema.leads.firstContactAt),
            isNull(schema.leads.assignedAt),
            gte(
              schema.leads.assignedAt,
              sql`now() - (${lightSlaMinutes} * interval '1 minute')`
            )
          )
        )
      )
      .orderBy(desc(schema.leads.createdAt))
      .limit(500);

    const lightPendingTasks = lightLeads.length
      ? await getDatabase()
          .select({ leadId: schema.leadTasks.leadId, dueAt: schema.leadTasks.dueAt })
          .from(schema.leadTasks)
          .where(
            and(
              eq(schema.leadTasks.tenantId, context.tenantId),
              inArray(schema.leadTasks.leadId, lightLeads.map((l) => l.id)),
              isNull(schema.leadTasks.completedAt),
              isNotNull(schema.leadTasks.dueAt)
            )
          )
      : [];

    const earliestTaskDue = new Map<string, Date>();
    for (const task of lightPendingTasks) {
      if (task.leadId && task.dueAt) {
        const existing = earliestTaskDue.get(task.leadId);
        if (!existing || task.dueAt.getTime() < existing.getTime()) {
          earliestTaskDue.set(task.leadId, task.dueAt);
        }
      }
    }

    const lightItems: LightLeadItem[] = lightLeads.map((lead) => {
      const details =
        lead.qualificationDetails && typeof lead.qualificationDetails === "object" && !Array.isArray(lead.qualificationDetails)
          ? (lead.qualificationDetails as Record<string, unknown>)
          : {};
      const readStr = (key: string) => (typeof details[key] === "string" ? details[key] : null);
      const rawLives = readStr("qtdVidas");
      const livesCount = rawLives && rawLives.trim() ? Number(rawLives) : null;
      const slaDeadline =
        (lead.status === "new" || lead.status === "distributed") && lead.assignedAt
          ? new Date(lead.assignedAt.getTime() + lightSlaMinutes * 60 * 1000)
          : null;
      const dueAt = slaDeadline ?? earliestTaskDue.get(lead.id) ?? null;
      return {
        id: lead.id,
        name: lead.nome,
        phone: lead.telefone,
        status: lead.status,
        qualificationStatus: lead.qualificationStatus,
        productName: lead.planName ?? null,
        livesCount: livesCount && Number.isFinite(livesCount) ? livesCount : null,
        city: readStr("cidade"),
        summary: readStr("resumoAtendimento") ?? readStr("resumoNecessidade"),
        createdAt: lead.createdAt,
        updatedAt: lead.stageEnteredAt,
        dueAt,
        isOverdue: dueAt ? dueAt.getTime() < Date.now() : false,
      };
    });

    return <LightLeadsList leads={lightItems} />;
  }

  const filters = await searchParams;
  const db = getDatabase();

  const period = parsePeriod(filters.period);
  const eligibleCampaignsOnly = filters.eligibleCampaigns === "1";
  const systemSettingsPromise = getSystemSettings([
        "feature_central_atencao_stagnant_days",
        "feature_lead_management_actions_enabled",
        ...(eligibleCampaignsOnly ? [`meta_lead_capture_mode_${context.tenantId}`] : []),
      ]);
  const userBranchPromise = context.branchId
    ? db
        .select({ name: schema.branches.name })
        .from(schema.branches)
        .where(and(eq(schema.branches.id, context.branchId), eq(schema.branches.tenantId, context.tenantId)))
        .limit(1)
    : Promise.resolve([]);
  const [systemSettingRows, userBranchRows] = await Promise.all([
    systemSettingsPromise,
    userBranchPromise,
  ]);
  const systemSettings = new Map(systemSettingRows.map((setting) => [setting.key, setting.value]));

  // Pagination parameters
  const pageParam = parseInt(filters.page ?? "1", 10);
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const pageSizeParam = parseInt(filters.pageSize ?? "20", 10);
  const pageSize = Number.isInteger(pageSizeParam) && [10, 20, 50, 100].includes(pageSizeParam) ? pageSizeParam : 20;

  const configuredStagnantDays = Number(systemSettings.get("feature_central_atencao_stagnant_days") ?? 3);
  const stagnantDays =
    Number.isInteger(configuredStagnantDays) && configuredStagnantDays >= 1 && configuredStagnantDays <= 30
      ? configuredStagnantDays
      : 3;
  const attention =
    filters.attention === "unworked" || filters.attention === "stalled"
      ? filters.attention
      : filters.status === "stalled" || filters.status === "unworked"
      ? (filters.status as "unworked" | "stalled")
      : null;
  const stalledSince = sql<Date>`now() - (${stagnantDays} * interval '1 day')`;
  const attentionNote =
    attention === "unworked"
      ? "Exibindo leads novos ou distribuídos que ainda aguardam o primeiro atendimento."
      : attention === "stalled"
      ? `Exibindo leads ativos sem avanço de etapa há mais de ${stagnantDays} dias.`
      : null;
  const isValidStatus = filters.status && (schema.leadStatusValues as readonly string[]).includes(filters.status);
  const statusFilter =
    attention === "unworked"
      ? and(inArray(schema.leads.status, ["new", "distributed"]), isNull(schema.leads.serviceStartedAt))
      : attention === "stalled"
      ? and(
          inArray(schema.leads.status, [
            "in_contact",
            "quote_sent",
            "negotiation",
            "documentation_pending",
            "under_analysis",
          ]),
          lt(schema.leads.stageEnteredAt, stalledSince)
        )
      : isValidStatus
      ? eq(schema.leads.status, filters.status as (typeof schema.leadStatusValues)[number])
      : null;
  const searchFilter = filters.search
    ? or(ilike(schema.leads.nome, `%${filters.search}%`), ilike(schema.leads.telefone, `%${filters.search}%`))
    : null;

  const expiredUnworkedBrokerFilter =
    context.role === "broker"
      ? or(
          ne(schema.leads.status, "distributed"),
          isNotNull(schema.leads.firstContactAt),
          isNull(schema.leads.assignedAt),
          gte(
            schema.leads.assignedAt,
            sql`now() - (COALESCE(NULLIF(${schema.tenants.slaFirstContactMinutes}, ''), '15')::integer * interval '1 minute')`
          )
        )
      : null;

  let isMatrix = false;
  if (context.branchId) {
    const [userBranch] = userBranchRows;
    isMatrix = userBranch?.name?.toLowerCase() === "matriz";
  } else {
    isMatrix = true;
  }

  const isMarketing = context.jobTitle === "marketing";

  const branchFilter = isMarketing
    ? isMatrix
      ? filters.branch
        ? eq(schema.leads.branchId, filters.branch)
        : null
      : eq(schema.leads.branchId, context.branchId!)
    : context.role === "manager" && context.branchId
    ? eq(schema.leads.branchId, context.branchId)
    : context.role === "broker"
    ? eq(schema.leads.corretorId, context.userId)
    : filters.branch
    ? eq(schema.leads.branchId, filters.branch)
    : null;

  const tipoFilter = filters.tipo === "PF"
    ? eq(schema.leads.tipo, "PF")
    : filters.tipo === "PJ"
      ? inArray(schema.leads.tipo, ["PJ", "PME"])
      : filters.tipo === "PME"
        ? eq(schema.leads.tipo, "PME")
        : null;
  const origemFilter = filters.origem === "manual" || filters.origem === "webhook" ? eq(schema.leads.origem, filters.origem) : null;
  const qualificationFilter = filters.qualification ? eq(schema.leads.qualificationStatus, filters.qualification) : null;
  const corretorFilter = filters.corretor ? eq(schema.leads.corretorId, filters.corretor) : null;
  const periodFilter = filters.period ? gte(schema.leads.createdAt, periodStart(period)) : null;
  const metaCampaignEligibility = eligibleCampaignsOnly
      ? await Promise.all([
        Promise.resolve(systemSettings.get(`meta_lead_capture_mode_${context.tenantId}`) ?? null),
        db.select({ campaignId: schema.metaCampaignQueueRoutes.campaignId, enabled: schema.metaCampaignQueueRoutes.enabled })
          .from(schema.metaCampaignQueueRoutes)
          .where(eq(schema.metaCampaignQueueRoutes.tenantId, context.tenantId))
          .catch(() => []),
        db.select({ id: schema.metaAdQueueRoutes.id })
          .from(schema.metaAdQueueRoutes)
          .where(eq(schema.metaAdQueueRoutes.tenantId, context.tenantId))
          .limit(1)
          .catch(() => []),
        db.select({ id: schema.metaFormQueueRoutes.id })
          .from(schema.metaFormQueueRoutes)
          .where(eq(schema.metaFormQueueRoutes.tenantId, context.tenantId))
          .limit(1)
          .catch(() => []),
      ]).then(([storedMode, campaignRules, adRules, formRules]) => resolveMetaCampaignEligibility({
        storedMode,
        campaignRules,
        hasTenantRules: campaignRules.length > 0 || adRules.length > 0 || formRules.length > 0,
      }))
    : null;
  const eligibleCampaignFilter = !metaCampaignEligibility
    ? null
    : metaCampaignEligibility.mode === "disabled"
      ? sql`false`
      : metaCampaignEligibility.mode === "all"
        ? and(eq(schema.leads.sourceChannel, "meta_lead_ads"), isNotNull(schema.leads.metaCampaignId))
        : metaCampaignEligibility.campaignIds.length
          ? and(eq(schema.leads.sourceChannel, "meta_lead_ads"), inArray(schema.leads.metaCampaignId, metaCampaignEligibility.campaignIds))
          : sql`false`;

  const qualifiedOrDistributedFilter = or(
    isNotNull(schema.leads.corretorId),
    ne(schema.leads.qualificationState, "IN_PROGRESS"),
    eq(schema.leads.qualificationStatus, "waiting_human"),
    inArray(schema.leads.qualificationStatus, ["qualified", "hot", "warm", "cold", "manual_transfer", "disqualified"]),
    inArray(schema.leads.status, ["distributed", "in_contact", "quote_sent", "negotiation", "converted", "lost"])
  );

  const where = and(
    eq(schema.leads.tenantId, context.tenantId),
    isNull(schema.leads.deletedAt),
    qualifiedOrDistributedFilter,
    ...(periodFilter ? [periodFilter] : []),
    ...(statusFilter ? [statusFilter] : []),
    ...(searchFilter ? [searchFilter] : []),
    ...(branchFilter ? [branchFilter] : []),
    ...(tipoFilter ? [tipoFilter] : []),
    ...(origemFilter ? [origemFilter] : []),
    ...(qualificationFilter ? [qualificationFilter] : []),
    ...(corretorFilter ? [corretorFilter] : []),
    ...(eligibleCampaignFilter ? [eligibleCampaignFilter] : []),
    ...(expiredUnworkedBrokerFilter ? [expiredUnworkedBrokerFilter] : [])
  );

  const isDirector = context.role === "director" || (isMarketing && isMatrix);

  const offset = (page - 1) * pageSize;

  const [
    totalCountResult,
    availablePlans,
    leads,
    legacyPlans,
    branches,
    pausedBranchCount,
    slaSettings,
    brokers,
    rawQualifyingLeads,
    activeQueues,
    urgentLead,
  ] = await Promise.all([
    db.select({ total: count() }).from(schema.leads).where(where),
    listAvailableCatalogPlans(context),
    db
      .select({
        id: schema.leads.id,
        nome: schema.leads.nome,
        telefone: schema.leads.telefone,
        status: schema.leads.status,
        qualificationStatus: schema.leads.qualificationStatus,
        qualificationState: schema.leads.qualificationState,
        distributionStatus: schema.leads.distributionStatus,
        origem: schema.leads.origem,
        sourceCampaign: schema.leads.sourceCampaign,
        tipo: schema.leads.tipo,
        createdAt: schema.leads.createdAt,
        assignedAt: schema.leads.assignedAt,
        stageEnteredAt: schema.leads.stageEnteredAt,
        serviceStartedAt: schema.leads.serviceStartedAt,
        firstContactAt: schema.leads.firstContactAt,
        corretorId: schema.leads.corretorId,
        corretorNome: schema.user.name,
        branchId: schema.leads.branchId,
        branchName: schema.branches.name,
      })
      .from(schema.leads)
      .leftJoin(schema.user, eq(schema.leads.corretorId, schema.user.id))
      .leftJoin(schema.branches, eq(schema.leads.branchId, schema.branches.id))
      .where(where)
      .orderBy(desc(schema.leads.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ id: schema.carrierPlans.id, name: schema.carrierPlans.name, carrierName: schema.carriers.name })
      .from(schema.carrierPlans)
      .innerJoin(schema.carriers, eq(schema.carrierPlans.carrierId, schema.carriers.id))
      .where(
        and(
          eq(schema.carrierPlans.tenantId, context.tenantId),
          eq(schema.carrierPlans.active, true),
          eq(schema.carriers.status, "active")
        )
      )
      .orderBy(schema.carriers.name, schema.carrierPlans.name),
    db.select({ id: schema.branches.id, name: schema.branches.name }).from(schema.branches).where(eq(schema.branches.tenantId, context.tenantId)),
    isDirector
      ? db
          .select({ count: count() })
          .from(schema.branches)
          .where(and(eq(schema.branches.tenantId, context.tenantId), eq(schema.branches.acceptingLeads, false)))
          .then((r) => Number(r[0]?.count ?? 0))
      : Promise.resolve(0),
    db
      .select({ slaFirstContactMinutes: schema.tenants.slaFirstContactMinutes, slaStagnantDays: schema.tenants.slaStagnantDays })
      .from(schema.tenants)
      .where(eq(schema.tenants.id, context.tenantId))
      .then((r) => r[0] ?? { slaFirstContactMinutes: "15", slaStagnantDays: "3" }),
    context.role === "manager" || context.role === "director"
      ? db
          .select({ id: schema.user.id, name: schema.user.name, branchId: schema.tenantMemberships.branchId })
          .from(schema.tenantMemberships)
          .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
          .where(
            and(
              eq(schema.tenantMemberships.tenantId, context.tenantId),
              eq(schema.tenantMemberships.role, "broker"),
              eq(schema.tenantMemberships.jobTitle, "broker"),
              eq(schema.tenantMemberships.status, "active"),
              eq(schema.user.active, true),
              context.role === "manager" && context.branchId ? eq(schema.tenantMemberships.branchId, context.branchId) : undefined
            )
          )
      : Promise.resolve([]),
    db
      .select({
        id: schema.leads.id,
        nome: schema.leads.nome,
        telefone: schema.leads.telefone,
        email: schema.leads.email,
        status: schema.leads.status,
        qualificationStatus: schema.leads.qualificationStatus,
        qualificationState: schema.leads.qualificationState,
        qualificationScore: schema.leads.qualificationScore,
        qualificationDetails: schema.leads.qualificationDetails,
        origem: schema.leads.origem,
        sourceChannel: schema.leads.sourceChannel,
        sourceCampaign: schema.leads.sourceCampaign,
        tipo: schema.leads.tipo,
        queueId: schema.leads.queueId,
        queueName: schema.leadQueues.name,
        branchId: schema.leads.branchId,
        branchName: schema.branches.name,
        createdAt: schema.leads.createdAt,
      })
      .from(schema.leads)
      .leftJoin(schema.leadQueues, eq(schema.leads.queueId, schema.leadQueues.id))
      .leftJoin(schema.branches, eq(schema.leads.branchId, schema.branches.id))
      .where(
        and(
          eq(schema.leads.tenantId, context.tenantId),
          isNull(schema.leads.deletedAt),
          isNull(schema.leads.corretorId),
          or(
            eq(schema.leads.qualificationState, "IN_PROGRESS"),
            eq(schema.leads.qualificationStatus, "pending"),
            eq(schema.leads.qualificationStatus, "qualifying"),
            isNull(schema.leads.qualificationStatus)
          ),
          notInArray(schema.leads.qualificationStatus, ["qualified", "hot", "warm", "cold", "disqualified", "not_qualified", "waiting_human"]),
          ...(eligibleCampaignFilter ? [eligibleCampaignFilter] : []),
          context.role === "manager" && context.branchId ? eq(schema.leads.branchId, context.branchId) : undefined
        )
      )
      .orderBy(desc(schema.leads.createdAt))
      .limit(50),
    db
      .select({
        id: schema.leadQueues.id,
        name: schema.leadQueues.name,
        branchId: schema.leadQueues.branchId,
      })
      .from(schema.leadQueues)
      .where(and(eq(schema.leadQueues.tenantId, context.tenantId), eq(schema.leadQueues.status, "active"))),
    getUrgentLeadForUser().catch(() => null),
  ]);

  const totalItems = Number(totalCountResult[0]?.total ?? 0);
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  // Merge legacy carrier plans with global + private catalog plans
  const seen = new Set<string>();
  const plans: Array<{ id: string; name: string; carrierName: string }> = [];
  for (const p of legacyPlans) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      plans.push(p);
    }
  }
  for (const p of availablePlans) {
    if (!seen.has(p.planId)) {
      seen.add(p.planId);
      plans.push({ id: p.planId, name: p.planName, carrierName: p.carrierName });
    }
  }

  const distributedPhones = new Set(
    leads
      .map((l) => (l.telefone ? l.telefone.replace(/\D/g, "") : ""))
      .filter(Boolean)
  );

  const qualifyingLeads = rawQualifyingLeads
    .filter((item) => {
      if (item.status === "distributed") return false;
      const p = item.telefone ? item.telefone.replace(/\D/g, "") : "";
      if (!p) return true;
      return !distributedPhones.has(p) && (p.length < 11 || !distributedPhones.has(p.slice(-11)));
    })
    .map((item) => ({
      ...item,
      qualificationScore: item.qualificationScore ?? 0,
      qualificationDetails: (item.qualificationDetails as Record<string, unknown>) ?? {},
      createdAt: item.createdAt.toISOString(),
    }));

  const slaFirstContactMinutes = Number(slaSettings.slaFirstContactMinutes);
  const slaStagnantDays = Number(slaSettings.slaStagnantDays);
  const leadManagementActionsEnabled = systemSettings.get("feature_lead_management_actions_enabled") !== "false";
  // RCD: detect if any filter is active to switch empty state copy
  const isFiltered = !!(
    filters.search ||
    filters.status ||
    filters.attention ||
    filters.corretor ||
    filters.branch ||
    filters.origem ||
    filters.tipo ||
    filters.qualification ||
    eligibleCampaignsOnly
  );

  return (
    <>
      <DashboardHeader
        breadcrumb="Operação comercial"
        title="Leads"
        rightSlot={
          <LeadsHeaderActions
            period={period}
            plans={plans}
            branches={branches}
            queues={activeQueues}
            role={context.role}
            jobTitle={context.jobTitle}
            branchId={context.branchId}
            urgentLead={urgentLead}
            initiallyOpen={filters.new === "1"}
          >
            <NextUrgentLeadButton lead={urgentLead} />
          </LeadsHeaderActions>
        }
      />
      <LeadsLiveSync />
      <main className="mx-auto flex min-h-0 w-full max-w-[1200px] flex-1 flex-col gap-5 bg-background p-4 pb-28 lg:gap-6 lg:p-6 lg:pb-8">
        {/* Attention Note */}
        {attentionNote ? <ContextNote variant="warning">{attentionNote}</ContextNote> : null}

        {/* Paused Branch Alert */}
        {isDirector && pausedBranchCount > 0 ? (
          <div className="flex flex-col gap-3 rounded-lg border border-warning/20 bg-accent/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <WifiHigh className="size-5 shrink-0 text-warning" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {pausedBranchCount} {pausedBranchCount === 1 ? "filial está com" : "filiais estão com"} recebimento de leads pausado
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground font-medium">
                  Os leads de webhooks não serão roteados para {pausedBranchCount === 1 ? "ela" : "elas"} até que o recebimento seja reativado.
                </p>
              </div>
            </div>
            <Button render={<Link href="/leads/distribuicao" />} size="sm" variant="outline" className="shrink-0 self-start sm:self-auto">
              Revisar distribuição
            </Button>
          </div>
        ) : null}

        {/* Filters */}
        <LeadsFilters
          branches={branches}
          brokers={brokers}
          initialBranch={filters.branch}
          initialCorretor={filters.corretor}
          initialOrigem={filters.origem}
          initialPageSize={filters.pageSize}
          initialQualification={filters.qualification}
          initialSearch={filters.search}
          initialStatus={filters.status}
          initialTipo={filters.tipo}
          initialEligibleCampaigns={filters.eligibleCampaigns}
          storageKey={`ancorahub:leads-filters:${context.tenantId}:${context.userId}`}
        />

        {/* Workspace or RCD Directional Empty State */}
        {leads.length || qualifyingLeads.length ? (
          <div className="space-y-4">
            <LeadsWorkspace
              leads={leads.map((lead) => ({
                ...lead,
                createdAt: lead.createdAt.toISOString(),
                assignedAt: lead.assignedAt?.toISOString() ?? null,
                stageEnteredAt: lead.stageEnteredAt?.toISOString() ?? null,
                serviceStartedAt: lead.serviceStartedAt?.toISOString() ?? null,
                firstContactAt: lead.firstContactAt?.toISOString() ?? null,
              }))}
              qualifyingLeads={qualifyingLeads}
              queues={activeQueues}
              contextRole={leadManagementActionsEnabled ? context.role : "broker"}
              contextJobTitle={context.jobTitle}
              contextBranchId={context.branchId}
              slaFirstContactMinutes={slaFirstContactMinutes}
              slaStagnantDays={slaStagnantDays}
              brokers={brokers}
              branches={branches}
              pageSize={pageSize}
              pagination={{
                currentPage: page,
                pageSize,
                totalItems,
                totalPages,
              }}
            />
          </div>
        ) : (
          /* RCD: Directional empty state — eliminates cognitive void, guides to next action */
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
            {!isFiltered && (
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/8 ring-1 ring-primary/15">
                <Target className="size-7 text-primary" />
              </div>
            )}
            <div className="max-w-sm space-y-1.5">
              <p className="text-sm font-semibold text-foreground">
                {isFiltered ? "Nenhum lead encontrado com esses filtros" : "Sua próxima venda começa aqui"}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {isFiltered
                  ? "Tente ampliar os filtros, remover o período ou buscar por outro termo."
                  : "Cadastre seu primeiro lead e inicie a negociação agora. Equipes que registram leads no sistema fecham 3× mais vendas."}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <ManualLeadSheet
                initiallyOpen={false}
                plans={plans}
                trigger={
                  <Button size="sm" className="gap-1.5 font-medium shadow-sm">
                    <Plus className="size-3.5" />
                    Cadastrar lead
                  </Button>
                }
              />
              <BulkLeadImportDialog
                branches={branches}
                queues={activeQueues}
                role={context.role}
                jobTitle={context.jobTitle}
                branchId={context.branchId}
              />
            </div>
          </div>
        )}

      </main>
    </>
  );
}
