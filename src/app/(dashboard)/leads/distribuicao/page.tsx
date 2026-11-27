import { count, desc, eq, and, inArray, isNull, max, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";

import { Activity, History, Workflow, Inbox as InboxIcon, ShieldCheck, Phone, Route, ListOrdered, Timer, Sparkles, Cpu, AlertTriangle, Clock3, Snowflake } from "lucide-react";
import { DistributionInbox } from "./_components/distribution-inbox";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getFeatureFlag, getSystemSetting, FEATURE_FLAGS } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";
import { DashboardHeader } from "@/components/dashboard-header";
import { DsStatusBadge } from "@/components/ui/ds-status-badge";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/metric-card";
import { SectionCardHeader } from "@/components/ui/section-card-header";
import { DsEmptyState } from "@/components/ui/ds-empty-state";
import { DsOutlinedActionButton } from "@/components/ui/ds-outlined-action-button";
import { dsButtonVariants } from "@/components/ui/ds-button-variants";
import {
  getDistributionJobConfig,
  getLeadDistributionJobHealth,
} from "@/features/lead-distribution/jobs";
import { getLeadEffectOutboxHealth } from "@/features/leads/webhooks/services/lead-effect-outbox";
import { retryLeadEffectAction } from "@/features/lead-distribution/actions";
import { QueueControlCenter } from "./_components/queue-control-center";
import { DistributionTabsContainer } from "./_components/distribution-tabs-container";
import { DistributionPolicyPanel } from "@/app/(dashboard)/settings/_components/distribution-policy-panel";
import { readDistributionPolicy } from "@/features/lead-distribution/domain";
import { RoutingMatrixPanel } from "./_components/routing-matrix-panel";
import { DddRoutingPanel } from "./_components/ddd-routing-panel";
import { fetchRoutingRules } from "@/features/lead-distribution/routing-engine";
import { DirectorDailySummary } from "./_components/director-daily-summary";
import { AssignSection } from "./_components/assign-section";
import { DistributionTabIntro } from "./_components/distribution-tab-intro";
import { LiveStatusBoundary } from "@/features/live-status/components/live-status-slot";
import { shouldShowLiveStatusStrip } from "@/features/live-status/flag";
import { fetchBrokerDailySummary } from "@/features/lead-distribution/broker-summary-service";
import { DutyOperationsWorkspace } from "./plantao/_components/duty-operations-workspace";
import { UnitQueueModeCard } from "./plantao/_components/unit-queue-mode-card";
import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { getDutyRosterSnapshot } from "@/features/lead-distribution/roster-queries";
import { getDutyQueueOrderPreviews } from "@/features/lead-distribution/duty-queue-order-queries";
import { BrokerAcceptanceSlaPanel } from "./_components/broker-acceptance-sla-panel";
import { resolveDistributionView, visibleDistributionViews, type DistributionView } from "@/features/lead-distribution/distribution-view-access";
import { getEffectiveAccess } from "@/features/custom-roles/service";
import { getHoldDisqualifiedLeads } from "@/features/lead-distribution/disqualified-routing-settings";
import { getDddRoutingSettings } from "@/features/lead-distribution/ddd-routing-settings";
import { getPlantaoPriorityOverview } from "@/features/lead-distribution/plantao-priority";
import { operationDayStart } from "@/features/lead-distribution/broker-day-history";
import { DisqualifiedLeadsRoutingPanel } from "./_components/disqualified-leads-routing-panel";
import { ColdLeadRequalificationPanel } from "./_components/cold-lead-requalification-panel";
import { getColdLeadRequalificationReview } from "@/features/ai-qualification/cold-lead-requalification";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
import { canViewDistributionQueues } from "./_components/director-distribution-tabs";
import { DirectorDistributionHealth } from "./_components/director-distribution-health";
import directorDistributionStyles from "./_components/director-distribution-page.module.css";
import { TtlCache } from "@/shared/cache/ttl-cache";
import { visibleToManagement } from "@/features/supervisor-workspace/lead-import/team-list-sql";
import { getLiveStatuses } from "@/features/live-status/service";
import { AssignSection1a1, DistributionHead1a1, LiveStrip1a1 } from "./_components/resumo-1a1-shell";
import { DirectorDailySummary1a1 } from "./_components/director-daily-summary-1a1";
import resumo1a1 from "./_components/resumo-1a1.module.css";

export const dynamic = "force-dynamic";

// Meta campaign and ad names only change on the Meta sync, but this page
// re-renders on every refresh (egress 16/11: ~3.5k + ~500 rows each time).
const META_NAMES_TTL_MS = 5 * 60_000;
const metaCampaignsCache = new TtlCache<Array<{ campaignId: string; name: string; status: string }>>(META_NAMES_TTL_MS, 50);
const metaAdsCache = new TtlCache<Array<{ adId: string; name: string; status: string; campaignId: string | null }>>(META_NAMES_TTL_MS, 50);

type QueueFilter = "all" | "unassigned" | "queued" | "returned_to_queue" | "manual_hold";

const activeStatuses = [
  "new",
  "distributed",
  "in_contact",
  "contacted",
  "quote_sent",
  "negotiation",
  "documentation_pending",
  "under_analysis",
  "awaiting_reply",
] as const;

// Static reference content, opened from the Filas "⋯" menu (only the queue
// table stays on screen).
function DistributionStages() {
  const stages = [
    { title: "Entrada", text: "Manual, integração ou webhook cria uma intenção rastreável." },
    { title: "Unidade", text: "A regra da fila escolhe a unidade elegível com menor carga." },
    { title: "Fila", text: "Capacidade, ordem e restrições definem quem pode receber." },
    { title: "Corretor", text: "Apenas ativos, disponíveis e compatíveis com o plantão." },
    { title: "Oferta + SLA", text: "Recusa, expiração ou atraso avança para o próximo elegível." },
  ];
  return (
    <ol className="grid gap-2">
      {stages.map((stage, index) => (
        <li key={stage.title} className="flex min-w-0 gap-3 rounded-[var(--radius-card)] border border-border/70 p-3">
          <span
            className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/8 text-[10px] font-semibold text-primary"
            aria-hidden="true"
          >
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">{stage.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{stage.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** "há 40 s", "há 12 min", "há 3 h" ou a data, para a faixa ao vivo do Resumo. */
function distributedAgo(at: Date, now = new Date()) {
  const seconds = Math.max(0, Math.round((now.getTime() - at.getTime()) / 1000));
  if (seconds < 60) return `há ${seconds} s`;
  if (seconds < 3600) return `há ${Math.round(seconds / 60)} min`;
  if (seconds < 86_400) return `há ${Math.round(seconds / 3600)} h`;
  return `em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(at)}`;
}

const LITE_TAB_VIEWS: readonly DistributionView[] = ["resumo_dia", "roteamento", "filas", "plantao", "saude_historico"];
/** Data of a tab that is not on screen: never read, because its block is not built. */
const NOT_LOADED = undefined as never;

export default async function LeadDistributionPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; status?: string; escalaMes?: string }>;
}) {
  const params = await searchParams;
  // A aba Operação saiu (14/11/2026): a caixa de atribuição mora no Resumo. Links antigos abrem a seção lá.
  if (params.view === "operar") redirect("/distribuicao?atribuir=1");
  const queueFilter: QueueFilter =
    params.status === "unassigned" ||
    params.status === "queued" ||
    params.status === "returned_to_queue" ||
    params.status === "manual_hold"
      ? params.status
      : "all";

  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") redirect("/access-denied");
  // Cargos (04/11, F2): quem tem cargo vê só as abas que o cargo libera, também pela URL (?view=).
  const access = await getEffectiveAccess({ tenantId: context.tenantId, role: context.role, jobTitle: context.jobTitle, customRoleId: context.customRoleId ?? null });
  const cargoCapabilities = access.hasCargo ? access.capabilities : undefined;
  // Modo Gestor (05/11): a distribuição do gestor é só a aba Plantão, com o que é exclusivo da unidade dele.
  const managerGestorMode = context.role === "manager" && (await getLiteAudience(context)) === "manager";
  const resolvedView = managerGestorMode
    ? (!cargoCapabilities || cargoCapabilities.has("duty_schedules_manage") ? "plantao" : null)
    : resolveDistributionView(context.role, params.view, cargoCapabilities);
  if (!resolvedView) redirect("/access-denied");
  const view = resolvedView;
  const allowedViews = managerGestorMode ? (["plantao"] as readonly DistributionView[]) : cargoCapabilities ? visibleDistributionViews(context.role, cargoCapabilities) : undefined;
  const monthlyDutySchedulingEnabled = view === "plantao"
    ? (await getFeatureFlag(FEATURE_FLAGS.DUTY_MONTHLY_SCHEDULING)) === "true"
    : false;

  if (context.role === "manager" && !context.branchId) {
    return (
      <>
        <DashboardHeader breadcrumb="Operação comercial" title="Distribuição" />
        <main className="flex min-h-full flex-col items-center justify-center bg-ds-canvas-white p-ds-48">
          <DsEmptyState
            icon={<InboxIcon size={20} />}
            title="Unidade não definida"
            description="Seu acesso como gestor não está vinculado a nenhuma unidade. Fale com o diretor para ajustar seu cadastro."
            bordered={false}
          />
        </main>
      </>
    );
  }

  const db = getDatabase();

  const branchScope =
    context.role === "manager" && context.branchId
      ? and(
          eq(schema.branches.tenantId, context.tenantId),
          eq(schema.branches.id, context.branchId),
        )
      : eq(schema.branches.tenantId, context.tenantId);

  const branches = await db
    .select({
      id: schema.branches.id,
      name: schema.branches.name,
      status: schema.branches.status,
      acceptingLeads: schema.branches.acceptingLeads,
      autoDistribute: schema.branches.autoDistribute,
      isDistributionHub: schema.branches.isDistributionHub,
    })
    .from(schema.branches)
    .where(branchScope);

  const branchIds = branches.map((b) => b.id);
  if (!branchIds.length) {
    return (
      <>
        <DashboardHeader breadcrumb="Operação comercial" title="Distribuição" />
        <main className="flex min-h-full flex-col items-center justify-center bg-ds-canvas-white p-ds-48">
          <DsEmptyState
            icon={<InboxIcon size={20} />}
            title="Nenhuma filial cadastrada"
            description="Crie filiais para poder configurar as regras de distribuição de leads."
            bordered={false}
            action={
              <Link href="/equipe?visao=unidades" className={dsButtonVariants({ dsVariant: "outlined-action" })}>
                Ir para Filiais
              </Link>
            }
          />
        </main>
      </>
    );
  }

  // Velocidade (24/11/2026): no Lite cada aba abre só com o que ela mostra. A aba Plantão
  // carregava as 26 consultas de todas as abas e levava 14 s. O modo antigo ainda monta
  // todas as abas de uma vez, então lá tudo continua carregado.
  const directorLite = await isDirectorLitePageOnServer(context, "/leads/distribuicao");
  const oneTabOnly = managerGestorMode || (directorLite && LITE_TAB_VIEWS.includes(view));
  const tabShows = (views: readonly DistributionView[]) => !oneTabOnly || views.includes(view);
  const loadFor = <T,>(views: readonly DistributionView[], load: () => PromiseLike<T>, empty: T): Promise<T> =>
    tabShows(views) ? Promise.resolve(load()) : Promise.resolve(empty);

  // Velocidade (25/11/2026): a prévia vai como promessa; a aba aparece sem esperar por ela.
  // The queue preview is a side panel: if it fails, the Plantão tab still loads (null = "could not build").
  const dutyQueueOrders = view === "plantao"
    ? getDutyQueueOrderPreviews(context).catch((error: unknown) => {
      console.error("[distribuicao] duty_queue_order_failed", { tenantId: context.tenantId, error: error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 400) : String(error).slice(0, 400), stack: error instanceof Error ? error.stack?.split("\n").slice(0, 6).join(" | ") : undefined });
      return null;
    })
    : Promise.resolve([]);

  // Single consolidated Promise.all for fast TTFB
  const [
    brokers,
    unassignedLeads,
    unassignedArchiveCount,
    activeBrokerLeads,
    brokerStatsByBranch,
    leadStatsByBranch,
    jobHealth,
    jobConfig,
    effectHealth,
    failedEffects,
    queues,
    queueLeadCounts,
    recentEvents,
    globalPolicy,
    metaCampaigns,
    metaAds,
    metaCampaignRoutes,
    metaAdRoutes,
    dutySchedules,
    routingRules,
    brokerSummary,
    dutyRoster,
    tenantSlaSettings,
    holdDisqualifiedLeads,
    dddRoutingSettings,
  ] = await Promise.all([

    loadFor(["resumo_dia", "roteamento", "filas"], () => db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        email: schema.user.email,
        branchId: schema.tenantMemberships.branchId,
        branchName: schema.branches.name,
        availabilityStatus: schema.tenantMemberships.availabilityStatus,
      })
      .from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
      .leftJoin(schema.branches, eq(schema.tenantMemberships.branchId, schema.branches.id))
      .where(
        and(
          eq(schema.tenantMemberships.tenantId, context.tenantId),
          inArray(schema.tenantMemberships.branchId, branchIds),
          eq(schema.tenantMemberships.role, "broker"),
          eq(schema.tenantMemberships.jobTitle, "broker"),
          eq(schema.tenantMemberships.status, "active"),
          eq(schema.user.active, true),
        ),
      ), []),
    loadFor(["resumo_dia"], () => db
      .select({
        id: schema.leads.id,
        name: schema.leads.nome,
        phone: schema.leads.telefone,
        branchId: schema.leads.branchId,
        distributionStatus: schema.leads.distributionStatus,
        status: schema.leads.status,
        qualificationStatus: schema.leads.qualificationStatus,
        createdAt: schema.leads.createdAt,
        sourceCampaign: schema.leads.sourceCampaign,
        sourceAd: schema.leads.sourceAd,
        metaCampaignId: schema.leads.metaCampaignId,
        metaAdId: schema.leads.metaAdId,
      })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, context.tenantId),
          isNull(schema.leads.deletedAt),
          isNull(schema.leads.archivedAt),
          isNull(schema.leads.corretorId),
          visibleToManagement(),
          isNull(schema.leads.distributionRemovedAt),
          context.role === "manager" && context.branchId
            ? eq(schema.leads.branchId, context.branchId)
            : undefined,
        ),
      )
      .orderBy(schema.leads.createdAt), []),
    loadFor(["resumo_dia"], () => db
      .select({ count: count(schema.leads.id) })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, context.tenantId),
          isNull(schema.leads.deletedAt),
          isNull(schema.leads.archivedAt),
          isNull(schema.leads.corretorId),
          visibleToManagement(),
        ),
      ), []),
    loadFor(["resumo_dia"], () => db
      .select({ brokerId: schema.leads.corretorId, count: count(schema.leads.id) })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, context.tenantId),
          isNull(schema.leads.deletedAt),
          isNull(schema.leads.archivedAt),
          inArray(schema.leads.branchId, branchIds),
          inArray(schema.leads.status, activeStatuses),
        ),
      )
      .groupBy(schema.leads.corretorId), []),
    db
      .select({
        branchId: schema.tenantMemberships.branchId,
        availabilityStatus: schema.tenantMemberships.availabilityStatus,
        count: count(schema.tenantMemberships.id),
      })
      .from(schema.tenantMemberships)
      .where(
        and(
          eq(schema.tenantMemberships.tenantId, context.tenantId),
          eq(schema.tenantMemberships.role, "broker"),
          eq(schema.tenantMemberships.jobTitle, "broker"),
          eq(schema.tenantMemberships.status, "active"),
          inArray(schema.tenantMemberships.branchId, branchIds),
        ),
      )
      .groupBy(schema.tenantMemberships.branchId, schema.tenantMemberships.availabilityStatus),
    db
      .select({
        branchId: schema.leads.branchId,
        status: schema.leads.status,
        count: count(schema.leads.id),
      })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, context.tenantId),
          isNull(schema.leads.deletedAt),
          isNull(schema.leads.archivedAt),
          inArray(schema.leads.branchId, branchIds),
        ),
      )
      .groupBy(schema.leads.branchId, schema.leads.status),
    loadFor(["saude_historico"], () => getLeadDistributionJobHealth(context.tenantId), NOT_LOADED),
    loadFor(["saude_historico"], () => getDistributionJobConfig(), NOT_LOADED),
    loadFor(["saude_historico"], () => getLeadEffectOutboxHealth(context.tenantId), NOT_LOADED),
    loadFor(["saude_historico"], () => db
      .select({
        id: schema.leadEffectOutbox.id,
        leadId: schema.leadEffectOutbox.leadId,
        type: schema.leadEffectOutbox.type,
        attemptCount: schema.leadEffectOutbox.attemptCount,
        lastErrorCode: schema.leadEffectOutbox.lastErrorCode,
        lastErrorMessage: schema.leadEffectOutbox.lastErrorMessage,
        leadName: schema.leads.nome,
        branchId: schema.leads.branchId,
      })
      .from(schema.leadEffectOutbox)
      .innerJoin(schema.leads, eq(schema.leadEffectOutbox.leadId, schema.leads.id))
      .where(
        and(
          eq(schema.leadEffectOutbox.tenantId, context.tenantId),
          eq(schema.leadEffectOutbox.status, "failed"),
          isNull(schema.leads.deletedAt),
          isNull(schema.leads.archivedAt),
          context.role === "manager" && context.branchId
            ? eq(schema.leads.branchId, context.branchId)
            : undefined,
        ),
      )
      .orderBy(schema.leadEffectOutbox.updatedAt)
      .limit(20), []),
    loadFor(["plantao", "roteamento", "filas"], () => db
      .select({
        id: schema.leadQueues.id,
        name: schema.leadQueues.name,
        branchId: schema.leadQueues.branchId,
        exclusiveDutyScheduleId: schema.leadQueues.exclusiveDutyScheduleId,
        exclusiveDutyScheduleIds: schema.leadQueues.exclusiveDutyScheduleIds,
        dutyFallbackPolicy: schema.leadQueues.dutyFallbackPolicy,
        dutyFallbackQueueId: schema.leadQueues.dutyFallbackQueueId,
        branchName: schema.branches.name,
        status: schema.leadQueues.status,
        assignmentMode: schema.leadQueues.assignmentMode,
        assignmentStrategy: schema.leadQueues.assignmentStrategy,
        capacityEnabled: schema.leadQueues.capacityEnabled,
        capacityPerBroker: schema.leadQueues.capacityPerBroker,
        offerIntervalMinutes: schema.leadQueues.offerIntervalMinutes,
        maxPendingOffersPerBroker: schema.leadQueues.maxPendingOffersPerBroker,
        aiQualificationEnabled: schema.leadQueues.aiQualificationEnabled,
        attendanceFlowId: schema.leadQueues.attendanceFlowId,
        colorHue: schema.leadQueues.colorHue,
      })
      .from(schema.leadQueues)
      .leftJoin(schema.branches, eq(schema.leadQueues.branchId, schema.branches.id))
      .where(
        and(eq(schema.leadQueues.tenantId, context.tenantId), isNull(schema.leadQueues.deletedAt)),
      )
      .orderBy(schema.leadQueues.name), []),
    loadFor(["filas"], () => db
      .select({ queueId: schema.leads.queueId, waiting: count(schema.leads.id) })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, context.tenantId),
          isNull(schema.leads.deletedAt),
          isNull(schema.leads.archivedAt),
          inArray(schema.leads.branchId, branchIds),
          inArray(schema.leads.distributionStatus, ["queued", "returned_to_queue"]),
        ),
      )
      .groupBy(schema.leads.queueId), []),
    loadFor(["saude_historico"], () => db
      .select({
        id: schema.leadDistributionEvents.id,
        action: schema.leadDistributionEvents.action,
        reason: schema.leadDistributionEvents.reason,
        createdAt: schema.leadDistributionEvents.createdAt,
        leadName: schema.leads.nome,
        queueName: schema.leadQueues.name,
        brokerName: schema.user.name,
      })
      .from(schema.leadDistributionEvents)
      .innerJoin(schema.leads, eq(schema.leadDistributionEvents.leadId, schema.leads.id))
      .leftJoin(
        schema.leadQueues,
        eq(schema.leadDistributionEvents.toQueueId, schema.leadQueues.id),
      )
      .leftJoin(schema.user, eq(schema.leadDistributionEvents.newOwnerId, schema.user.id))
      .where(
        and(
          eq(schema.leadDistributionEvents.tenantId, context.tenantId),
          isNull(schema.leads.deletedAt),
          isNull(schema.leads.archivedAt),
          context.role === "manager" && context.branchId
            ? eq(schema.leads.branchId, context.branchId)
            : undefined,
        ),
      )
      .orderBy(desc(schema.leadDistributionEvents.createdAt))
      .limit(40), []),
    loadFor(["filas"], () => db
      .select({
        queueId: schema.leadDistributionPolicies.queueId,
        policy: schema.leadDistributionPolicies.policy,
      })
      .from(schema.leadDistributionPolicies)
      .where(
        and(
          eq(schema.leadDistributionPolicies.tenantId, context.tenantId),
          isNull(schema.leadDistributionPolicies.profileKey),
        ),
      ), []),
    loadFor(["filas"], () => metaCampaignsCache.getOrLoad(context.tenantId, () => db
      .select({
        campaignId: schema.metaCampaigns.campaignId,
        name: schema.metaCampaigns.name,
        status: schema.metaCampaigns.status,
      })
      .from(schema.metaCampaigns)
      .where(eq(schema.metaCampaigns.tenantId, context.tenantId))
      .orderBy(schema.metaCampaigns.name)), []),
    loadFor(["filas"], () => metaAdsCache.getOrLoad(context.tenantId, () => db
      .select({
        adId: schema.metaAds.adId,
        name: schema.metaAds.name,
        status: schema.metaAds.status,
        campaignId: schema.metaAdSets.campaignId,
      })
      .from(schema.metaAds)
      .leftJoin(
        schema.metaAdSets,
        and(eq(schema.metaAdSets.tenantId, schema.metaAds.tenantId), eq(schema.metaAdSets.adSetId, schema.metaAds.adSetId)),
      )
      .where(eq(schema.metaAds.tenantId, context.tenantId))
      .orderBy(schema.metaAds.name)), []),
    loadFor(["filas"], () => db
      .select({
        campaignId: schema.metaCampaignQueueRoutes.campaignId,
        queueId: schema.metaCampaignQueueRoutes.queueId,
        queueName: schema.leadQueues.name,
        enabled: schema.metaCampaignQueueRoutes.enabled,
      })
      .from(schema.metaCampaignQueueRoutes)
      .leftJoin(schema.leadQueues, eq(schema.metaCampaignQueueRoutes.queueId, schema.leadQueues.id))
      .where(
        and(
          eq(schema.metaCampaignQueueRoutes.tenantId, context.tenantId),
          context.role === "manager" && context.branchId
            ? eq(schema.leadQueues.branchId, context.branchId)
            : undefined,
        ),
      )
      .orderBy(schema.leadQueues.name), []),
    loadFor(["filas"], () => db
      .select({
        adId: schema.metaAdQueueRoutes.adId,
        queueId: schema.metaAdQueueRoutes.queueId,
        queueName: schema.leadQueues.name,
        enabled: schema.metaAdQueueRoutes.enabled,
      })
      .from(schema.metaAdQueueRoutes)
      .leftJoin(schema.leadQueues, eq(schema.metaAdQueueRoutes.queueId, schema.leadQueues.id))
      .where(
        and(
          eq(schema.metaAdQueueRoutes.tenantId, context.tenantId),
          context.role === "manager" && context.branchId
            ? eq(schema.leadQueues.branchId, context.branchId)
            : undefined,
        ),
      )
      .orderBy(schema.leadQueues.name), []),
    loadFor(["filas"], () => db
      .select({
        id: schema.unitDutySchedules.id,
        name: schema.unitDutySchedules.name,
        startsAt: schema.unitDutySchedules.startsAt,
        endsAt: schema.unitDutySchedules.endsAt,
        dayOfWeek: schema.unitDutySchedules.dayOfWeek,
        status: schema.unitDutySchedules.status,
        branchName: schema.branches.name,
      })
      .from(schema.unitDutySchedules)
      .leftJoin(schema.branches, eq(schema.unitDutySchedules.branchId, schema.branches.id))
      .where(
        and(
          eq(schema.unitDutySchedules.tenantId, context.tenantId),
          eq(schema.unitDutySchedules.status, "active"),
          context.role === "manager" && context.branchId
            ? or(isNull(schema.unitDutySchedules.branchId), eq(schema.unitDutySchedules.branchId, context.branchId))
            : undefined,
        ),
      )
      .orderBy(schema.unitDutySchedules.name), []),
    loadFor(["roteamento"], () => fetchRoutingRules(context.tenantId), []),
    loadFor(["resumo_dia"], () => fetchBrokerDailySummary(context.tenantId, {
      startDate: new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        new Date().getDate(),
        0,
        0,
        0,
        0,
      ),
      endDate: new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        new Date().getDate(),
        23,
        59,
        59,
        999,
      ),
      branchId: context.role === "manager" && context.branchId ? context.branchId : undefined,
    }), NOT_LOADED),
    loadFor(["plantao"], () => getDutyRosterSnapshot(context), NOT_LOADED),
    loadFor(["filas"], () => db
      .select({
        slaFirstContactMinutes: schema.tenants.slaFirstContactMinutes,
        autoRedistributeOnFeedbackTimeout: schema.tenants.autoRedistributeOnFeedbackTimeout,
      })
      .from(schema.tenants)
      .where(eq(schema.tenants.id, context.tenantId))
      .limit(1)
      .then(
        (r) => r[0] ?? { slaFirstContactMinutes: "15", autoRedistributeOnFeedbackTimeout: true },
      ), NOT_LOADED),
    loadFor(["roteamento"], () => getHoldDisqualifiedLeads(context.tenantId), NOT_LOADED),
    loadFor(["roteamento"], () => getDddRoutingSettings(context.tenantId), NOT_LOADED),
]);

  // Prioridade por tipo de plantão: só o Diretor vê e altera (gestor nunca recebe estes dados).
  const plantaoPriority = context.role === "director" && tabShows(["filas"])
    ? await getPlantaoPriorityOverview(context.tenantId, operationDayStart(new Date()))
      .then((overview) => ({
        flagOn: overview.flagOn,
        mode: overview.settings.mode,
        levelByHours: overview.settings.levelByHours,
        types: overview.types.map((type) => ({ typeId: type.typeId, name: type.name, base: type.base, adaptive: type.adaptive, effectiveWeight: type.effectiveWeight, reason: type.reason })),
      }))
      .catch((error: unknown) => {
        console.error("[distribuicao] plantao_priority_failed", { tenantId: context.tenantId, error: error instanceof Error ? error.name : "unknown_error" });
        return null;
      })
    : null;

  const activeBrokerLeadsMap = new Map(
    activeBrokerLeads.map((entry) => [entry.brokerId, Number(entry.count)]),
  );

  // Process aggregated broker stats
  const countsByBranch = new Map<string, number>();
  const availableByBranch = new Map<string, number>();
  brokerStatsByBranch.forEach((row) => {
    if (!row.branchId) return;
    const currentTotal = countsByBranch.get(row.branchId) ?? 0;
    countsByBranch.set(row.branchId, currentTotal + Number(row.count));
    if (row.availabilityStatus === "available") {
      const currentAvail = availableByBranch.get(row.branchId) ?? 0;
      availableByBranch.set(row.branchId, currentAvail + Number(row.count));
    }
  });

  // Process aggregated lead stats
  const leadsByBranch = new Map<string, number>();
  const newByBranch = new Map<string, number>();
  leadStatsByBranch.forEach((row) => {
    if (!row.branchId) return;
    if (activeStatuses.some((status) => status === row.status)) {
      const currentActive = leadsByBranch.get(row.branchId) ?? 0;
      leadsByBranch.set(row.branchId, currentActive + Number(row.count));
    }
    if (row.status === "new") {
      const currentNew = newByBranch.get(row.branchId) ?? 0;
      newByBranch.set(row.branchId, currentNew + Number(row.count));
    }
  });

  const totalBrokers = [...countsByBranch.values()].reduce((a, b) => a + b, 0);
  const totalAvailable = [...availableByBranch.values()].reduce((a, b) => a + b, 0);
  const totalNewLeads = [...newByBranch.values()].reduce((a, b) => a + b, 0);

  const totalUnassignedForArchive = Number(unassignedArchiveCount[0]?.count ?? 0);

  const queueWaiting = new Map(queueLeadCounts.map((item) => [item.queueId, Number(item.waiting)]));
  const queuePoliciesMap = new Map(
    globalPolicy
      .filter((p) => p.queueId)
      .map((p) => [p.queueId!, readDistributionPolicy(p.policy)]),
  );

  // DEC-127: the queue's attendance flow, offered only while the switch is on.
  const attendanceFlowOptions = !tabShows(["filas"]) ? null : await (async () => {
    const { attendanceFlowsEnabled, ensureBuiltinFlows } = await import("@/features/attendance-flows/runtime");
    if (!(await attendanceFlowsEnabled().catch(() => false))) return null;
    await ensureBuiltinFlows(context.tenantId);
    return getDatabase().select({ id: schema.attendanceFlows.id, name: schema.attendanceFlows.name, description: schema.attendanceFlows.description })
      .from(schema.attendanceFlows)
      .where(and(eq(schema.attendanceFlows.tenantId, context.tenantId), eq(schema.attendanceFlows.status, "active")));
  })();
  const queuesForControl = queues.map((queue) => {
    const queuePolicy = queuePoliciesMap.get(queue.id);
    return {
      ...queue,
      allowedBranchIds: queuePolicy?.allowedBranchIds ?? [],
      allowedBrokerIds: queuePolicy?.allowedBrokerIds ?? [],
      allowedSourceIds: queuePolicy?.allowedSourceIds ?? [],
      holdColdLeads: queuePolicy?.holdColdLeads ?? false,
      coldLeadRequalification: queuePolicy?.coldLeadRequalification ?? { enabled: false, intervalMinutes: 120, maxAttempts: 3 },
      waiting: queueWaiting.get(queue.id) ?? 0,
      members: queue.branchId ? (countsByBranch.get(queue.branchId) ?? 0) : totalBrokers,
      activeLeads: queue.branchId ? (leadsByBranch.get(queue.branchId) ?? 0) : totalNewLeads,
    };
  });
  // Gestor (05/11): o plantão só oferece filas da unidade dele; nenhuma global nem de outra unidade.
  const plantaoQueues = queuesForControl
    .filter((queue) => queue.status === "active" && (context.role !== "manager" || (Boolean(context.branchId) && queue.branchId === context.branchId)))
    .map((queue) => ({ id: queue.id, name: queue.name, offerIntervalMinutes: queue.offerIntervalMinutes }));
  const unitQueueModes = context.role === "manager" && context.branchId
    ? queuesForControl
      .filter((queue) => queue.status === "active" && queue.branchId === context.branchId)
      .map((queue) => ({ id: queue.id, name: queue.name, mode: queue.assignmentMode === "manual" ? "manual" as const : "automatic" as const }))
    : null;
  const canChangeUnitQueueMode = Boolean(unitQueueModes) && (!cargoCapabilities || cargoCapabilities.has("lead_queues_manage"));
  const plantaoWorkspace = (
    <>
      {canChangeUnitQueueMode && unitQueueModes ? <UnitQueueModeCard queues={unitQueueModes} /> : null}
      <DutyOperationsWorkspace
        snapshot={dutyRoster}
        queueOrders={dutyQueueOrders}
        monthlySchedulingEnabled={monthlyDutySchedulingEnabled}
        canPlanMonthlySchedule={context.role === "director"}
        initialMonthlyScheduleMonth={view === "plantao" && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.escalaMes ?? "") ? params.escalaMes : null}
        queues={plantaoQueues}
      />
    </>
  );
  if (managerGestorMode) {
    return (
      <>
        <DashboardHeader breadcrumb="Gestão da unidade" title="Plantão" />
        <main className={directorDistributionStyles.page}>
          <section className={directorDistributionStyles.stack} aria-label="Plantão da unidade">
            {plantaoWorkspace}
            <p className="text-xs text-muted-foreground">Você vê só os plantões, corretores e filas exclusivos da sua unidade.</p>
          </section>
        </main>
      </>
    );
  }

  const coldLeadReview = context.role === "director" && tabShows(["filas"])
    ? await getColdLeadRequalificationReview(context)
    : null;

  // Caixa "Leads aguardando corretor" (antes, a aba Operação): só para quem pode atribuir.
  const canAssign = !cargoCapabilities || cargoCapabilities.has("leads_assign");
  const assignSection = view === "resumo_dia" && canAssign ? (
    <AssignSection count={totalUnassignedForArchive}>
      <DistributionInbox
        key={queueFilter}
        role={context.role}
        manualAssignmentChoiceEnabled={(await getSystemSetting("feature_manual_lead_assignment_offer_choice_enabled")) !== "false"}
        totalUnassigned={totalUnassignedForArchive}
        initialStatusFilter={queueFilter}
        branches={branches.map((branch) => ({ id: branch.id, name: branch.name }))}
        brokers={brokers.map((broker) => ({
          id: broker.id,
          name: broker.name,
          branchId: broker.branchId,
          availabilityStatus: broker.availabilityStatus,
          activeLeads: activeBrokerLeadsMap.get(broker.id) ?? 0,
        }))}
        leads={unassignedLeads.map((lead) => ({
          ...lead,
          createdAt: lead.createdAt.toISOString(),
        }))}
      />
    </AssignSection>
  ) : null;

  // Topo de cada aba no Lite (refino 14/11/2026): o estado de cada bloco em cartões, antes dos painéis.
  const activeQueues = queuesForControl.filter((queue) => queue.status === "active");
  const waitingInQueues = queuesForControl.reduce((sum, queue) => sum + (queue.waiting ?? 0), 0);
  const tenantPolicy = readDistributionPolicy(globalPolicy.find((policy) => !policy.queueId)?.policy ?? {});
  const slaMinutes = Number(tenantSlaSettings?.slaFirstContactMinutes) || 15;
  // Cada cartão com `panel` abre a configuração daquele bloco; a lista principal da aba fica sempre à vista.
  // Os blocos das abas viram funções: só montam (e só leem os dados) a aba que aparece.
  const rulesIntro = () => (
    <DistributionTabIntro
      title="Entradas e regras"
      lead="O que acontece com cada lead antes da oferta: quem segura, para qual fila vai e em que ordem as regras valem."
      stats={[
        {
          key: "disq", icon: <ShieldCheck />, label: "Desqualificados", text: true, value: holdDisqualifiedLeads ? "Retidos" : "Seguem a distribuição",
          hint: holdDisqualifiedLeads ? "ficam em espera antes da oferta" : "vão para o corretor como os outros", tone: holdDisqualifiedLeads ? "success" : "neutral",
          panel: <DisqualifiedLeadsRoutingPanel initialHoldDisqualifiedLeads={holdDisqualifiedLeads} canEdit={context.role === "director"} />,
        },
        {
          key: "ddd", icon: <Phone />, label: "Regra de DDD", text: true, value: dddRoutingSettings.enabled ? "Ligada" : "Desligada",
          hint: dddRoutingSettings.enabled ? `${dddRoutingSettings.validDdds.length} ${dddRoutingSettings.validDdds.length === 1 ? "DDD válido" : "DDDs válidos"}` : "nenhum lead é movido pelo DDD",
          tone: dddRoutingSettings.enabled ? "success" : "neutral",
          panel: <DddRoutingPanel initialSettings={dddRoutingSettings} queues={queues.map((queue) => ({ id: queue.id, name: queue.name }))} canEdit={context.role === "director"} />,
        },
        { key: "rules", icon: <Route />, label: "Regras de roteamento", value: routingRules.length, hint: routingRules.length ? "em ordem de prioridade, na lista abaixo" : "tudo segue a fila geral da unidade" },
      ]}
    >
      <RoutingMatrixPanel
        rules={routingRules}
        queues={queues.map((queue) => ({ id: queue.id, name: queue.name }))}
        branches={branches.map((branch) => ({ id: branch.id, name: branch.name }))}
        brokers={brokers.map((broker) => ({ id: broker.id, name: broker.name }))}
        canEdit={context.role === "director" || context.role === "manager"}
      />
    </DistributionTabIntro>
  );
  const queuesIntro = () => (
    <DistributionTabIntro
      title="Filas"
      lead="Quem recebe cada lead, em que ordem e com quanto tempo para aceitar."
      stats={[
        { key: "queues", icon: <ListOrdered />, label: "Filas ativas", value: activeQueues.length, hint: waitingInQueues ? `${waitingInQueues} ${waitingInQueues === 1 ? "lead esperando" : "leads esperando"}` : `de ${queuesForControl.length} ${queuesForControl.length === 1 ? "fila" : "filas"}` },
        {
          key: "sla", icon: <Timer />, label: "Prazo de aceite", value: `${slaMinutes} min`,
          hint: tenantSlaSettings?.autoRedistributeOnFeedbackTimeout ?? true ? "depois disso, passa para o próximo" : "sem redistribuição automática", tone: "warning",
          panel: (
            <BrokerAcceptanceSlaPanel
              initialMinutes={slaMinutes}
              initialAutoRedistribute={tenantSlaSettings?.autoRedistributeOnFeedbackTimeout ?? true}
              canEdit={context.role === "director" || context.role === "manager"}
            />
          ),
        },
        {
          key: "ranking", icon: <Sparkles />, label: "Distribuição inteligente", text: true, value: tenantPolicy.ranking.enabled ? "Ranking ligado" : "Ordem da fila",
          hint: tenantPolicy.ranking.enabled ? `conversão ${tenantPolicy.ranking.conversionWeight} · SLA ${tenantPolicy.ranking.slaWeight} · manual ${tenantPolicy.ranking.manualPriorityWeight}` : "sem ranking depois do plantão",
          tone: tenantPolicy.ranking.enabled ? "success" : "neutral",
          panel: (
            <DistributionPolicyPanel
              canEdit={context.role === "director"}
              brokers={brokers.map((broker) => ({ id: broker.id, name: broker.name }))}
              policy={globalPolicy.find((policy) => !policy.queueId)?.policy ?? {}}
              plantaoPriority={plantaoPriority}
            />
          ),
        },
        ...(coldLeadReview ? [{
          key: "cold", icon: <Snowflake />, label: "Leads frios", text: true, value: "Requalificar",
          hint: "revisar os frios recebidos hoje", tone: "neutral" as const,
          panel: <ColdLeadRequalificationPanel {...coldLeadReview} />,
        }] : []),
      ]}
    >
      <QueueControlCenter
        queues={queuesForControl}
        branches={branches.map((branch) => ({ id: branch.id, name: branch.name }))}
        brokers={brokers.map((broker) => ({
          id: broker.id,
          name: broker.name,
          branchId: broker.branchId ?? "",
          branchName: broker.branchName ?? "",
        }))}
        dutySchedules={dutySchedules}
        campaigns={metaCampaigns}
        ads={metaAds}
        campaignRoutes={metaCampaignRoutes.map((route) => ({
          ...route,
          queueId: route.queueId ?? "",
        }))}
        adRoutes={metaAdRoutes.map((route) => ({ ...route, queueId: route.queueId ?? "" }))}
        attendanceFlows={attendanceFlowOptions}
        canEdit={context.role === "director"}
      />
    </DistributionTabIntro>
  );
  const jobExceptions = (jobHealth?.failed ?? 0) + (effectHealth?.failed ?? 0);
  const healthIntro = () => (
    <DistributionTabIntro
      title="Saúde"
      lead="Se o motor de distribuição está rodando e o que ficou para revisão."
      stats={[
        { key: "engine", icon: <Cpu />, label: "Motor de distribuição", text: true, value: !jobHealth.available ? "Aguardando configuração" : !jobConfig.enabled ? "Pausado" : "Ativo", tone: !jobHealth.available || !jobConfig.enabled ? "neutral" : "success" },
        { key: "pending", icon: <Clock3 />, label: "Pendências", value: jobHealth.pending + jobHealth.retrying + effectHealth.pending + effectHealth.retrying, hint: "o motor tenta de novo sozinho" },
        { key: "failed", icon: <AlertTriangle />, label: "Exceções", value: jobExceptions, hint: jobExceptions ? "pedem revisão da gestão" : "nada para revisar", tone: jobExceptions ? "danger" : "success" },
        { key: "events", icon: <History />, label: "Decisões recentes", value: recentEvents.length, hint: "atribuições e redistribuições" },
      ]}
    >
      <DirectorDistributionHealth
        events={recentEvents.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() }))}
        jobs={jobHealth}
        jobsAvailable={jobHealth.available}
        jobsEnabled={jobConfig.enabled}
        effects={effectHealth}
        failedEffects={failedEffects}
      />
    </DistributionTabIntro>
  );

  // Resumo da barra do topo no Lite (anatomia de página): os mesmos dois números que o modo normal mostra no topo.
  const liteSummary = `${totalAvailable.toLocaleString("pt-BR")} ${totalAvailable === 1 ? "disponível" : "disponíveis"} · ${totalNewLeads.toLocaleString("pt-BR")} aguardando`;
  // Resumo 1:1 (27/11/2026, artifact "Distribuição · Resumo"): topo, abas, faixa ao vivo, leads aguardando e corretores
  // na marcação do artifact. As outras abas seguem no desenho anterior até o refino de cada uma.
  if (directorLite && view === "resumo_dia") {
    const [liveStatuses, lastDistribution] = await Promise.all([
      (await shouldShowLiveStatusStrip(context)) ? getLiveStatuses(context).catch(() => null) : Promise.resolve(null),
      db.select({ at: max(schema.leadDistributionEvents.createdAt) })
        .from(schema.leadDistributionEvents)
        .where(eq(schema.leadDistributionEvents.tenantId, context.tenantId))
        .then((rows) => rows[0]?.at ?? null)
        .catch(() => null),
    ]);
    const duty = liveStatuses?.statuses.find((status) => status.id === "plantao");
    const onlineBrokers = brokerStatsByBranch
      .filter((row) => row.availabilityStatus && row.availabilityStatus !== "offline")
      .reduce((sum, row) => sum + Number(row.count), 0);
    const liveParts = [
      duty?.valueText ? `${duty.valueText} no plantão agora` : null,
      `${onlineBrokers.toLocaleString("pt-BR")} ${onlineBrokers === 1 ? "corretor conectado" : "corretores conectados"}`,
      lastDistribution ? `última distribuição ${distributedAgo(new Date(lastDistribution))}` : null,
    ].filter(Boolean).join(" · ");
    const inbox = canAssign ? (
      <AssignSection1a1 count={totalUnassignedForArchive}>
        <DistributionInbox
          key={queueFilter}
          role={context.role}
          manualAssignmentChoiceEnabled={(await getSystemSetting("feature_manual_lead_assignment_offer_choice_enabled")) !== "false"}
          totalUnassigned={totalUnassignedForArchive}
          initialStatusFilter={queueFilter}
          branches={branches.map((branch) => ({ id: branch.id, name: branch.name }))}
          brokers={brokers.map((broker) => ({
            id: broker.id,
            name: broker.name,
            branchId: broker.branchId,
            availabilityStatus: broker.availabilityStatus,
            activeLeads: activeBrokerLeadsMap.get(broker.id) ?? 0,
          }))}
          leads={unassignedLeads.map((lead) => ({ ...lead, createdAt: lead.createdAt.toISOString() }))}
        />
      </AssignSection1a1>
    ) : null;
    return (
      <main className={`arc-venancor ${resumo1a1.gx} ${resumo1a1.page}`} data-skin="diretor">
        <DistributionHead1a1 available={totalAvailable} waiting={totalNewLeads} />
        <LiveStrip1a1 text={liveParts} canAssign={canAssign}
          showQueue={canViewDistributionQueues(context.role) && (!allowedViews || allowedViews.includes("filas"))} />
        {inbox}
        <DirectorDailySummary1a1
          initialData={brokerSummary}
          branches={branches.map((branch) => ({ id: branch.id, name: branch.name }))}
          canFilterBranch={context.role === "director"}
        />
      </main>
    );
  }

  if (directorLite && LITE_TAB_VIEWS.includes(view)) {
    return (
      <>
        <DashboardHeader breadcrumb="Operação comercial" title="Distribuição" summary={liteSummary} />
        <main className={directorDistributionStyles.page}>
          {/* Agora na operação só em mini cards (14/11/2026): os cartões grandes saíram; frios ao lado do plantão. */}
          {view === "resumo_dia" && await shouldShowLiveStatusStrip(context) ? <LiveStatusBoundary context={context} enabled compact /> : null}
          {view === "resumo_dia" ? (
            <section className={directorDistributionStyles.stack} aria-label="Resumo diário da distribuição">
              {assignSection}
              <DirectorDailySummary
                initialData={brokerSummary}
                branches={branches.map((branch) => ({ id: branch.id, name: branch.name }))}
                canFilterBranch={context.role === "director"}
              />
            </section>
          ) : view === "roteamento" ? (
            <section className={directorDistributionStyles.stack} aria-label="Entradas e regras">
              {rulesIntro()}
            </section>
          ) : view === "filas" && canViewDistributionQueues(context.role) && (!allowedViews || allowedViews.includes("filas")) ? (
            <section className={directorDistributionStyles.stack} aria-label="Filas de distribuição">
              {queuesIntro()}
            </section>
          ) : view === "filas" ? null : view === "plantao" ? (
            <section className={directorDistributionStyles.stack} aria-label="Gestão de plantões">
              {plantaoWorkspace}
            </section>
          ) : (
            <section className={directorDistributionStyles.stack} aria-label="Saúde da distribuição">
              {healthIntro()}
            </section>
          )}
        </main>
      </>
    );
  }

  return (
    <>
      <DashboardHeader
        breadcrumb="Operação comercial"
        title="Distribuição"
        rightSlot={
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-ds-vivid-green" aria-hidden="true" />
              <span>
                <strong className="font-semibold text-foreground">{totalAvailable}</strong> disponíveis
              </span>
            </span>
            <span className="h-3.5 w-px bg-border" aria-hidden="true" />
            <span>
              <strong className="font-semibold text-foreground">{totalNewLeads}</strong> aguardando
            </span>
          </div>
        }
      />
      <main className="min-h-full px-4 py-5 lg:px-6 lg:py-7">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
          <DistributionTabsContainer
            initialView={view}
            showQueueDefinition={context.role === "director"}
            roteamentoContent={
              <div className="space-y-5">
                <DisqualifiedLeadsRoutingPanel
                  initialHoldDisqualifiedLeads={holdDisqualifiedLeads}
                  canEdit={context.role === "director"}
                />
                <DddRoutingPanel
                  initialSettings={dddRoutingSettings}
                  queues={queues.map((q) => ({ id: q.id, name: q.name }))}
                  canEdit={context.role === "director"}
                />
                <RoutingMatrixPanel
                  rules={routingRules}
                  queues={queues.map((q) => ({ id: q.id, name: q.name }))}
                  branches={branches.map((b) => ({ id: b.id, name: b.name }))}
                  brokers={brokers.map((b) => ({ id: b.id, name: b.name }))}
                  canEdit={context.role === "director" || context.role === "manager"}
                />
              </div>
            }
            resumoDiaContent={
              <>
              {assignSection}
              <DirectorDailySummary
                initialData={brokerSummary}
                branches={branches.map((b) => ({ id: b.id, name: b.name }))}
                canFilterBranch={context.role === "director"}
              />
              </>
            }
            filasContent={
              context.role === "director" ? (
                <div className="space-y-5">
                  {coldLeadReview ? <ColdLeadRequalificationPanel {...coldLeadReview} /> : null}
                  <QueueControlCenter
                    queues={queuesForControl}
                    branches={branches.map((branch) => ({ id: branch.id, name: branch.name }))}
                    brokers={brokers.map((broker) => ({
                      id: broker.id,
                      name: broker.name,
                      branchId: broker.branchId ?? "",
                      branchName: broker.branchName ?? "",
                    }))}
                    dutySchedules={dutySchedules}
                    campaigns={metaCampaigns}
                    ads={metaAds}
                    campaignRoutes={metaCampaignRoutes.map((r) => ({
                      ...r,
                      queueId: r.queueId ?? "",
                    }))}
                    adRoutes={metaAdRoutes.map((r) => ({ ...r, queueId: r.queueId ?? "" }))}
                    attendanceFlows={attendanceFlowOptions}
                    canEdit
                    settingsPanels={[
                      {
                        id: "sla",
                        label: "SLA de aceite e atendimento",
                        description: "Quanto tempo o corretor tem para aceitar e iniciar o atendimento.",
                        content: (
                          <BrokerAcceptanceSlaPanel
                            initialMinutes={Number(tenantSlaSettings?.slaFirstContactMinutes) || 15}
                            initialAutoRedistribute={
                              tenantSlaSettings?.autoRedistributeOnFeedbackTimeout ?? true
                            }
                            canEdit={context.role === "director" || context.role === "manager"}
                          />
                        ),
                      },
                      {
                        id: "policy",
                        label: "Distribuição inteligente",
                        description: "Como o ranking escolhe o corretor depois do plantão.",
                        content: (
                          <DistributionPolicyPanel
                            canEdit={context.role === "director"}
                            brokers={brokers.map((broker) => ({ id: broker.id, name: broker.name }))}
                            policy={globalPolicy.find((p) => !p.queueId)?.policy ?? {}}
                            plantaoPriority={plantaoPriority}
                          />
                        ),
                      },
                      {
                        id: "how",
                        label: "Como funciona a distribuição",
                        description: "Um único fluxo para qualquer origem: entrada, unidade, fila, corretor e redistribuição.",
                        content: <DistributionStages />,
                      },
                    ]}
                  />
                </div>
              ) : null
            }
            plantaoContent={<div className="grid gap-ds-16">{plantaoWorkspace}</div>}
            saudeHistoricoContent={
              <div className="grid gap-ds-24 xl:grid-cols-[1.15fr_0.85fr]">
                <Card variant="overview">
                  <SectionCardHeader
                    icon={<History />}
                    title="Histórico auditável de decisões"
                    description="Atribuições, redistribuições e intervenções deste escopo."
                  />
                  <div className="max-h-[500px] overflow-y-auto">
                    {recentEvents.length ? (
                      <div className="divide-y divide-border/50">
                        {recentEvents.map((event) => (
                          <div
                            key={event.id}
                            className="flex flex-col gap-ds-4 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <p className="font-ds-inter text-ds-body font-medium text-ds-charcoal">
                                {event.leadName}{" "}
                                <span className="font-normal text-ds-fog">→</span>{" "}
                                {event.brokerName ?? "Aguardando corretor"}
                              </p>
                              <p className="font-ds-inter text-ds-caption text-ds-fog">
                                {event.queueName ?? "Inbox geral"} ·{" "}
                                {event.action.replaceAll("_", " ")}
                                {event.reason ? ` · ${event.reason}` : ""}
                              </p>
                            </div>
                            <time className="shrink-0 font-ds-inter text-ds-caption text-ds-fog">
                              {new Intl.DateTimeFormat("pt-BR", {
                                dateStyle: "short",
                                timeStyle: "short",
                                timeZone: "America/Sao_Paulo",
                              }).format(event.createdAt)}
                            </time>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <DsEmptyState
                        icon={<InboxIcon size={20} />}
                        title="Ainda não há eventos neste escopo"
                        description="Quando a equipe rotear ou atribuir leads, a explicação aparecerá aqui."
                        bordered={false}
                      />
                    )}
                  </div>
                </Card>

                <div className="flex flex-col gap-ds-24">
                  <Card variant="overview">
                    <SectionCardHeader
                      icon={<Workflow />}
                      title="Automação da fila"
                      description="Estado atual do processamento automático."
                      actions={
                            <DsStatusBadge
                              status={
                                !jobHealth.available
                                  ? "secondary"
                                  : !jobConfig.enabled
                                    ? "secondary"
                                    : jobHealth.failed > 0
                                      ? "warning"
                                      : "success"
                              }
                              label={
                                !jobHealth.available
                                  ? "Aguardando migration"
                                  : !jobConfig.enabled
                                    ? "Pausada globalmente"
                                    : jobHealth.failed > 0
                                      ? "Requer atenção"
                                      : "Ativa"
                              }
                            />
                      }
                    />
                    <div className="grid grid-cols-2 gap-2 p-4 sm:gap-3">
                      <StatCard label="Aguardando" value={jobHealth.pending + jobHealth.retrying} sublabel="na fila automática" />
                      <StatCard label="Em processamento" value={jobHealth.processing} sublabel="agora" />
                      <StatCard
                        className="col-span-2"
                        label="Exceções"
                        value={jobHealth.failed}
                        valueClassName={jobHealth.failed > 0 ? "text-destructive" : undefined}
                        sublabel={
                          jobHealth.failed > 0
                            ? "Revisar exceções com o Diretor"
                            : jobHealth.pending + jobHealth.retrying > 0
                              ? "O motor tentará distribuir"
                              : "Nenhuma pendência automática"
                        }
                      />
                    </div>
                  </Card>

                  <Card variant="overview">
                    <SectionCardHeader
                      icon={<Activity />}
                      title="Efeitos pendentes do intake"
                      description="Distribuição e notificações após a entrada do lead."
                      actions={
                            <DsStatusBadge
                              status={effectHealth.failed > 0 ? "warning" : "success"}
                              label={effectHealth.failed > 0 ? "Requer revisão" : "Íntegro"}
                            />
                      }
                    />
                    <div className="grid grid-cols-2 gap-2 p-4 sm:gap-3">
                      <StatCard label="Aguardando" value={effectHealth.pending + effectHealth.retrying} sublabel="na fila de efeitos" />
                      <StatCard label="Processando" value={effectHealth.processing} sublabel="agora" />
                      <StatCard
                        label="Exceções"
                        value={effectHealth.failed}
                        valueClassName={effectHealth.failed > 0 ? "text-destructive" : undefined}
                        sublabel="aguardando revisão"
                      />
                      <StatCard label="Concluídos" value={effectHealth.completed} sublabel="processados" />
                    </div>
                    {failedEffects.length > 0 ? (
                      <div className="flex flex-col gap-ds-8 border-t border-border/50 p-4">
                        {failedEffects.map((effect) => (
                          <div
                            key={effect.id}
                            className="flex flex-col gap-ds-8 rounded-ds-cards border border-ds-ash bg-ds-paper-mist p-ds-12 text-ds-caption sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <p className="font-ds-inter font-medium text-ds-charcoal">
                                {effect.leadName} · {effect.type}
                              </p>
                              <p className="mt-ds-4 font-ds-inter text-ds-fog">
                                {effect.lastErrorCode ?? "Falha de processamento"} · tentativa{" "}
                                {effect.attemptCount} · {effect.lastErrorMessage ?? "Sem detalhe adicional"}
                              </p>
                            </div>
                            <form action={retryLeadEffectAction}>
                              <input type="hidden" name="effectId" value={effect.id} />
                              <DsOutlinedActionButton type="submit" className="!py-ds-4 !px-ds-12 text-ds-caption">
                                Reprocessar
                              </DsOutlinedActionButton>
                            </form>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="border-t border-border/50 p-4 font-ds-inter text-ds-caption text-ds-fog">
                        Nenhuma exceção pendente.
                      </p>
                    )}
                  </Card>
                </div>
              </div>
            }
          />
        </div>
      </main>
    </>
  );
}
