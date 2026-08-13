import "server-only";

import { redirect } from "next/navigation";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getAutomations, getAutomationLogs } from "@/features/automations/queries";
import { AutomationsClient } from "@/features/automations/components/automations-client";
import { DashboardHeader } from "@/components/dashboard-header";
import { WorkflowAutomationStudio } from "@/features/workflow-automation/components/workflow-automation-studio";
import { getWorkflowAutomations } from "@/features/workflow-automation/queries";

export const metadata = {
  title: "Automações - CRM Âncora Corretora",
  description: "Gerenciamento de regras de automação e disparos do CRM",
};

export default async function AutomacoesPage() {
  const context = await getRequiredTenantContext();

  // Protect page: Director and Manager can access automations
  if (context.role !== "director" && context.role !== "manager") {
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
      <DashboardHeader
        breadcrumb="Automações"
        title="Estúdio de Automação & Triggers"
      />
      <main className="flex-1 space-y-6 p-4 lg:p-6">
        <WorkflowAutomationStudio initialWorkflows={workflows} />
        <AutomationsClient
          initialAutomations={automations}
          initialLogs={logs}
          isAdmin={context.role === "director" || context.role === "manager"}
        />
      </main>
    </>
  );
}
