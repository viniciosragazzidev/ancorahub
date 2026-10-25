import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getCustomRolesWorkspace } from "@/features/custom-roles/service";
import { CustomRolesWorkspace } from "./workspace";
import litePage from "@/components/lite/page/lite-page.module.css";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
import { CargosLite } from "./_components/cargos-lite";

export default async function CustomRolesPage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") redirect("/access-denied");
  const workspace = await getCustomRolesWorkspace();
  if (await isDirectorLitePageOnServer(context.role, context.tenantId, "/equipe/cargos")) {
    return <>
      <DashboardHeader breadcrumb="Equipe / Cargos e permissões" title="Cargos e permissões" />
      <main className={litePage.stack}>
        <CargosLite {...workspace} />
      </main>
    </>;
  }
  return <>
    <DashboardHeader breadcrumb="Equipe / Cargos e permissões" title="Cargos e permissões" />
    <CustomRolesWorkspace {...workspace} />
  </>;
}
