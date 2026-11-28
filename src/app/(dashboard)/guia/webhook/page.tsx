import { DashboardHeader } from "@/components/dashboard-header";
import { ComercialPage } from "@/features/comercial-lite/comercial-kit";
import litePage from "@/components/lite/page/lite-page.module.css";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { WebhookTutorial } from "./webhook-tutorial";
import { WebhookTutorialLite } from "./webhook-tutorial-lite";

export default async function WebhookGuidePage() {
  // O contexto só decide o visual (diretor com a chave); o acesso continua o do layout do painel.
  const context = await getRequiredTenantContext();
  if (await isDirectorLitePageOnServer(context, "/guia/webhook")) {
    return (
      <ComercialPage title="Integração via webhook">
        <div className={litePage.stack} style={{ padding: 0 }}>
          <WebhookTutorialLite />
        </div>
      </ComercialPage>
    );
  }

  return (
    <>
      <DashboardHeader breadcrumb="Guia do sistema" title="Integração via Webhook" />
      <WebhookTutorial />
    </>
  );
}
