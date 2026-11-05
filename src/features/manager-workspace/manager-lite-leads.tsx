import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { RegisterSaleButton } from "@/app/(dashboard)/leads/[id]/register-sale-button";
import { canManagementRegisterSale } from "@/features/post-sale/register-sale-access";
import { cargoAllowsRegisterSale } from "@/features/post-sale/register-sale-access-server";
import { getDatabase, schema } from "@/shared/db";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getManagerUnitScope } from "@/features/broker-workspace/manager-unit-scope";
import { getManagerLiteLeadDetail, getManagerLiteLeads } from "@/features/supervisor-workspace/manager-lite-queries";
import { hasEffectiveCapability } from "@/features/custom-roles/service";
import { SupervisorLeadsRadar } from "@/features/supervisor-workspace/supervisor-leads-radar";
import { withRadarSignals } from "@/features/supervisor-workspace/radar-signals";
import { SupervisorLeadDetail } from "@/features/supervisor-workspace/supervisor-lead-detail";

export async function ManagerLiteLeadsPage() {
  const context = await getRequiredTenantContext();
  const scope = getManagerUnitScope(context);
  if (!scope) return <div className="arc-venancor p-6"><EmptyState title="Sua unidade ainda não está configurada" description="Peça ao administrador para vincular seu acesso a uma unidade. Seus leads aparecerão aqui quando o vínculo estiver ativo." /></div>;
  const data = await getManagerLiteLeads(context);
  const leads = await withRadarSignals(scope.tenantId, data.leads);
  return <SupervisorLeadsRadar data={{ ...data, leads }} now={new Date().toISOString()} audience="manager" />;
}

export async function ManagerLiteLeadDetailPage({ leadId }: { leadId: string }) {
  const context = await getRequiredTenantContext();
  if (!(await hasEffectiveCapability({ tenantId: context.tenantId, role: context.role, jobTitle: context.jobTitle, customRoleId: context.customRoleId ?? null, permission: "acessar_leads" }))) notFound();
  const data = await getManagerLiteLeadDetail(context, leadId);
  if (!data) notFound();
  // Registrar venda on a broker's lead of the unit (04/11); the query already keeps the lead inside the unit.
  const scope = getManagerUnitScope(context);
  const canRegisterSale = canManagementRegisterSale({ role: context.role, userId: context.userId, branchId: context.branchId, lead: { corretorId: data.lead.ownerId, branchId: scope?.branchId ?? null, status: data.lead.status } })
    && (await cargoAllowsRegisterSale(context));
  const carriers = canRegisterSale
    ? await getDatabase().select({ id: schema.carriers.id, name: schema.carriers.name }).from(schema.carriers)
      .where(and(eq(schema.carriers.tenantId, context.tenantId), eq(schema.carriers.status, "active"))).orderBy(schema.carriers.name)
      .catch(() => [])
    : [];
  return <SupervisorLeadDetail
    lead={data.lead}
    lightLead={data.lightLead}
    requirements={data.requirements}
    leadDocuments={data.leadDocuments}
    conversation={data.conversation}
    brokerWhatsAppConnected={data.brokerWhatsAppConnected}
    timeline={data.timeline}
    now={new Date().toISOString()}
    managerBrokers={data.brokers.filter((broker) => broker.id !== data.lead.ownerId)}
    tasks={data.tasks}
    documents={data.documents}
    saleAction={canRegisterSale ? <RegisterSaleButton leadId={data.lead.id} documents={data.leadDocuments} carriers={carriers} /> : undefined}
  />;
}
