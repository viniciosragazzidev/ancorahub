import { count, eq, and, inArray } from "drizzle-orm";
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
import { cn } from "@/lib/utils";
import {
  getDistributionJobConfig,
  getLeadDistributionJobHealth,
} from "@/features/lead-distribution/jobs";
import { getLeadEffectOutboxHealth } from "@/features/leads/webhooks/services/lead-effect-outbox";
import { retryLeadEffectAction } from "@/features/lead-distribution/actions";

export const dynamic = "force-dynamic";

const activeStatuses = [
  "new",
  "distributed",
  "in_contact",
  "quote_sent",
  "negotiation",
  "documentation_pending",
  "under_analysis",
] as const;

export default async function LeadDistributionPage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") redirect("/access-denied");

  // Managers must have a branch assigned to access distribution
  if (context.role === "manager" && !context.branchId) {
    return (
      <>
        <DashboardHeader breadcrumb="Operação comercial" title="Distribuição" />
        <main className="flex min-h-full flex-col items-center justify-center gap-4 bg-background p-12 text-center">
          <p className="text-sm font-semibold text-foreground">Unidade não definida</p>
          <p className="text-xs text-muted-foreground">
            Seu acesso como gestor não está vinculado a nenhuma unidade. Fale com o diretor para
            ajustar seu cadastro.
          </p>
        </main>
      </>
    );
  }

  const db = getDatabase();

  // Fetch branches with their distribution flags
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

  const [
    brokers,
    unassignedLeads,
    activeBrokerLeads,
    memberCounts,
    availableCounts,
    leadCounts,
    newLeadCounts,
    jobHealth,
    jobConfig,
    effectHealth,
    failedEffects,
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
      })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, context.tenantId),
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
          inArray(schema.leads.branchId, branchIds),
          inArray(schema.leads.status, activeStatuses),
        ),
      )
      .groupBy(schema.leads.corretorId),
    db
      .select({
        branchId: schema.tenantMemberships.branchId,
        count: count(schema.tenantMemberships.id),
      })
      .from(schema.tenantMemberships)
      .where(
        and(
          eq(schema.tenantMemberships.tenantId, context.tenantId),
          eq(schema.tenantMemberships.role, "broker"),
          inArray(schema.tenantMemberships.branchId, branchIds),
        ),
      )
      .groupBy(schema.tenantMemberships.branchId),
    db
      .select({
        branchId: schema.tenantMemberships.branchId,
        count: count(schema.tenantMemberships.id),
      })
      .from(schema.tenantMemberships)
      .where(
        and(
          eq(schema.tenantMemberships.tenantId, context.tenantId),
          eq(schema.tenantMemberships.role, "broker"),
          eq(schema.tenantMemberships.availabilityStatus, "available"),
          eq(schema.tenantMemberships.status, "active"),
          inArray(schema.tenantMemberships.branchId, branchIds),
        ),
      )
      .groupBy(schema.tenantMemberships.branchId),
    db
      .select({ branchId: schema.leads.branchId, count: count(schema.leads.id) })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, context.tenantId),
          inArray(schema.leads.branchId, branchIds),
          inArray(schema.leads.status, activeStatuses),
        ),
      )
      .groupBy(schema.leads.branchId),
    db
      .select({ branchId: schema.leads.branchId, count: count(schema.leads.id) })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, context.tenantId),
          inArray(schema.leads.branchId, branchIds),
          eq(schema.leads.status, "new"),
        ),
      )
      .groupBy(schema.leads.branchId),
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
          context.role === "manager" && context.branchId
            ? eq(schema.leads.branchId, context.branchId)
            : undefined,
        ),
      )
      .orderBy(schema.leadEffectOutbox.updatedAt)
      .limit(20),
  ]);

  const activeBrokerLeadsMap = new Map(
    activeBrokerLeads.map((entry) => [entry.brokerId, Number(entry.count)]),
  );
  const countsByBranch = new Map(memberCounts.map((e) => [e.branchId, Number(e.count)]));
  const availableByBranch = new Map(availableCounts.map((e) => [e.branchId, Number(e.count)]));
  const leadsByBranch = new Map(leadCounts.map((e) => [e.branchId, Number(e.count)]));
  const newByBranch = new Map(newLeadCounts.map((e) => [e.branchId, Number(e.count)]));

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

  // Overall metrics
  const totalBranches = branches.length;
  const acceptingBranches = branches.filter((b) => b.acceptingLeads).length;
  const autoDistributeBranches = branches.filter((b) => b.autoDistribute).length;
  const totalBrokers = [...countsByBranch.values()].reduce((a, b) => a + b, 0);
  const totalAvailable = [...availableByBranch.values()].reduce((a, b) => a + b, 0);
  const totalNewLeads = [...newByBranch.values()].reduce((a, b) => a + b, 0);

  return (
    <>
      <DashboardHeader breadcrumb="Operação comercial" title="Distribuição de Leads" />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        {/* Visão geral — métricas em destaque, ação principal logo abaixo */}
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
        <DistributionInbox
          role={context.role}
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
        {/* Configuração — unidades, corretores e regras de distribuição */}
        <DistributionPanel
          branches={enrichedBranches}
          brokers={brokers.map((broker) => ({
            id: broker.id,
            name: broker.name,
            email: broker.email,
            branchId: broker.branchId,
            branchName: broker.branchName,
            availabilityStatus: broker.availabilityStatus,
            activeLeads: activeBrokerLeadsMap.get(broker.id) ?? 0,
          }))}
          canManageAcceptingLeads={context.role === "director"}
        />
        {/* Monitoramento — saúde do processamento assíncrono */}
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>Automação da fila</CardTitle>
              <CardDescription>
                Estado real do processamento assíncrono desta corretora.
              </CardDescription>
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
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>Efeitos pendentes do intake</CardTitle>
              <CardDescription>
                Distribuição e notificações confirmadas após o recebimento do lead.
              </CardDescription>
            </div>
            <Badge variant={effectHealth.failed > 0 ? "warning" : "success"}>
              {effectHealth.failed > 0 ? "Requer revisão" : "Íntegro"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                    className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        {effect.leadName} · {effect.type}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {effect.lastErrorCode ?? "Falha de processamento"} · tentativa{" "}
                        {effect.attemptCount} · {effect.lastErrorMessage ?? "Sem detalhe adicional"}
                      </p>
                    </div>
                    <form action={retryLeadEffectAction}>
                      <input type="hidden" name="effectId" value={effect.id} />
                      <Button type="submit" size="sm" variant="outline">
                        Reprocessar
                      </Button>
                    </form>
                  </div>
                ))}
              </div>
            ) : (
              <p className="border-t border-border pt-4 text-sm text-muted-foreground">
                Nenhuma exceção pendente.
              </p>
            )}
          </CardContent>
        </Card>
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
