import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import { NextUrgentLeadButton } from "@/components/next-urgent-lead-button";
import { PeriodSelect } from "@/components/period-select";
import { getNocData } from "@/features/noc/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { parsePeriod } from "@/shared/period";
import { NocClient } from "./noc-client";
import { NocHeaderSlot } from "./noc-client";
import { NocLite } from "./_components/noc-lite";
import litePage from "@/components/lite/page/lite-page.module.css";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
import { getUrgentLeadForUser } from "@/features/leads/queries";

export default async function NocPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const context = await getRequiredTenantContext();
  const period = parsePeriod((await searchParams).period);

  if (context.role === "broker") {
    redirect("/access-denied");
  }

  const data = await getNocData(context, period);

  if (await isDirectorLitePageOnServer(context.role, context.tenantId, "/noc")) {
    const urgentLead = await getUrgentLeadForUser().catch(() => null);
    return (
      <>
        <DashboardHeader breadcrumb="Operações" title="Centro de operações" />
        <main className={litePage.stack}>
          <NocLite data={data} period={period} now={new Date().toISOString()} urgentLead={urgentLead ? { id: urgentLead.id, nome: urgentLead.nome, reason: urgentLead.urgentReason } : null} />
        </main>
      </>
    );
  }

  return (
    <>
      <DashboardHeader
        breadcrumb="Operações"
        title="NOC — Centro de Operações"
        rightSlot={
          <div className="flex items-center gap-2">
            <NextUrgentLeadButton />
            <PeriodSelect value={period} />
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
