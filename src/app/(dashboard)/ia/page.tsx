import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import page from "@/components/lite/page/lite-page.module.css";
import { buildAiHubSections, buildAiHubSummary } from "@/features/ai-qualification/ai-area-hub";
import { countActiveQualifications, getAiRunsSummary } from "@/features/ai-qualification/ai-runs-service";
import { getQualificationAlerts } from "@/features/ai-qualification/alerts-service";
import { getQualificationTenantSettings } from "@/features/ai-qualification/tenant-settings-service";
import { getUserDisplayInfo } from "@/shared/auth/actions";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import { AiHubView } from "./_components/ai-hub-view";
import { LiveRefresh } from "./_components/live-refresh";

export const dynamic = "force-dynamic";

/** Uma leitura que falha não derruba o hub: o número mostra "Indisponível" e o resto segue. */
async function safely<T>(section: string, loader: () => Promise<T>): Promise<T | null> {
  try {
    return await loader();
  } catch (error) {
    console.error("[ia-hub] section_unavailable", { section, errorType: error instanceof Error ? error.name : "unknown" });
    return null;
  }
}

/**
 * Entrada da área Atendimento IA (25/11/2026): o que a IA está fazendo agora e o caminho para montar, ensinar e
 * acompanhar a IA de qualificação. Permissão: a do layout (acessar_qualificacao_ia), como as telas atuais.
 */
export default async function AiAreaPage() {
  const context = await getRequiredTenantContext();
  // Gestor (papel manager) só abre /ia/perguntas na área da IA (26/11); o layout não roda de novo entre abas.
  if (context.role === "manager") redirect("/access-denied");
  const now = new Date();
  const [settings, alerts, activeQualifications, runs, user] = await Promise.all([
    safely("settings", () => getQualificationTenantSettings(context.tenantId)),
    safely("alerts", () => getQualificationAlerts(context.tenantId, now)),
    safely("active_qualifications", () => countActiveQualifications(context.tenantId)),
    safely("runs", () => getAiRunsSummary(context.tenantId, now)),
    safely("user", () => getUserDisplayInfo()),
  ]);
  const activeAlerts = alerts ? alerts.filter((alert) => alert.status === "active").length : null;
  const failures24h = runs ? runs.failed : null;
  const summary = buildAiHubSummary({ enabled: settings ? Boolean(settings.enabled) : null, activeQualifications, activeAlerts, failures24h });
  const hubSections = buildAiHubSections(user, { activeAlerts, activeQualifications, failures24h });

  return (
    <>
      <DashboardHeader
        breadcrumb="Atendimento IA"
        title="Atendimento IA"
        summary="A IA conversa com cada lead novo, faz as perguntas do plano e entrega o lead pronto ao corretor."
      />
      <main className={page.stack}>
        <AiHubView summary={summary} sections={hubSections} />
      </main>
      <LiveRefresh />
    </>
  );
}
