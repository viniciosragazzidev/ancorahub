import { connection } from "next/server";
import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import litePage from "@/components/lite/page/lite-page.module.css";
import { getMyCalls } from "@/features/call-ancora/my-calls";
import { canSeeTeamCalls, formatTalkTotal, normalizeMyCallsFilters } from "@/features/call-ancora/my-calls-rules";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
import { hasPermission } from "@/shared/auth/permissions";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import { TasksSectionNav } from "../tasks-section-nav";
import { CallsLite } from "./calls-lite";

export const dynamic = "force-dynamic";

/**
 * /tarefas/ligacoes (26/11/2026, "Minhas ligações" do DeskComm): as ligações feitas pelo Call Âncora no celular, com
 * resultado e duração. Corretor vê as suas; supervisor, gestor e diretor veem as da equipe, unidade ou empresa, com
 * filtro por corretor. Somente leitura: a ligação entra pelo app, não por aqui.
 */
export default async function CallsPage({ searchParams }: { searchParams: Promise<{ periodo?: string; corretor?: string }> }) {
  await connection();
  const context = await getRequiredTenantContext();
  if (!hasPermission(context.role, "acessar_tarefas")) redirect("/access-denied");

  const filters = normalizeMyCallsFilters(context.role, await searchParams);
  const data = await getMyCalls(context, filters);
  const team = canSeeTeamCalls(context.role);
  const summary = `${data.summary.calls.toLocaleString("pt-BR")} ${data.summary.calls === 1 ? "ligação" : "ligações"} · ${formatTalkTotal(data.summary.talkSeconds)} em ligação`;

  const props = {
    rows: data.rows,
    summary: data.summary,
    period: filters.period,
    brokerId: filters.brokerId,
    brokers: data.brokers,
    canSeeTeam: team,
    truncated: data.truncated,
  };

  if (await isDirectorLitePageOnServer(context, "/tarefas/ligacoes")) {
    return (
      <>
        <DashboardHeader breadcrumb="Leads" title="Ligações" summary={summary} />
        <main className={litePage.stack}><CallsLite {...props} /></main>
      </>
    );
  }

  return (
    <main className="arc-venancor lite-page flex min-h-full flex-col gap-5 bg-(--surface) text-(--foreground)">
      <header>
        <h1 className="lite-page-title">{team ? "Ligações" : "Minhas ligações"}</h1>
        <p className="lite-page-subtitle">
          {team ? "Ligações feitas pelo Call Âncora, com resultado e duração." : "Suas ligações pelo Call Âncora, com resultado e duração."}
        </p>
      </header>
      <TasksSectionNav current="ligacoes" />
      <CallsLite {...props} />
    </main>
  );
}
