import { redirect } from "next/navigation";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

/** URL legado preservado para favoritos e links externos. */
export default async function BranchesPage() {
  const context = await getRequiredTenantContext();
  if (context.role === "director" || (context.role === "manager" && context.branchId)) {
    redirect("/equipe?visao=unidades");
  }
  redirect("/access-denied");
}
