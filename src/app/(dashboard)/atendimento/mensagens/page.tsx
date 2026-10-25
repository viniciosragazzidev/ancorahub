import { DashboardHeader } from "@/components/dashboard-header";
import { getMessageLibrary } from "@/features/message-library/service";
import { AuthorizationError } from "@/shared/auth/errors";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { AtendimentoHeading } from "../_components/atendimento-heading";
import { MessagesWorkspace } from "./_components/messages-workspace";
import litePage from "@/components/lite/page/lite-page.module.css";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
import { AtendimentoHeadingLite } from "../_components/atendimento-heading-lite";
import { MessagesWorkspaceLite } from "./_components/messages-workspace-lite";

export const dynamic = "force-dynamic";

export const metadata = { title: "Mensagens - Atendimento" };

/**
 * Every message the system can send to customers and to the team: Meta
 * templates, free texts and the AI's answers, with where each is valid, where
 * it is used and through which channel.
 */
export default async function AtendimentoMensagensPage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") {
    throw new AuthorizationError("Apenas Diretores e Gestores podem gerenciar as mensagens do atendimento.");
  }
  const messages = await getMessageLibrary(context.tenantId);

  // Chave do visual Lite: a mesma biblioteca e as mesmas ações, com a lista Lite.
  if (await isDirectorLitePageOnServer(context, "/atendimento/mensagens")) {
    return (
      <>
        <DashboardHeader breadcrumb="Atendimento" title="Mensagens" />
        <main className={litePage.stack}>
          <AtendimentoHeadingLite active="mensagens" />
          <MessagesWorkspaceLite messages={messages} />
        </main>
      </>
    );
  }

  return (
    <>
      <DashboardHeader breadcrumb="Atendimento" title="Mensagens" />
      <main className="flex flex-1 flex-col gap-5 p-(--mobile-page-padding) sm:gap-6 lg:p-6">
        <AtendimentoHeading active="mensagens" />
        <MessagesWorkspace messages={messages} />
      </main>
    </>
  );
}
