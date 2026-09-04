import { count, desc, eq, and, inArray, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";

import { DashboardHeader } from "@/components/dashboard-header";
import { DistributionMetrics, DistributionPanel } from "./_components/distribution-dashboard";
import { DistributionInbox } from "./_components/distribution-inbox";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export const dynamic = "force-dynamic";

type DistributionView = "roteamento" | "resumo_dia" | "filas" | "operar" | "plantao" | "saude_historico";
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

export default async function LeadDistributionPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; status?: string }>;
}) {
  const params = await searchParams;
  const view: DistributionView =
    params.view === "resumo_dia" || params.view === "resumo" || params.view === "filas" || params.view === "operar" || params.view === "plantao" || params.view === "saude_historico" || params.view === "saude" || params.view === "historico"
      ? (params.view === "saude" || params.view === "historico" ? "saude_historico" : (params.view === "resumo" ? "resumo_dia" : (params.view as DistributionView)))
      : "roteamento";

  const queueFilter: QueueFilter =
    params.status === "unassigned" || params.status === "queued" || params.status === "returned_to_queue"
      ? params.status
      : "all";

  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") redirect("/access-denied");

  if (context.role === "manager" && !context.branchId) {
    return (
      <>
        <DashboardHeader breadcrumb="Operação comercial" title="Distribuição" />
        <main className="flex min-h-full flex-col items-center justify-center gap-4 bg-background p-12 text-center">
          <p className="text-sm font-semibold text-foreground">Unidade não definida</p>
          <p className="text-xs text-muted-foreground">
            Seu acesso como gestor não está vinculado a nenhuma unidade. Fale com o diretor para ajustar seu cadastro.
          </p>
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
    })
    .from(schema.branches)
    .where(branchScope);

  const branchIds = branches.map((b) => b.id);
  if (!branchIds.length) {
    return (
      <>
        <DashboardHeader breadcrumb="Operação comercial" title="Distribuição" />
        <main className="flex min-h-full flex-col items-center justify-center gap-4 bg-background p-12 text-center">
          <p className="text-sm font-semibold text-foreground">Nenhuma filial cadastrada</p>
          <p className="text-xs text-muted-foreground mb-2">
            Crie filiais para poder configurar as regras de distribuição de leads.
          </p>
          <Button render={<Link href="/filiais" />} size="sm" variant="outline">
            Ir para Filiais
          </Button>
        </main>
      </>
    );
  }

  // Single consolidated Promise.all for fast TTFB
  const [
    brokers,
    unassignedLeads,
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
          inArray(schema.leads.distributionStatus, ["unassigned", "queued", "returned_to_queue"]),
          context.role === "manager" && context.branchId
            ? eq(schema.leads.branchId, context.branchId)
            : undefined,
        ),
      )
      .orderBy(schema.leads.createdAt)
      .limit(100),
    db
      .select({ brokerId: schema.leads.corretorId, count: count(schema.leads.id) })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, context.tenantId),
          isNull(schema.leads.deletedAt),
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
          context.role === "manager" && context.branchId
            ? eq(schema.leads.branchId, context.branchId)
            : undefined,
        ),
      )
      .orderBy(schema.leadEffectOutbox.updatedAt)
      .limit(20),
    db.select({
      id: schema.leadQueues.id,
      name: schema.leadQueues.name,
      branchId: schema.leadQueues.branchId,
      exclusiveDutyScheduleId: schema.leadQueues.exclusiveDutyScheduleId,
      branchName: schema.branches.name,
      status: schema.leadQueues.status,
      assignmentMode: schema.leadQueues.assignmentMode,
      assignmentStrategy: schema.leadQueues.assignmentStrategy,
      capacityEnabled: schema.leadQueues.capacityEnabled,
      capacityPerBroker: schema.leadQueues.capacityPerBroker,
      aiQualificationEnabled: schema.leadQueues.aiQualificationEnabled,
    }).from(schema.leadQueues).leftJoin(schema.branches, eq(schema.leadQueues.branchId, schema.branches.id))
      .where(and(eq(schema.leadQueues.tenantId, context.tenantId), isNull(schema.leadQueues.deletedAt)))
      .orderBy(schema.leadQueues.name),
    db.select({ queueId: schema.leads.queueId, waiting: count(schema.leads.id) }).from(schema.leads)
      .where(and(eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt), inArray(schema.leads.branchId, branchIds), inArray(schema.leads.distributionStatus, ["queued", "returned_to_queue"])))
      .groupBy(schema.leads.queueId),
    db.select({ id: schema.leadDistributionEvents.id, action: schema.leadDistributionEvents.action, reason: schema.leadDistributionEvents.reason, createdAt: schema.leadDistributionEvents.createdAt, leadName: schema.leads.nome, queueName: schema.leadQueues.name, brokerName: schema.user.name })
      .from(schema.leadDistributionEvents).innerJoin(schema.leads, eq(schema.leadDistributionEvents.leadId, schema.leads.id))
      .leftJoin(schema.leadQueues, eq(schema.leadDistributionEvents.toQueueId, schema.leadQueues.id))
      .leftJoin(schema.user, eq(schema.leadDistributionEvents.newOwnerId, schema.user.id))
      .where(and(eq(schema.leadDistributionEvents.tenantId, context.tenantId), isNull(schema.leads.deletedAt), context.role === "manager" && context.branchId ? eq(schema.leads.branchId, context.branchId) : undefined))
      .orderBy(desc(schema.leadDistributionEvents.createdAt)).limit(40),
    db.select({ queueId: schema.leadDistributionPolicies.queueId, policy: schema.leadDistributionPolicies.policy }).from(schema.leadDistributionPolicies)
      .where(and(eq(schema.leadDistributionPolicies.tenantId, context.tenantId), eq(schema.leadDistributionPolicies.enabled, true))),
    db.select({ campaignId: schema.metaCampaigns.campaignId, name: schema.metaCampaigns.name, status: schema.metaCampaigns.status })
      .from(schema.metaCampaigns)
      .where(eq(schema.metaCampaigns.tenantId, context.tenantId))
      .orderBy(schema.metaCampaigns.name),
    db.select({ adId: schema.metaAds.adId, name: schema.metaAds.name, status: schema.metaAds.status })
      .from(schema.metaAds)
      .where(eq(schema.metaAds.tenantId, context.tenantId))
      .orderBy(schema.metaAds.name),
    db.select({ campaignId: schema.metaCampaignQueueRoutes.campaignId, queueId: schema.metaCampaignQueueRoutes.queueId, queueName: schema.leadQueues.name, enabled: schema.metaCampaignQueueRoutes.enabled })
      .from(schema.metaCampaignQueueRoutes).leftJoin(schema.leadQueues, eq(schema.metaCampaignQueueRoutes.queueId, schema.leadQueues.id))
      .where(and(
        eq(schema.metaCampaignQueueRoutes.tenantId, context.tenantId),
        context.role === "manager" && context.branchId
          ? eq(schema.leadQueues.branchId, context.branchId)
          : undefined,
      )).orderBy(schema.leadQueues.name),
    db.select({ adId: schema.metaAdQueueRoutes.adId, queueId: schema.metaAdQueueRoutes.queueId, queueName: schema.leadQueues.name, enabled: schema.metaAdQueueRoutes.enabled })
      .from(schema.metaAdQueueRoutes).leftJoin(schema.leadQueues, eq(schema.metaAdQueueRoutes.queueId, schema.leadQueues.id))
      .where(and(
        eq(schema.metaAdQueueRoutes.tenantId, context.tenantId),
        context.role === "manager" && context.branchId
          ? eq(schema.leadQueues.branchId, context.branchId)
          : undefined,
      )).orderBy(schema.leadQueues.name),
    db.select({
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
      .where(and(eq(schema.unitDutySchedules.tenantId, context.tenantId), eq(schema.unitDutySchedules.status, "active")))
      .orderBy(schema.unitDutySchedules.name),
    fetchRoutingRules(context.tenantId),
    fetchBrokerDailySummary(context.tenantId, {
      startDate: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 0, 0, 0, 0),
      endDate: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 23, 59, 59, 999),
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
      .then((r) => r[0] ?? { slaFirstContactMinutes: "15", autoRedistributeOnFeedbackTimeout: true }),
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

  const enrichedBranches = branches.map((branch) => ({
    id: branch.id,
    name: branch.name,
    status: branch.status,
    acceptingLeads: branch.acceptingLeads,
    autoDistribute: branch.autoDistribute,
    memberCount: countsByBranch.get(branch.id) ?? 0,
    availableBrokers: availableByBranch.get(branch.id) ?? 0,
    activeLeads: leadsByBranch.get(branch.id) ?? 0,
    newLeads: newByBranch.get(branch.id) ?? 0,
  }));

  const totalBranches = branches.length;
  const acceptingBranches = branches.filter((b) => b.acceptingLeads).length;
  const autoDistributeBranches = branches.filter((b) => b.autoDistribute).length;
  const totalBrokers = [...countsByBranch.values()].reduce((a, b) => a + b, 0);
  const totalAvailable = [...availableByBranch.values()].reduce((a, b) => a + b, 0);
  const totalNewLeads = [...newByBranch.values()].reduce((a, b) => a + b, 0);

  const queueCards = ([
    ...(context.role === "director"
      ? [{ status: "unassigned" as const, title: "Sem unidade", description: "Aguardando encaminhamento do Diretor." }]
      : []),
    { status: "queued" as const, title: "Sem corretor", description: "Aguardando atribuição ou distribuição automática." },
    { status: "returned_to_queue" as const, title: "Devolvidos à fila", description: "Precisam de revisão antes de uma nova atribuição." },
  ]).map((queue) => {
    const leads = unassignedLeads.filter((lead) => lead.distributionStatus === queue.status);
    const oldest = leads[0]?.createdAt;
    return {
      ...queue,
      count: leads.length,
      oldestLabel: !oldest ? "Fila em dia" : `Item mais antigo desde ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(oldest)}`,
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
      waiting: queueWaiting.get(queue.id) ?? 0,
      members: queue.branchId ? (countsByBranch.get(queue.branchId) ?? 0) : totalBrokers,
      activeLeads: queue.branchId ? (leadsByBranch.get(queue.branchId) ?? 0) : totalNewLeads,
    };
  });

  return (
    <>
      <DashboardHeader breadcrumb="Operação comercial" title="Central de Distribuição de Leads" />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <DistributionTabsContainer
          initialView={view}
          roteamentoContent={
            <div className="space-y-6">
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
            <>
              <QueueControlCenter
                queues={queuesForControl}
                branches={branches.map((branch) => ({ id: branch.id, name: branch.name }))}
                brokers={brokers.map((broker) => ({ id: broker.id, name: broker.name, branchId: broker.branchId ?? "", branchName: broker.branchName ?? "" }))}
                dutySchedules={dutySchedules}
                campaigns={metaCampaigns}
                ads={metaAds}
                campaignRoutes={metaCampaignRoutes.map((r) => ({ ...r, queueId: r.queueId ?? "" }))}
                adRoutes={metaAdRoutes.map((r) => ({ ...r, queueId: r.queueId ?? "" }))}
                canEdit
              />
              <BrokerAcceptanceSlaPanel
                initialMinutes={Number(tenantSlaSettings?.slaFirstContactMinutes) || 15}
                initialAutoRedistribute={tenantSlaSettings?.autoRedistributeOnFeedbackTimeout ?? true}
                canEdit={context.role === "director" || context.role === "manager"}
              />
              <DistributionPolicyPanel
                canEdit={context.role === "director"}
                brokers={brokers.map((broker) => ({ id: broker.id, name: broker.name }))}
                policy={globalPolicy.find((p) => !p.queueId)?.policy ?? {}}
              />
            </>
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
              <section aria-labelledby="filas-de-acao" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="md:col-span-2 xl:col-span-3">
                  <h2 id="filas-de-acao" className="text-base font-semibold">Filas de ação rápida</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Comece pela fila mais antiga que está sob sua responsabilidade.</p>
                </div>
                {queueCards.map((queue) => (
                  <Card key={queue.status} variant="overview" className="gap-0">
                    <CardHeader className="p-4 pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-base">{queue.title}</CardTitle>
                          <CardDescription className="mt-1">{queue.description}</CardDescription>
                        </div>
                        <Badge variant={queue.count > 0 ? "warning" : "success"}>{queue.count}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between gap-3 border-t border-border/60 p-4 pt-3">
                      <span className="text-xs text-muted-foreground">{queue.oldestLabel}</span>
                      <Button render={<Link href={`/leads/distribuicao?view=operar&status=${queue.status}#inbox-distribuicao`} />} size="xs" variant="outline">
                        Abrir fila
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </section>
              <div id="inbox-distribuicao">
                <DistributionInbox
                  key={queueFilter}
                  role={context.role}
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
            <DutyOperationsWorkspace snapshot={dutyRoster} />
          }
          saudeHistoricoContent={
            <div className="grid gap-6 lg:grid-cols-2">
              <Card variant="overview">
                <CardHeader>
                  <CardTitle>Histórico auditável de decisões</CardTitle>
                  <CardDescription>Registro de atribuições, redistribuições e intervenções manuais.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 max-h-[500px] overflow-y-auto">
                  {recentEvents.length ? (
                    <div className="divide-y divide-border">
                      {recentEvents.map((event) => (
                        <div key={event.id} className="flex flex-col gap-1 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-medium text-foreground">
                              {event.leadName} <span className="font-normal text-muted-foreground">→</span> {event.brokerName ?? "Aguardando corretor"}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {event.queueName ?? "Inbox geral"} · {event.action.replaceAll("_", " ")}{event.reason ? ` · ${event.reason}` : ""}
                            </p>
                          </div>
                          <time className="shrink-0 text-[10px] text-muted-foreground">
                            {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(event.createdAt)}
                          </time>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-5 py-12 text-center">
                      <p className="text-sm font-medium">Ainda não há eventos neste escopo</p>
                      <p className="mt-1 text-xs text-muted-foreground">Quando a equipe rotear ou atribuir leads, a explicação aparecerá aqui.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                    <div>
                      <CardTitle>Automação da fila</CardTitle>
                      <CardDescription>Estado real do processamento assíncrono desta corretora.</CardDescription>
                    </div>
                    <Badge
                      variant={
                        !jobHealth.available
                          ? "outline"
                          : !jobConfig.enabled
                            ? "outline"
                            : jobHealth.failed > 0
                              ? "warning"
                              : "success"
                      }
                    >
                      {!jobHealth.available
                        ? "Aguardando migration"
                        : !jobConfig.enabled
                          ? "Pausada globalmente"
                          : jobHealth.failed > 0
                            ? "Requer atenção"
                            : "Ativa"}
                    </Badge>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    <Stat label="Aguardando" value={jobHealth.pending + jobHealth.retrying} />
                    <Stat label="Em processamento" value={jobHealth.processing} />
                    <Stat
                      label="Exceções"
                      value={jobHealth.failed}
                      tone={jobHealth.failed > 0 ? "warning" : undefined}
                    />
                    <Stat
                      label="Próximo passo"
                      hint={
                        jobHealth.failed > 0
                          ? "Revisar exceções com o Diretor"
                          : jobHealth.pending + jobHealth.retrying > 0
                            ? "O motor tentará distribuir"
                            : "Nenhuma pendência automática"
                      }
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                    <div>
                      <CardTitle>Efeitos pendentes do intake</CardTitle>
                      <CardDescription>Distribuição e notificações confirmadas após o recebimento do lead.</CardDescription>
                    </div>
                    <Badge variant={effectHealth.failed > 0 ? "warning" : "success"}>
                      {effectHealth.failed > 0 ? "Requer revisão" : "Íntegro"}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Stat label="Aguardando" value={effectHealth.pending + effectHealth.retrying} />
                      <Stat label="Processando" value={effectHealth.processing} />
                      <Stat
                        label="Exceções"
                        value={effectHealth.failed}
                        tone={effectHealth.failed > 0 ? "warning" : undefined}
                      />
                      <Stat label="Concluídos" value={effectHealth.completed} />
                    </div>
                    {failedEffects.length > 0 ? (
                      <div className="space-y-2 border-t border-border pt-4">
                        {failedEffects.map((effect) => (
                          <div
                            key={effect.id}
                            className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-medium">
                                {effect.leadName} · {effect.type}
                              </p>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {effect.lastErrorCode ?? "Falha de processamento"} · tentativa{" "}
                                {effect.attemptCount} · {effect.lastErrorMessage ?? "Sem detalhe adicional"}
                              </p>
                            </div>
                            <form action={retryLeadEffectAction}>
                              <input type="hidden" name="effectId" value={effect.id} />
                              <Button type="submit" size="xs" variant="outline">
                                Reprocessar
                              </Button>
                            </form>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="border-t border-border pt-4 text-xs text-muted-foreground">
                        Nenhuma exceção pendente.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          }
        />
      </main>
    </>
  );
}

function Stat(props: { label: string; tone?: "warning" } & ({ value: number } | { hint: string })) {
  const { label, tone } = props;
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {"value" in props ? (
        <p
          className={cn(
            "mt-1 text-lg font-semibold tabular-nums",
            tone === "warning" && "text-amber-600 dark:text-amber-400",
          )}
        >
          {props.value}
        </p>
      ) : (
        <p className="mt-1 text-sm font-medium text-foreground">{props.hint}</p>
      )}
    </div>
  );
}
