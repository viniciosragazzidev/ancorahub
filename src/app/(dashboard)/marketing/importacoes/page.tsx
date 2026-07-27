import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { DashboardHeader } from "@/components/dashboard-header";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { hasCapability } from "@/shared/auth/permissions";
import { getDatabase, schema } from "@/shared/db";
import { MarketingImportClient } from "./_components/marketing-import-client";
import { getImportHistoryAction, getLastImportAction } from "@/features/marketing-import/actions";

export default async function MarketingImportacoesPage() {
  const context = await getRequiredTenantContext();
  const isCentralMarketing = context.jobTitle === "marketing" && context.branchId === null;
  if (!hasCapability(context.role, "importar_leads_meta", context.jobTitle)) {
    redirect("/access-denied");
  }

  const db = getDatabase();
  const branches = await db
    .select({ id: schema.branches.id, name: schema.branches.name })
    .from(schema.branches)
    .where(eq(schema.branches.tenantId, context.tenantId));

  const [history, lastImport] = await Promise.all([
    getImportHistoryAction(),
    getLastImportAction(),
  ]);

  return (
    <>
      <DashboardHeader breadcrumb="Marketing / Importações" title="Importar Leads Meta" />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <div>
          <p className="text-xs font-medium text-primary">MARKETING</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Importar Leads Meta</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Faça upload da planilha exportada do Meta Ads. Apenas os formatos estruturados PF e PME são aceitos.
          </p>
        </div>

        <MarketingImportClient
          branches={branches}
          history={history}
          lastImport={lastImport}
          role={context.role}
          jobTitle={context.jobTitle}
          branchId={context.branchId}
          isCentralMarketing={isCentralMarketing}
        />
      </main>
    </>
  );
}
