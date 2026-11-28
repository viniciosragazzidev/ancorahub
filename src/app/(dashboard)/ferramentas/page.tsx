import { DashboardHeader } from "@/components/dashboard-header";
import { ToolsCatalog } from "@/features/tools/components/tools-catalog";
import { ToolsLite } from "@/features/tools/components/tools-lite";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
import { requireCapability } from "@/shared/auth/authorization";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

export default async function FerramentasPage() {
  const context = await getRequiredTenantContext();
  await requireCapability(context, "acessar_ferramentas");

  // Lite (28/11/2026, artifact "Comercial"): as ferramentas em linhas, sem a faixa de topo.
  if (await isDirectorLitePageOnServer(context, "/ferramentas")) return <ToolsLite isDirector={context.role === "director"} />;

  return (
    <>
      <DashboardHeader breadcrumb="Ferramentas" title="Ferramentas" />
      <main className="flex flex-1 flex-col p-(--mobile-page-padding) lg:p-6">
        <ToolsCatalog isDirector={context.role === "director"} />
      </main>
    </>
  );
}
