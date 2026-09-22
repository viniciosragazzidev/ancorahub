import { count, desc, eq, and, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";

import { Workflow, ArrowUpRight, Inbox as InboxIcon } from "lucide-react";
import { DistributionMetrics } from "./_components/distribution-dashboard";
import { DistributionInbox } from "./_components/distribution-inbox";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { AppPageHeader } from "@/components/app-page-header";
import { DsDashboardCard } from "@/components/ui/ds-dashboard-card";
import { DsStatusBadge } from "@/components/ui/ds-status-badge";
import { DsStatTile } from "@/components/ui/ds-stat-tile";
import { DsEmptyState } from "@/components/ui/ds-empty-state";
import { DsOutlinedActionButton } from "@/components/ui/ds-outlined-action-button";
import { dsButtonVariants } from "@/components/ui/ds-button-variants";
import {
  DsDialog,
  DsDialogTrigger,
  DsDialogPopup,
  DsDialogHeader,
  DsDialogTitle,
  DsDialogDescription,
} from "@/components/ui/ds-dialog";
import { cn } from "@/lib/utils";
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
import { RoutingSimulatorPanel } from "./_components/routing-simulator-panel";
import { fetchRoutingRules } from "@/features/lead-distribution/routing-engine";
import { BrokerDailySummaryPanel } from "./_components/broker-daily-summary-panel";
import { fetchBrokerDailySummary } from "@/features/lead-distribution/broker-summary-service";
import { DutyOperationsWorkspace } from "./plantao/_components/duty-operations-workspace";
import { getDutyRosterSnapshot } from "@/features/lead-distribution/roster-queries";
import { BrokerAcceptanceSlaPanel } from "./_components/broker-acceptance-sla-panel";
import { resolveDistributionView } from "@/features/lead-distribution/distribution-view-access";
import { getHoldDisqualifiedLeads } from "@/features/lead-distribution/disqualified-routing-settings";
import { DisqualifiedLeadsRoutingPanel } from "./_components/disqualified-leads-routing-panel";

export const dynamic = "force-dynamic";

type QueueFilter = "all" | "unassigned" | "queued" | "returned_to_queue";

const activeStatuses = [
  "new",
  "distributed",
  "in_contact",
  "quote_sent",
  "negotiation",
  "documentation_pending",
  "under_analysis",
] as const;

// Static reference content — was previously a permanently-rendered card at
// the top of the Filas tab, eating vertical space on every visit even for
// directors who already know the flow. Moved behind a dialog trigger instead
// (UX pass): the explainer is one click away rather than always in the way.
function DistributionRulesDialog() {
  const stages = [
    { title: "Entrada", text: "Manual, integração ou webhook cria uma intenção rastreável." },
    { title: "Unidade", text: "A regra da fila escolhe a unidade elegível com menor carga." },
    { title: "Fila", text: "Capacidade, ordem e restrições definem quem pode receber." },
    { title: "Corretor", text: "Apenas ativos, disponíveis e compatíveis com o plantão." },
    { title: "Oferta + SLA", text: "Recusa, expiração ou atraso avança para o próximo elegível." },
  ];
  return (
    <DsDialog>
      <DsDialogTrigger
        className={cn(
          dsButtonVariants({ dsVariant: "outlined-action" }),
          "gap-ds-8 self-start",
        )}
      >
        <Workflow size={14} aria-hidden="true" />
        Como funciona a distribuição
      </DsDialogTrigger>
      <DsDialogPopup className="max-w-xl">
        <DsDialogHeader>
          <DsDialogTitle>Como a distribuição acontece</DsDialogTitle>
          <DsDialogDescription>
            Um único fluxo para qualquer origem: entrada, unidade, fila, corretor e redistribuição.
          </DsDialogDescription>
        </DsDialogHeader>
        <ol className="grid gap-ds-12 sm:grid-cols-2">
          {stages.map((stage, index) => (
            <li key={stage.title} className="flex min-w-0 gap-ds-12 rounded-ds-cards border border-ds-ash bg-ds-paper-mist p-ds-12">
              <span
                className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-ds-powder-blue text-[10px] font-semibold text-ds-electric-blue"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="font-ds-inter text-ds-body font-semibold text-ds-charcoal">{stage.title}</p>
                <p className="mt-1 font-ds-inter text-ds-body text-ds-steel">{stage.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </DsDialogPopup>
    </DsDialog>
  );
}

export default async function LeadDistributionPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; status?: string }>;
}) {
  const params = await searchParams;
  const queueFilter: QueueFilter =
    params.status === "unassigned" ||
    params.status === "queued" ||
    params.status === "returned_to_queue"
      ? params.status
      : "all";

  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") redirect("/access-denied");
  const view = resolveDistributionView(context.role, params.view);

  if (context.role === "manager" && !context.branchId) {
    return (
      <>
        <AppPageHeader title="Distribuição" breadcrumb="Operação comercial" />
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
        <AppPageHeader title="Distribuição" breadcrumb="Operação comercial" />
        <main className="flex min-h-full flex-col items-center justify-center bg-ds-canvas-white p-ds-48">
          <DsEmptyState
            icon={<InboxIcon size={20} />}
            title="Nenhuma filial cadastrada"
            description="Crie filiais para poder configurar as regras de distribuição de leads."
            bordered={false}
            action={
              <Link href="/filiais" className={dsButtonVariants({ dsVariant: "outlined-action" })}>
                Ir para Filiais
              </Link>
            }
          />
        </main>
      </>
    );
  }

  // Single consolidated Promise.all for fast TTFB
  const [
    brokers,
    unassignedLeads,
    queueCountsByStatus,
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
  ] = await Promise.all([
    db
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
      ),
    db
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
          context.role === "manager" && context.branchId
            ? eq(schema.leads.branchId, context.branchId)
            : undefined,
        ),
      )
      .orderBy(schema.leads.createdAt),
    db
      .select({
        distributionStatus: schema.leads.distributionStatus,
        oldestAt: sql<string | null>`min(${schema.leads.createdAt})`,
        count: count(schema.leads.id),
      })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, context.tenantId),
          isNull(schema.leads.deletedAt),
          isNull(schema.leads.archivedAt),
          isNull(schema.leads.corretorId),
          inArray(schema.leads.distributionStatus, ["unassigned", "queued", "returned_to_queue"]),
          ne(schema.leads.status, "lost"),
          or(
            isNull(schema.leads.qualificationStatus),
            ne(schema.leads.qualificationStatus, "disqualified"),
          ),
          context.role === "manager" && context.branchId
            ? eq(schema.leads.branchId, context.branchId)
            : undefined,
        ),
      )
      .groupBy(schema.leads.distributionStatus),
    db
      .select({ count: count(schema.leads.id) })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, context.tenantId),
          isNull(schema.leads.deletedAt),
          isNull(schema.leads.archivedAt),
          isNull(schema.leads.corretorId),
        ),
      ),
    db
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
      .groupBy(schema.leads.corretorId),
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
    getLeadDistributionJobHealth(context.tenantId),
    getDistributionJobConfig(),
    getLeadEffectOutboxHealth(context.tenantId),
    db
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
      .limit(20),
    db
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
        aiQualificationEnabled: schema.leadQueues.aiQualificationEnabled,
        colorHue: schema.leadQueues.colorHue,
      })
      .from(schema.leadQueues)
      .leftJoin(schema.branches, eq(schema.leadQueues.branchId, schema.branches.id))
      .where(
        and(eq(schema.leadQueues.tenantId, context.tenantId), isNull(schema.leadQueues.deletedAt)),
      )
      .orderBy(schema.leadQueues.name),
    db
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
      .groupBy(schema.leads.queueId),
    db
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
      .limit(40),
    db
      .select({
        queueId: schema.leadDistributionPolicies.queueId,
        policy: schema.leadDistributionPolicies.policy,
      })
      .from(schema.leadDistributionPolicies)
      .where(
        and(
          eq(schema.leadDistributionPolicies.tenantId, context.tenantId),
          eq(schema.leadDistributionPolicies.enabled, true),
        ),
      ),
    db
      .select({
        campaignId: schema.metaCampaigns.campaignId,
        name: schema.metaCampaigns.name,
        status: schema.metaCampaigns.status,
      })
      .from(schema.metaCampaigns)
      .where(eq(schema.metaCampaigns.tenantId, context.tenantId))
      .orderBy(schema.metaCampaigns.name),
    db
      .select({
        adId: schema.metaAds.adId,
        name: schema.metaAds.name,
        status: schema.metaAds.status,
      })
      .from(schema.metaAds)
      .where(eq(schema.metaAds.tenantId, context.tenantId))
      .orderBy(schema.metaAds.name),
    db
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
      .orderBy(schema.leadQueues.name),
    db
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
      .orderBy(schema.leadQueues.name),
    db
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
      .orderBy(schema.unitDutySchedules.name),
    fetchRoutingRules(context.tenantId),
    fetchBrokerDailySummary(context.tenantId, {
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
    }),
    getDutyRosterSnapshot(context),
    db
      .select({
        slaFirstContactMinutes: schema.tenants.slaFirstContactMinutes,
        autoRedistributeOnFeedbackTimeout: schema.tenants.autoRedistributeOnFeedbackTimeout,
      })
      .from(schema.tenants)
      .where(eq(schema.tenants.id, context.tenantId))
      .limit(1)
      .then(
        (r) => r[0] ?? { slaFirstContactMinutes: "15", autoRedistributeOnFeedbackTimeout: true },
      ),
    getHoldDisqualifiedLeads(context.tenantId),
  ]);

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
    if (activeStatuses.includes(row.status as any)) {
      const currentActive = leadsByBranch.get(row.branchId) ?? 0;
      leadsByBranch.set(row.branchId, currentActive + Number(row.count));
    }
    if (row.status === "new") {
      const currentNew = newByBranch.get(row.branchId) ?? 0;
      newByBranch.set(row.branchId, currentNew + Number(row.count));
    }
  });

  const totalBranches = branches.length;
  const acceptingBranches = branches.filter((b) => b.acceptingLeads).length;
  const autoDistributeBranches = branches.filter((b) => b.autoDistribute).length;
  const totalBrokers = [...countsByBranch.values()].reduce((a, b) => a + b, 0);
  const totalAvailable = [...availableByBranch.values()].reduce((a, b) => a + b, 0);
  const totalNewLeads = [...newByBranch.values()].reduce((a, b) => a + b, 0);

  const queueCounts = new Map(
    queueCountsByStatus.map((row) => [
      row.distributionStatus,
      { count: Number(row.count), oldestAt: row.oldestAt ? new Date(row.oldestAt) : null },
    ]),
  );
  const totalUnassignedForArchive = Number(unassignedArchiveCount[0]?.count ?? 0);

  const queueCards = [
    ...(context.role === "director"
      ? [
          {
            status: "unassigned" as const,
            title: "Sem unidade",
            description: "Aguardando encaminhamento do Diretor.",
          },
        ]
      : []),
    {
      status: "queued" as const,
      title: "Sem corretor",
      description: "Aguardando atribuição ou distribuição automática.",
    },
    {
      status: "returned_to_queue" as const,
      title: "Devolvidos à fila",
      description: "Precisam de revisão antes de uma nova atribuição.",
    },
  ].map((queue) => {
    const aggregate = queueCounts.get(queue.status);
    const oldest = aggregate?.oldestAt ?? null;
    return {
      ...queue,
      count: aggregate?.count ?? 0,
      oldestLabel: !oldest
        ? "Fila em dia"
        : `Item mais antigo desde ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(oldest)}`,
    };
  });

  const queueWaiting = new Map(queueLeadCounts.map((item) => [item.queueId, Number(item.waiting)]));
  const queuePoliciesMap = new Map(
    globalPolicy
      .filter((p) => p.queueId)
      .map((p) => [p.queueId!, readDistributionPolicy(p.policy)]),
  );

  const queuesForControl = queues.map((queue) => {
    const queuePolicy = queuePoliciesMap.get(queue.id);
    return {
      ...queue,
      allowedBranchIds: queuePolicy?.allowedBranchIds ?? [],
      allowedBrokerIds: queuePolicy?.allowedBrokerIds ?? [],
      allowedSourceIds: queuePolicy?.allowedSourceIds ?? [],
      waiting: queueWaiting.get(queue.id) ?? 0,
      members: queue.branchId ? (countsByBranch.get(queue.branchId) ?? 0) : totalBrokers,
      activeLeads: queue.branchId ? (leadsByBranch.get(queue.branchId) ?? 0) : totalNewLeads,
    };
  });

  return (
    <>
      <AppPageHeader
        title="Central de distribuição"
        breadcrumb="Operação comercial / Distribuição"
        description="Configure entradas, filas e plantões; acompanhe a operação no mesmo espaço."
        context={
          <DsStatusBadge
            status={jobHealth.available && jobHealth.failed === 0 ? "success" : "warning"}
            label={jobHealth.available && jobHealth.failed === 0 ? "Motor operacional" : "Atenção no motor"}
          />
        }
        actions={
          <div className="flex items-center gap-ds-16 font-ds-inter text-ds-body text-ds-steel">
            <span className="flex items-center gap-ds-8">
              <span className="size-1.5 rounded-full bg-ds-vivid-green" aria-hidden="true" />
              <span>
                <strong className="font-semibold text-ds-charcoal">{totalAvailable}</strong> disponíveis
              </span>
            </span>
            <span className="h-4 w-px bg-ds-ash" aria-hidden="true" />
            <span>
              <strong className="font-semibold text-ds-charcoal">{totalNewLeads}</strong> aguardando
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
                <RoutingMatrixPanel
                  rules={routingRules}
                  queues={queues.map((q) => ({ id: q.id, name: q.name }))}
                  branches={branches.map((b) => ({ id: b.id, name: b.name }))}
                  brokers={brokers.map((b) => ({ id: b.id, name: b.name }))}
                  canEdit={context.role === "director" || context.role === "manager"}
                />
                <RoutingSimulatorPanel
                  queues={queues.map((q) => ({ id: q.id, name: q.name }))}
                  branches={branches.map((b) => ({ id: b.id, name: b.name }))}
                  brokers={brokers.map((b) => ({ id: b.id, name: b.name }))}
                />
              </div>
            }
            resumoDiaContent={
              <BrokerDailySummaryPanel
                initialData={brokerSummary}
                branches={branches.map((b) => ({ id: b.id, name: b.name }))}
                canFilterBranch={context.role === "director"}
              />
            }
            filasContent={
              context.role === "director" ? (
                <>
                  <DistributionRulesDialog />
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
                    canEdit
                  />
                  <BrokerAcceptanceSlaPanel
                    initialMinutes={Number(tenantSlaSettings?.slaFirstContactMinutes) || 15}
                    initialAutoRedistribute={
                      tenantSlaSettings?.autoRedistributeOnFeedbackTimeout ?? true
                    }
                    canEdit={context.role === "director" || context.role === "manager"}
                  />
                  <DistributionPolicyPanel
                    canEdit={context.role === "director"}
                    brokers={brokers.map((broker) => ({ id: broker.id, name: broker.name }))}
                    policy={globalPolicy.find((p) => !p.queueId)?.policy ?? {}}
                  />
                </>
              ) : null
            }
            operarContent={
              <>
                <DistributionMetrics
                  metrics={{
                    totalBranches,
                    acceptingBranches,
                    autoDistributeBranches,
                    totalBrokers,
                    totalAvailable,
                    totalNewLeads,
                  }}
                />
                <section aria-labelledby="filas-de-acao" className="flex flex-col gap-ds-12">
                  <div>
                    <h2 id="filas-de-acao" className="font-ds-inter text-ds-body-lg font-semibold text-ds-charcoal">
                      Filas de ação rápida
                    </h2>
                    <p className="mt-ds-4 font-ds-inter text-ds-body text-ds-fog">
                      Priorize a fila mais antiga sob sua responsabilidade.
                    </p>
                  </div>
                  {/* Was 2-3 full Cards, one per queue, each repeating the same
                      header/border/padding chrome. Collapsed into a single
                      card with a row per queue — same information, far less
                      vertical space and easier to scan at a glance. */}
                  <DsDashboardCard className="divide-y divide-ds-ash p-0">
                    {queueCards.map((queue) => (
                      <div
                        key={queue.status}
                        className="flex flex-col gap-ds-12 px-ds-16 py-ds-16 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-ds-12 min-w-0">
                          <DsStatusBadge
                            status={queue.count > 0 ? "warning" : "success"}
                            label={queue.count}
                          />
                          <div className="min-w-0">
                            <p className="font-ds-inter text-ds-body font-semibold text-ds-charcoal">
                              {queue.title}
                            </p>
                            <p className="truncate font-ds-inter text-ds-caption text-ds-fog">
                              {queue.description} · {queue.oldestLabel}
                            </p>
                          </div>
                        </div>
                        <Link
                          href={`/leads/distribuicao?view=operar&status=${queue.status}#inbox-distribuicao`}
                          className={cn(
                            dsButtonVariants({ dsVariant: "outlined-action" }),
                            "shrink-0 self-start gap-ds-4 !py-ds-4 !px-ds-12 text-ds-caption sm:self-auto",
                          )}
                        >
                          Abrir fila
                          <ArrowUpRight size={12} aria-hidden="true" />
                        </Link>
                      </div>
                    ))}
                  </DsDashboardCard>
                </section>
                <div id="inbox-distribuicao">
                  <DistributionInbox
                    key={queueFilter}
                    role={context.role}
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
                </div>
              </>
            }
            plantaoContent={
              <DutyOperationsWorkspace
                snapshot={dutyRoster}
                queues={queuesForControl
                  .filter((queue) => queue.status === "active")
                  .map((queue) => ({ id: queue.id, name: queue.name }))}
              />
            }
            saudeHistoricoContent={
              <div className="grid gap-ds-24 xl:grid-cols-[1.15fr_0.85fr]">
                <DsDashboardCard className="!p-0">
                  <div className="border-b border-ds-ash px-ds-16 py-ds-16">
                    <p className="font-ds-inter text-ds-body-lg font-semibold text-ds-charcoal">
                      Histórico auditável de decisões
                    </p>
                    <p className="mt-ds-4 font-ds-inter text-ds-body text-ds-steel">
                      Atribuições, redistribuições e intervenções deste escopo.
                    </p>
                  </div>
                  <div className="max-h-[500px] overflow-y-auto">
                    {recentEvents.length ? (
                      <div className="divide-y divide-ds-ash">
                        {recentEvents.map((event) => (
                          <div
                            key={event.id}
                            className="flex flex-col gap-ds-4 px-ds-16 py-ds-16 sm:flex-row sm:items-center sm:justify-between"
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
                </DsDashboardCard>

                <div className="flex flex-col gap-ds-24">
                  <DsDashboardCard>
                    <div className="flex items-start justify-between gap-ds-16">
                      <div>
                        <p className="font-ds-inter text-ds-body-lg font-semibold text-ds-charcoal">
                          Automação da fila
                        </p>
                        <p className="mt-ds-4 font-ds-inter text-ds-body text-ds-steel">
                          Estado atual do processamento automático.
                        </p>
                      </div>
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
                    </div>
                    <div className="mt-ds-16 grid gap-ds-16 border-t border-ds-ash pt-ds-16 sm:grid-cols-2">
                      <DsStatTile label="Aguardando" value={jobHealth.pending + jobHealth.retrying} />
                      <DsStatTile label="Em processamento" value={jobHealth.processing} />
                      <DsStatTile
                        label="Exceções"
                        value={jobHealth.failed}
                        tone={jobHealth.failed > 0 ? "destructive" : "default"}
                      />
                      <DsStatTile
                        label="Próximo passo"
                        hint={
                          jobHealth.failed > 0
                            ? "Revisar exceções com o Diretor"
                            : jobHealth.pending + jobHealth.retrying > 0
                              ? "O motor tentará distribuir"
                              : "Nenhuma pendência automática"
                        }
                      />
                    </div>
                  </DsDashboardCard>

                  <DsDashboardCard>
                    <div className="flex items-start justify-between gap-ds-16">
                      <div>
                        <p className="font-ds-inter text-ds-body-lg font-semibold text-ds-charcoal">
                          Efeitos pendentes do intake
                        </p>
                        <p className="mt-ds-4 font-ds-inter text-ds-body text-ds-steel">
                          Distribuição e notificações após a entrada do lead.
                        </p>
                      </div>
                      <DsStatusBadge
                        status={effectHealth.failed > 0 ? "warning" : "success"}
                        label={effectHealth.failed > 0 ? "Requer revisão" : "Íntegro"}
                      />
                    </div>
                    <div className="mt-ds-16 grid gap-ds-16 border-t border-ds-ash pt-ds-16 sm:grid-cols-2">
                      <DsStatTile label="Aguardando" value={effectHealth.pending + effectHealth.retrying} />
                      <DsStatTile label="Processando" value={effectHealth.processing} />
                      <DsStatTile
                        label="Exceções"
                        value={effectHealth.failed}
                        tone={effectHealth.failed > 0 ? "destructive" : "default"}
                      />
                      <DsStatTile label="Concluídos" value={effectHealth.completed} tone="success" />
                    </div>
                    {failedEffects.length > 0 ? (
                      <div className="mt-ds-16 flex flex-col gap-ds-8 border-t border-ds-ash pt-ds-16">
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
                      <p className="mt-ds-16 border-t border-ds-ash pt-ds-16 font-ds-inter text-ds-caption text-ds-fog">
                        Nenhuma exceção pendente.
                      </p>
                    )}
                  </DsDashboardCard>
                </div>
              </div>
            }
          />
        </div>
      </main>
    </>
  );
}
