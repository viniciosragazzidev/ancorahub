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
      <main className="flex-1 space-y-4 p-4 lg:p-6">
      <section className="flex flex-col gap-1 border-b border-border/70 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-sm text-muted-foreground">Desenhe regras comerciais por etapas, valide o fluxo e publique somente quando estiver pronto.</p>
        <p className="text-xs text-muted-foreground">O rascunho permanece local enquanto você edita.</p>
      </section>
      <WorkflowAutomationStudio initialWorkflows={workflows} />
      <details className="rounded-xl border border-border bg-card">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">Automações anteriores e histórico de envios</summary>
        <AutomationsClient initialAutomations={automations} initialLogs={logs} isAdmin={true} />
      </details>
      </main>
    </>
  );
}
