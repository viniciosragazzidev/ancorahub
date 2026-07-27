import { DashboardHeader } from "@/components/dashboard-header";
import { WebhookTutorial } from "./webhook-tutorial";

export default function WebhookGuidePage() {
  return (
    <>
      <DashboardHeader breadcrumb="Guia do sistema" title="Integração via Webhook" />
      <WebhookTutorial />
    </>
  );
}
