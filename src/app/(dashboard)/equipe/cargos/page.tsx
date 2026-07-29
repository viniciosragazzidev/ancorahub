import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getCustomRolesWorkspace } from "@/features/custom-roles/service";
import { CustomRolesWorkspace } from "./workspace";

export default async function CustomRolesPage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") redirect("/access-denied");
  const workspace = await getCustomRolesWorkspace();
  return <>
    <DashboardHeader breadcrumb="Equipe / Cargos e permissões" title="Cargos e permissões" />
    <CustomRolesWorkspace {...workspace} />
  </>;
}
