import "server-only";

import { redirect } from "next/navigation";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getAutomations, getAutomationLogs } from "@/features/automations/queries";
import { AutomationsClient } from "@/features/automations/components/automations-client";

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
  const automations = await getAutomations(context.tenantId);
  const logs = await getAutomationLogs(context.tenantId);

  return (
    <AutomationsClient
      initialAutomations={automations}
      initialLogs={logs}
      isAdmin={true}
    />
  );
}
