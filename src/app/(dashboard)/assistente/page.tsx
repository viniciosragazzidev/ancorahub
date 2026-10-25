import { redirect } from "next/navigation";
import { AuthenticationError, AuthorizationError } from "@/shared/auth/errors";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { AssistenteChatClient } from "./_components/assistente-chat-client";
import { AssistenteLite } from "./_components/assistente-lite";
import { DashboardHeader } from "@/components/dashboard-header";
import litePage from "@/components/lite/page/lite-page.module.css";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";

export const metadata = {
  title: "Assistente IA — Âncora CRM",
  description: "Copiloto inteligente com integração MCP para automação e consulta da operação comercial da Âncora Saúde.",
};

export default async function AssistentePage() {
  let context;
  try {
    context = await getRequiredTenantContext();
  } catch (error) {
    if (error instanceof AuthenticationError) redirect("/login");
    if (error instanceof AuthorizationError) redirect("/access-denied");
    throw error;
  }

  if (await isDirectorLitePageOnServer(context, "/assistente")) {
    return (
      <>
        <DashboardHeader breadcrumb="Inteligência" title="Assistente IA" />
        <main className={litePage.stack}>
          <AssistenteLite />
        </main>
      </>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden bg-background">
      <AssistenteChatClient
        tenantId={context.tenantId}
        userId={context.userId}
        userRole={context.role}
      />
    </div>
  );
}
