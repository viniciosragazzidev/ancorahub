import { and, count, desc, eq, gte, ilike, inArray, isNull, isNotNull, lt, ne, or, sql } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

import { ManualLeadSheet } from "./_components/manual-lead-sheet";
import { BulkLeadImportDialog } from "./_components/bulk-lead-import-dialog";
import { LeadsLiveSync } from "./_components/leads-live-sync";
import { LeadsFilters } from "./_components/leads-filters";
import { LeadsWorkspace } from "./leads-workspace";
import { WifiHigh, Plus } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { DashboardHeader } from "@/components/dashboard-header";
import { NextUrgentLeadButton } from "@/components/next-urgent-lead-button";
import { ContextNote } from "@/components/ui/context-note";
import { getSystemSetting } from "@/features/system-settings/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { hasEffectiveCapability } from "@/features/custom-roles/service";
import { redirect } from "next/navigation";
import { getDatabase, schema } from "@/shared/db";
import { listAvailableCatalogPlans } from "@/features/global-catalog/queries";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ attention?: string; status?: string; search?: string; branch?: string; new?: string; tipo?: string }> }) {
  const context = await getRequiredTenantContext();
  if (!(await hasEffectiveCapability({ tenantId: context.tenantId, role: context.role, jobTitle: context.jobTitle, customRoleId: context.customRoleId ?? null, permission: "acessar_leads" }))) redirect("/access-denied");
  const filters = await searchParams;
  const db = getDatabase();
  const configuredStagnantDays = Number(await getSystemSetting("feature_central_atencao_stagnant_days") ?? 3);
  const stagnantDays = Number.isInteger(configuredStagnantDays) && configuredStagnantDays >= 1 && configuredStagnantDays <= 30 ? configuredStagnantDays : 3;
  const attention = (filters.attention === "unworked" || filters.attention === "stalled") 
    ? filters.attention 
    : (filters.status === "stalled" || filters.status === "unworked")
    ? (filters.status as "unworked" | "stalled")
    : null;
  const stalledSince = sql<Date>`now() - (${stagnantDays} * interval '1 day')`;
  const attentionNote = attention === "unworked" ? "Exibindo leads novos ou distribuídos que ainda aguardam o primeiro atendimento." : attention === "stalled" ? `Exibindo leads ativos sem avanço de etapa há mais de ${stagnantDays} dias.` : null;
  const isValidStatus = filters.status && (schema.leadStatusValues as readonly string[]).includes(filters.status);
  const statusFilter = attention === "unworked" ? and(inArray(schema.leads.status, ["new", "distributed"]), isNull(schema.leads.serviceStartedAt)) : attention === "stalled" ? and(inArray(schema.leads.status, ["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"]), lt(schema.leads.stageEnteredAt, stalledSince)) : isValidStatus ? eq(schema.leads.status, filters.status as typeof schema.leadStatusValues[number]) : null;
  const searchFilter = filters.search ? or(ilike(schema.leads.nome, `%${filters.search}%`), ilike(schema.leads.telefone, `%${filters.search}%`)) : null;
  const expiredUnworkedBrokerFilter = context.role === "broker"
    ? or(
      ne(schema.leads.status, "distributed"),
      isNotNull(schema.leads.firstContactAt),
      isNull(schema.leads.assignedAt),
      gte(schema.leads.assignedAt, sql`now() - (${schema.tenants.slaFirstContactMinutes}::integer * interval '1 minute')`),
    )
    : null;
  let isMatrix = false;
  if (context.branchId) {
    const [userBranch] = await db
      .select({ name: schema.branches.name })
      .from(schema.branches)
      .where(and(eq(schema.branches.id, context.branchId), eq(schema.branches.tenantId, context.tenantId)))
      .limit(1);
    isMatrix = userBranch?.name?.toLowerCase() === "matriz";
  } else {
    isMatrix = true;
  }

  const isMarketing = context.jobTitle === "marketing";

  const branchFilter = isMarketing
    ? (isMatrix
        ? (filters.branch ? eq(schema.leads.branchId, filters.branch) : null)
        : eq(schema.leads.branchId, context.branchId!)
      )
    : (context.role === "manager" && context.branchId
        ? eq(schema.leads.branchId, context.branchId)
        : context.role === "broker"
        ? eq(schema.leads.corretorId, context.userId)
        : filters.branch
        ? eq(schema.leads.branchId, filters.branch)
        : null);

  const tipoFilter = (filters.tipo === "PF" || filters.tipo === "PME") ? eq(schema.leads.tipo, filters.tipo) : null;
  const where = and(eq(schema.leads.tenantId, context.tenantId), ...(statusFilter ? [statusFilter] : []), ...(searchFilter ? [searchFilter] : []), ...(branchFilter ? [branchFilter] : []), ...(tipoFilter ? [tipoFilter] : []), ...(expiredUnworkedBrokerFilter ? [expiredUnworkedBrokerFilter] : []));
  const isDirector = context.role === "director" || (isMarketing && isMatrix);
  const [availablePlans, leads, legacyPlans, branches, pausedBranchCount, slaSettings, brokers] = await Promise.all([
    listAvailableCatalogPlans(context),
    db.select({
      id: schema.leads.id,
      nome: schema.leads.nome,
      telefone: schema.leads.telefone,
      status: schema.leads.status,
      qualificationStatus: schema.leads.qualificationStatus,
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
    }).from(schema.leads).leftJoin(schema.user, eq(schema.leads.corretorId, schema.user.id)).leftJoin(schema.branches, eq(schema.leads.branchId, schema.branches.id)).innerJoin(schema.tenants, eq(schema.leads.tenantId, schema.tenants.id)).where(where).orderBy(desc(schema.leads.createdAt)),
    db.select({ id: schema.carrierPlans.id, name: schema.carrierPlans.name, carrierName: schema.carriers.name }).from(schema.carrierPlans).innerJoin(schema.carriers, eq(schema.carrierPlans.carrierId, schema.carriers.id)).where(and(eq(schema.carrierPlans.tenantId, context.tenantId), eq(schema.carrierPlans.active, true), eq(schema.carriers.status, "active"))).orderBy(schema.carriers.name, schema.carrierPlans.name),
    db.select({ id: schema.branches.id, name: schema.branches.name }).from(schema.branches).where(eq(schema.branches.tenantId, context.tenantId)),
    isDirector ? db.select({ count: count() }).from(schema.branches).where(and(eq(schema.branches.tenantId, context.tenantId), eq(schema.branches.acceptingLeads, false))).then((r) => Number(r[0]?.count ?? 0)) : Promise.resolve(0),
    db.select({ slaFirstContactMinutes: schema.tenants.slaFirstContactMinutes, slaStagnantDays: schema.tenants.slaStagnantDays }).from(schema.tenants).where(eq(schema.tenants.id, context.tenantId)).then((r) => r[0] ?? { slaFirstContactMinutes: "15", slaStagnantDays: "3" }),
    (context.role === "manager" || context.role === "director")
      ? db.select({ id: schema.user.id, name: schema.user.name, branchId: schema.tenantMemberships.branchId })
          .from(schema.tenantMemberships)
          .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
          .where(and(
            eq(schema.tenantMemberships.tenantId, context.tenantId),
            eq(schema.tenantMemberships.role, "broker"),
            eq(schema.tenantMemberships.status, "active"),
            eq(schema.user.active, true),
            context.role === "manager" && context.branchId ? eq(schema.tenantMemberships.branchId, context.branchId) : undefined
          ))
      : Promise.resolve([]),
  ]);

  // Merge legacy carrier plans with global + private catalog plans
  const seen = new Set<string>();
  const plans: Array<{ id: string; name: string; carrierName: string }> = [];
  for (const p of legacyPlans) {
    if (!seen.has(p.id)) { seen.add(p.id); plans.push(p); }
  }
  for (const p of availablePlans) {
    if (!seen.has(p.planId)) {
      seen.add(p.planId);
      plans.push({ id: p.planId, name: p.planName, carrierName: p.carrierName });
    }
  }

  const slaFirstContactMinutes = Number(slaSettings.slaFirstContactMinutes);
  const slaStagnantDays = Number(slaSettings.slaStagnantDays);
  const leadManagementActionsEnabled = (await getSystemSetting("feature_lead_management_actions_enabled")) !== "false";

  return (
    <>
      <DashboardHeader
        breadcrumb="Operação comercial"
        title="Leads"
        rightSlot={
          <div className="flex items-center gap-2">
            <NextUrgentLeadButton />
            <BulkLeadImportDialog branches={branches} role={context.role} jobTitle={context.jobTitle} branchId={context.branchId} />
            <ManualLeadSheet initiallyOpen={filters.new === "1"} plans={plans} />
          </div>
        }
      />
      <LeadsLiveSync />
      <main className="flex min-h-0 flex-1 flex-col gap-6 bg-background p-4 pb-8 lg:p-6">

        {/* Attention Note */}
        {attentionNote ? <ContextNote variant="warning">{attentionNote}</ContextNote> : null}

        {/* Paused Branch Alert (Refined with theme tokens) */}
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
          branches={isDirector || context.role === "manager" ? branches : []}
          initialBranch={filters.branch}
          initialSearch={filters.search}
          initialStatus={filters.status}
          initialTipo={filters.tipo}
        />

        {/* Workspace or Empty State with CTA */}
        {leads.length ? (
          <LeadsWorkspace
            leads={leads.map((lead) => ({
              ...lead,
              createdAt: lead.createdAt.toISOString(),
              assignedAt: lead.assignedAt?.toISOString() ?? null,
              stageEnteredAt: lead.stageEnteredAt?.toISOString() ?? null,
              serviceStartedAt: lead.serviceStartedAt?.toISOString() ?? null,
              firstContactAt: lead.firstContactAt?.toISOString() ?? null,
            }))}
            contextRole={leadManagementActionsEnabled ? context.role : "broker"}
            contextJobTitle={context.jobTitle}
            contextBranchId={context.branchId}
            slaFirstContactMinutes={slaFirstContactMinutes}
            slaStagnantDays={slaStagnantDays}
            brokers={brokers}
            branches={branches}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-12 text-center bg-card/40">
            <p className="text-sm font-semibold text-foreground">Nenhum lead por enquanto</p>
            <p className="text-xs text-muted-foreground mb-1">Cadastre a primeira oportunidade para começar sua fila.</p>
            <ManualLeadSheet
              initiallyOpen={false}
              plans={plans}
              trigger={
                <Button size="sm" variant="outline">
                  <Plus className="mr-1 size-3.5" /> Cadastrar Lead
                </Button>
              }
            />
          </div>
        )}
      </main>
    </>
  );
}
