import "server-only";

import { redirect } from "next/navigation";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getAutomations, getAutomationLogs } from "@/features/automations/queries";
import { AutomationsClient } from "@/features/automations/components/automations-client";
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
    <main className="flex-1 space-y-6 p-4 lg:p-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Automações</h1>
        <p className="mt-1 text-sm text-muted-foreground">Desenhe regras comerciais por etapas, valide o fluxo e publique somente quando estiver pronto.</p>
      </section>
      <WorkflowAutomationStudio initialWorkflows={workflows} />
      <details className="rounded-xl border border-border bg-card">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">Automações anteriores e histórico de envios</summary>
        <AutomationsClient initialAutomations={automations} initialLogs={logs} isAdmin={true} />
      </details>
    </main>
  );
}
