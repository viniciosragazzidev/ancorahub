import Link from "next/link";
import { and, count, desc, eq } from "drizzle-orm";
import { Buildings, Plus, Users } from "@/components/huge-icons";
import { DashboardHeader } from "@/components/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hasEffectiveCapability } from "@/features/custom-roles/service";
import { getSystemSetting } from "@/features/system-settings/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

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
  const branchScope = context.role === "manager"
    ? eq(schema.companies.branchId, context.branchId ?? "")
    : undefined;
  const leadScope = context.role === "broker" ? eq(schema.leads.corretorId, context.userId) : undefined;
  const companies = await db
    .select({
      id: schema.companies.id,
      name: schema.companies.name,
      cnpj: schema.companies.cnpj,
      employeeCount: schema.companies.employeeCount,
      branchName: schema.branches.name,
      leadCount: count(schema.leads.id),
    })
    .from(schema.companies)
    .leftJoin(schema.branches, eq(schema.companies.branchId, schema.branches.id))
    .leftJoin(schema.leads, and(eq(schema.leads.companyId, schema.companies.id), eq(schema.leads.tenantId, context.tenantId), ...(leadScope ? [leadScope] : [])))
    .where(and(eq(schema.companies.tenantId, context.tenantId), ...(branchScope ? [branchScope] : [])))
    .groupBy(schema.companies.id, schema.branches.name)
    .orderBy(desc(schema.companies.createdAt));
  const visibleCompanies = context.role === "broker" ? companies.filter((company) => company.leadCount > 0) : companies;

  return (
    <>
      <DashboardHeader
        breadcrumb="CRM comercial"
        title="Empresas"
        rightSlot={<Button render={<Link href="/leads?tipo=PJ" />} size="sm"><Plus /> Novo lead PJ</Button>}
      />
      <main className="flex min-w-0 flex-1 flex-col gap-6 p-4 lg:p-6">
        <Card className="border-primary/15 bg-primary/[0.025] shadow-sm">
          <CardContent className="flex items-start gap-3 p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Buildings className="size-5" /></span>
            <div><p className="font-semibold">Carteira de empresas</p><p className="mt-1 text-sm text-muted-foreground">Empresas são criadas ao cadastrar um lead PJ. Cada registro permanece isolado na sua empresa e unidade.</p></div>
          </CardContent>
        </Card>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Empresas cadastradas">
          {visibleCompanies.map((company) => (
            <Card key={company.id} className="border-border/70 bg-card shadow-sm transition-[border-color,box-shadow] hover:border-primary/30 hover:shadow-md">
              <CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><CardTitle className="truncate text-base">{company.name}</CardTitle><CardDescription className="mt-1">{company.branchName ?? "Sem unidade"}</CardDescription></div><Badge variant="secondary" className="shrink-0">PJ</Badge></div></CardHeader>
              <CardContent className="space-y-3 text-sm"><div className="flex items-center justify-between gap-3 text-muted-foreground"><span>CNPJ</span><span className="font-medium text-foreground">{company.cnpj ?? "Não informado"}</span></div><div className="flex items-center justify-between gap-3 text-muted-foreground"><span className="flex items-center gap-1.5"><Users className="size-3.5" /> Pessoas</span><span className="font-medium text-foreground tabular-nums">{company.employeeCount ?? "—"}</span></div><div className="border-t border-border/60 pt-3 text-xs text-muted-foreground"><span className="font-semibold tabular-nums text-foreground">{company.leadCount}</span> oportunidade{company.leadCount === 1 ? "" : "s"} vinculada{company.leadCount === 1 ? "" : "s"}</div></CardContent>
            </Card>
          ))}
          {!visibleCompanies.length && <Card className="col-span-full border-dashed bg-muted/20"><CardContent className="flex flex-col items-center gap-3 px-6 py-14 text-center"><Buildings className="size-8 text-muted-foreground" /><div><p className="font-semibold">Nenhuma empresa cadastrada</p><p className="mt-1 text-sm text-muted-foreground">Cadastre um lead PJ para iniciar a carteira comercial.</p></div><Button render={<Link href="/leads?tipo=PJ" />} variant="outline">Cadastrar lead PJ</Button></CardContent></Card>}
        </section>
      </main>
    </>
  );
}
