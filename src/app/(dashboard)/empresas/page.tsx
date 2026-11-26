import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";
import { Plus } from "lucide-react";

import { DashboardHeader } from "@/components/dashboard-header";
import page from "@/components/lite/page/lite-page.module.css";
import { countCompanyLeads } from "@/features/companies/company-portfolio";
import { buildCompanyLeadCountScope, buildCompanyReadScope } from "@/features/companies/read-scope";
import { hasEffectiveCapability } from "@/features/custom-roles/service";
import { getSystemSetting } from "@/features/system-settings/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { CompaniesWorkspace, type CompanyLeadRow, type CompanyRow } from "./_components/companies-workspace";

export const dynamic = "force-dynamic";

/**
 * Empresas (25/11, "Empresas" do DeskComm): a carteira PJ numa tabela Lite com busca e gaveta. Diretor vê a empresa
 * toda, gestor a unidade, supervisor e corretor só as empresas com lead seu (buildCompanyReadScope). Os leads da
 * gaveta seguem o mesmo escopo dos leads (buildCompanyLeadCountScope).
 */
export default async function EmpresasPage() {
  const context = await getRequiredTenantContext();
  const canAccess = await hasEffectiveCapability({
    tenantId: context.tenantId,
    role: context.role,
    jobTitle: context.jobTitle,
    customRoleId: context.customRoleId ?? null,
    permission: "acessar_leads",
  });
  if (!canAccess) redirect("/access-denied");
  const enabled = (await getSystemSetting("feature_commercial_workspace_enabled")) !== "false";
  if (!enabled) redirect("/leads");

  const db = getDatabase();
  const companyScope = buildCompanyReadScope(context);
  const leadScope = buildCompanyLeadCountScope(context);
  const [companyRows, leadRows] = await Promise.all([
    db
      .select({
        id: schema.companies.id,
        name: schema.companies.name,
        legalName: schema.companies.legalName,
        cnpj: schema.companies.cnpj,
        employeeCount: schema.companies.employeeCount,
        branchName: schema.branches.name,
      })
      .from(schema.companies)
      .leftJoin(schema.branches, and(eq(schema.companies.branchId, schema.branches.id), eq(schema.branches.tenantId, context.tenantId)))
      .where(companyScope)
      .orderBy(desc(schema.companies.createdAt)),
    db
      .select({
        id: schema.leads.id,
        companyId: schema.leads.companyId,
        nome: schema.leads.nome,
        status: schema.leads.status,
        corretorName: schema.user.name,
        createdAt: schema.leads.createdAt,
      })
      .from(schema.leads)
      .innerJoin(schema.companies, eq(schema.leads.companyId, schema.companies.id))
      .leftJoin(schema.user, eq(schema.leads.corretorId, schema.user.id))
      .where(and(eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt), companyScope, ...(leadScope ? [leadScope] : [])))
      .orderBy(desc(schema.leads.createdAt))
      .limit(5000),
  ]);

  const counts = countCompanyLeads(leadRows);
  const companies: CompanyRow[] = companyRows.map((company) => ({
    ...company,
    openLeads: counts.get(company.id)?.open ?? 0,
    totalLeads: counts.get(company.id)?.total ?? 0,
  }));
  const leads: CompanyLeadRow[] = leadRows.map((lead) => ({
    id: lead.id,
    companyId: lead.companyId ?? "",
    nome: lead.nome,
    status: lead.status,
    corretorName: lead.corretorName,
    createdAt: lead.createdAt ? new Date(lead.createdAt).toISOString() : null,
  }));
  const linked = leads.length;

  return (
    <>
      <DashboardHeader
        breadcrumb="CRM comercial"
        title="Empresas"
        summary={`${companies.length.toLocaleString("pt-BR")} ${companies.length === 1 ? "empresa" : "empresas"} · ${linked.toLocaleString("pt-BR")} ${linked === 1 ? "lead PJ" : "leads PJ"}`}
        rightSlot={<Link href="/leads?tipo=PJ" className={page.primaryButton}><Plus className="size-4" aria-hidden="true" />Novo lead PJ</Link>}
      />
      <main className={page.stack}>
        <CompaniesWorkspace companies={companies} leads={leads} canEdit={context.role === "director" || context.role === "manager"} />
      </main>
    </>
  );
}
