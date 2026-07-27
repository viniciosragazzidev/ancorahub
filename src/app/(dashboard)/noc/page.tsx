import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import { NextUrgentLeadButton } from "@/components/next-urgent-lead-button";
import { getNocData } from "@/features/noc/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { NocClient } from "./noc-client";
import { NocHeaderSlot } from "./noc-client";

export default async function NocPage() {
  const context = await getRequiredTenantContext();

  if (context.role === "broker") {
    redirect("/access-denied");
  }

  const data = await getNocData(context);

  return (
    <>
      <DashboardHeader
        breadcrumb="Operações"
        title="NOC — Centro de Operações"
        rightSlot={
          <div className="flex items-center gap-2">
            <NextUrgentLeadButton />
            <NocHeaderSlot />
          </div>
        }
      />

      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <NocClient data={data} />
      </main>
    </>
  );
}
