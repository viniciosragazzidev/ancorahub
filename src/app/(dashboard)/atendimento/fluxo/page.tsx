import { DashboardHeader } from "@/components/dashboard-header";
import { getQualificationFlow } from "@/features/qualification-flow/queries";
import { AuthorizationError } from "@/shared/auth/errors";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { AtendimentoHeading } from "../_components/atendimento-heading";
import { FlowEditor } from "./_components/flow-editor";

export const dynamic = "force-dynamic";

export const metadata = { title: "Fluxo - Atendimento" };

/** The order and the words of the AI's qualification questions. The director edits; the manager reads. */
export default async function AtendimentoFluxoPage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") {
    throw new AuthorizationError("Apenas Diretores e Gestores podem ver o fluxo de atendimento.");
  }
  const flow = await getQualificationFlow(context.tenantId);

  return (
    <>
      <DashboardHeader breadcrumb="Atendimento" title="Fluxo de atendimento" />
      <main className="flex flex-1 flex-col gap-5 p-(--mobile-page-padding) sm:gap-6 lg:p-6">
        <AtendimentoHeading active="fluxo" />
        <FlowEditor enabledOrder={flow.enabledOrder} texts={flow.texts} canEdit={context.role === "director"} />
      </main>
    </>
  );
}
