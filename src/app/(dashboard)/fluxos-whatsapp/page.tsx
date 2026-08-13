import "server-only";

import { redirect } from "next/navigation";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getWhatsappFlows } from "@/features/automations/queries";
import { WhatsappFlowsClient } from "@/features/automations/components/whatsapp-flows-client";

export const metadata = {
  title: "Fluxos de WhatsApp - CRM Âncora Corretora",
  description: "Gerenciamento de fluxos operacionais e roteamento de WhatsApp",
};

export default async function FluxosWhatsappPage() {
  const context = await getRequiredTenantContext();

  // Protect page: Director and Manager can manage flows
  if (context.role !== "director" && context.role !== "manager") {
    redirect("/access-denied");
  }

  // Fetch flows
  const flows = await getWhatsappFlows(context.tenantId);

  return <WhatsappFlowsClient initialFlows={flows} />;
}
