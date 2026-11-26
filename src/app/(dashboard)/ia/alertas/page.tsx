import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import page from "@/components/lite/page/lite-page.module.css";
import { getQualificationAlerts } from "@/features/ai-qualification/alerts-service";
import { isOpenAlert, toAlertRow } from "@/features/ai-qualification/alerts-view";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import { AlertsWorkspace } from "./_components/alerts-workspace";

export const dynamic = "force-dynamic";

/** Alertas da IA (25/11/2026): os calculados agora a partir dos fatos e os gravados, só da empresa do usuário. */
export default async function AiAlertsPage() {
  const context = await getRequiredTenantContext();
  // Gestor (papel manager) só abre /ia/perguntas na área da IA (26/11); o layout não roda de novo entre abas.
  if (context.role === "manager") redirect("/access-denied");
  const rows = (await getQualificationAlerts(context.tenantId)).map(toAlertRow);
  const open = rows.filter(isOpenAlert).length;
  return (
    <>
      <DashboardHeader
        breadcrumb="Atendimento IA"
        title="Alertas"
        summary={open ? `${open.toLocaleString("pt-BR")} ${open === 1 ? "alerta aberto" : "alertas abertos"}` : "Nenhum alerta aberto"}
      />
      <main className={page.stack}>
        <AlertsWorkspace initialRows={rows} />
      </main>
    </>
  );
}
