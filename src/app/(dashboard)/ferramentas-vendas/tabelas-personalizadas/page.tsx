import { DashboardHeader } from "@/components/dashboard-header";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { listAvailableCatalogPlans } from "@/features/global-catalog/queries";
import { and, asc, eq } from "drizzle-orm";
import { CustomTableBuilder } from "./custom-table-builder";

export default async function CustomTablesPage() {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const [availableCatalogPlans, legacyPlans] = await Promise.all([
    listAvailableCatalogPlans(context),
    db
      .select({
        id: schema.carrierPlans.id,
        name: schema.carrierPlans.name,
        carrierId: schema.carrierPlans.carrierId,
        carrierName: schema.carriers.name,
        type: schema.carrierPlans.type,
        coverage: schema.carrierPlans.coverage,
        maxEntryAge: schema.carrierPlans.maxEntryAge,
      })
      .from(schema.carrierPlans)
      .innerJoin(schema.carriers, eq(schema.carrierPlans.carrierId, schema.carriers.id))
      .where(
        and(
          eq(schema.carrierPlans.tenantId, context.tenantId),
          eq(schema.carrierPlans.active, true),
          eq(schema.carriers.status, "active"),
        ),
      )
      .orderBy(asc(schema.carriers.name), asc(schema.carrierPlans.name)),
  ]);

  // Merge global catalog + legacy into a unified list
  const seen = new Set<string>();
  const unifiedPlans: Array<{
    id: string;
    carrierId: string;
    carrierName: string;
    name: string;
    type: string;
    coverage: string | null;
    maxEntryAge: number | null;
  }> = [];

  for (const p of availableCatalogPlans) {
    if (!seen.has(p.planId)) {
      seen.add(p.planId);
      unifiedPlans.push({
        id: p.planId,
        carrierId: p.carrierId,
        carrierName: p.carrierName,
        name: p.planName,
        type: p.planType,
        coverage: p.coverage ?? null,
        maxEntryAge: p.maxEntryAge,
      });
    }
  }
  for (const p of legacyPlans) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      unifiedPlans.push(p);
    }
  }

  // Extract unique carriers from plans
  const carriers = Array.from(
    new Map(unifiedPlans.map((p) => [p.carrierId, { id: p.carrierId, name: p.carrierName }])).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <DashboardHeader breadcrumb="Ferramentas de vendas" title="Tabelas Personalizadas" />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-medium text-primary">FERRAMENTAS DE VENDAS</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Tabelas Personalizadas</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Selecione os parâmetros e gere uma tabela de preços personalizada para imprimir, enviar ou baixar como PDF.
            </p>
          </div>
        </div>
        <CustomTableBuilder carriers={carriers} plans={unifiedPlans} />
      </main>
    </>
  );
}
