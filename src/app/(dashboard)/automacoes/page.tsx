import "server-only";

import { redirect } from "next/navigation";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getAutomations, getAutomationLogs } from "@/features/automations/queries";
import { AutomationsClient } from "@/features/automations/components/automations-client";
import { DashboardHeader } from "@/components/dashboard-header";
import { WorkflowAutomationStudio } from "@/features/workflow-automation/components/workflow-automation-studio";
import { getWorkflowAutomations } from "@/features/workflow-automation/queries";

export const metadata = {
  title: "Automacoes - CRM Âncora Corretora",
  description: "Gerenciamento de regras de automacao e disparos do CRM",
};

export default async function AutomacoesPage() {
  const context = await getRequiredTenantContext();

  // Protect page: Only director can manage automations
  if (context.role !== "director") {
    redirect("/access-denied");
  }

  // Fetch automations and logs
  const [automations, logs, workflows] = await Promise.all([
    getAutomations(context.tenantId),
    getAutomationLogs(context.tenantId),
    getWorkflowAutomations(context.tenantId),
  ]);

  return (
    <>
      <DashboardHeader breadcrumb="Automação" title="Automações" />
      <main className="h-[calc(100dvh-var(--header-height,3.5rem))] max-h-[100vh] w-full flex-1 overflow-hidden bg-background p-0">
        <div className="h-full w-full overflow-hidden bg-card flex flex-col min-h-0">
          <WorkflowAutomationStudio initialWorkflows={workflows} />
          <details className="border-t border-border bg-card shrink-0">
            <summary className="cursor-pointer px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground">
              Automações anteriores e histórico de envios
            </summary>
            <div className="max-h-60 overflow-y-auto p-4 border-t border-border/60">
              <AutomationsClient initialAutomations={automations} initialLogs={logs} isAdmin={true} />
            </div>
          </details>
        </div>
      </main>
    </>
  );
}
