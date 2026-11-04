import "server-only";

import { redirect } from "next/navigation";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getWhatsappFlows } from "@/features/automations/queries";
import { WhatsappFlowsClient } from "@/features/automations/components/whatsapp-flows-client";
import { DashboardHeader } from "@/components/dashboard-header";
import litePage from "@/components/lite/page/lite-page.module.css";
import { WhatsappFlowsLite } from "@/features/automations/components/whatsapp-flows-lite";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";

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

  // Chave do visual Lite: os mesmos modelos, fluxos e ações, com o cabeçalho da moldura.
  if (await isDirectorLitePageOnServer(context, "/fluxos-whatsapp")) {
    return (
      <>
        <DashboardHeader breadcrumb="Atendimento" title="Fluxos de WhatsApp" />
        <main className={litePage.stack}>
          <p className={litePage.cardDescription}>Recepção, qualificação e roteamento de contatos do WhatsApp usando a frota ativa do WAHA.</p>
          <WhatsappFlowsLite initialFlows={flows} />
        </main>
      </>
    );
  }

  return <WhatsappFlowsClient initialFlows={flows} />;
}
