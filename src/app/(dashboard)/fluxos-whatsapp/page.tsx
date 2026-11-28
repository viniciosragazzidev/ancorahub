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
  // Resumo do topo (anatomia de página), só com o que a página já carrega.
  const activeFlows = flows.filter((flow) => flow.status === "active").length;
  const summary = `${flows.length.toLocaleString("pt-BR")} ${flows.length === 1 ? "fluxo" : "fluxos"} · ${activeFlows.toLocaleString("pt-BR")} ${activeFlows === 1 ? "ativo" : "ativos"}`;

  // Chave do visual Lite: os mesmos modelos, fluxos e ações, com o cabeçalho da moldura.
  if (await isDirectorLitePageOnServer(context, "/fluxos-whatsapp")) {
    return (
      <>
        <DashboardHeader breadcrumb="Atendimento" title="Fluxos de WhatsApp" summary={summary} />
        <main className={litePage.stack}>
          <WhatsappFlowsLite initialFlows={flows} />
        </main>
      </>
    );
  }

  return <WhatsappFlowsClient initialFlows={flows} />;
}
