import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { getDutyRosterSnapshot } from "@/features/lead-distribution/roster-queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { DutyOperationsWorkspace } from "./_components/duty-operations-workspace";

export default async function DutySchedulePage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") redirect("/access-denied");

  const roster = await getDutyRosterSnapshot(context);

  return (
    <>
      <DashboardHeader breadcrumb="Operação comercial" title="Plantões de distribuição" />
      <main className="min-h-full bg-background p-4 lg:p-6">
        <DutyOperationsWorkspace snapshot={roster} />
      </main>
    </>
  );
}
