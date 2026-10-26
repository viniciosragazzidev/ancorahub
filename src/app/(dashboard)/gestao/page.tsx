import { notFound, redirect } from "next/navigation";

import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { getManagerUnitIdentity } from "@/features/manager-workspace/gestao-overview-queries";
import { getTeamMetrics } from "@/features/team-management/metrics";
import { getWeeklyTeamSummary } from "@/features/team-management/weekly-highlights-data";
import { resolveGestaoAccess } from "@/features/team-management-ui/access";
import { buildUnitOverview } from "@/features/team-management-ui/build-overview";
import { isTeamManagementEnabled } from "@/features/team-management-ui/flag";
import { loadTeamPage } from "@/features/team-management-ui/team-page-loader";
import { TeamPageViewComponent } from "@/features/team-management-ui/team-page-view";
import { TeamExtrasSection } from "@/features/team-management-extras/team-extras-section";
import { UnitOverviewView } from "@/features/team-management-ui/unit-overview";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { DashboardHeader } from "@/components/dashboard-header";
import { LiteUrlSelect } from "@/components/lite/controls";
import litePage from "@/components/lite/page/lite-page.module.css";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
import { resolveDirectorUnit } from "@/features/team-management-ui/director-unit-context";

export const dynamic = "force-dynamic";

export default async function GestaoPage({ searchParams }: { searchParams: Promise<{ unidade?: string }> }) {
  const context = await getRequiredTenantContext();
  const audience = await getLiteAudience(context);
  const directorLite = context.role === "director" && await isDirectorLitePageOnServer(context, "/gestao");
  const decision = resolveGestaoAccess({ flagOn: await isTeamManagementEnabled(), role: context.role, audience, directorLite });
  if (decision === "off") notFound();
  if (decision === "supervisor") {
    // Supervisor Lite: a própria equipe, a mesma tela do perfil da equipe (G2).
    const page = await loadTeamPage({ context, audience, flagOn: true, requestedSupervisorId: context.userId });
    if (page.access !== "render") redirect("/equipe/minha");
    return (
      <>
        <TeamPageViewComponent view={page.view} />
        <TeamExtrasSection context={context} supervisorId={context.userId} canEditBrokers />
      </>
    );
  }
  if (decision === "denied") redirect("/access-denied");

  // Diretor: escolhe a unidade (?unidade=, validada contra a empresa) e vê a mesma gestão do gestor dela.
  const directorUnit = decision === "director" ? await resolveDirectorUnit(context, (await searchParams).unidade) : null;
  if (decision === "director" && !directorUnit) redirect("/equipe");
  if (directorUnit) {
    // Diretor: a carga da unidade é a mesma do gestor; se falhar, a tela mostra o motivo no lugar do erro genérico
    // (o diretor é dono da empresa) e o log do servidor guarda o erro completo.
    try {
      return await renderDirectorUnit(directorUnit);
    } catch (error) {
      if (isNextControlFlow(error)) throw error;
      console.error("[gestao:diretor] falha ao carregar a unidade", { branchId: directorUnit.branchId, error });
      return (
        <>
          <DashboardHeader breadcrumb="Gestão de equipe" title="Gestão da unidade" />
          <main className={litePage.stack}>
            <section className={litePage.empty} role="alert">
              <h2 className={litePage.emptyTitle}>Não foi possível carregar a gestão desta unidade</h2>
              <p className={litePage.emptyText}>{error instanceof Error ? error.message : String(error)}</p>
            </section>
          </main>
        </>
      );
    }
  }

  const now = new Date();
  const [identity, teamMetrics] = await Promise.all([
    getManagerUnitIdentity(context),
    getTeamMetrics(context, { window: 7, now }),
  ]);
  const overview = buildUnitOverview({
    ...identity,
    now,
    weeklySummary: teamMetrics.unit
      ? (await getWeeklyTeamSummary({ context, window: teamMetrics.unit.current, brokers: teamMetrics.brokers, now })).summary
      : null,
    metrics: {
      unit: teamMetrics.unit,
      unitConversionRate: teamMetrics.unitConversionRate,
      teamsBySupervisorId: new Map(teamMetrics.teams
        .filter((team) => team.supervisorId !== null)
        .map((team) => [team.supervisorId!, team])),
      unassignedTeam: teamMetrics.teams.find((team) => team.supervisorId === null) ?? null,
    },
  });

  return <UnitOverviewView overview={overview} />;
}

function isNextControlFlow(error: unknown) {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND") || digest === "DYNAMIC_SERVER_USAGE" || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"));
}

async function renderDirectorUnit(directorUnit: NonNullable<Awaited<ReturnType<typeof resolveDirectorUnit>>>) {
  const scopeContext = directorUnit.unitContext;
  const now = new Date();
  const [identity, teamMetrics] = await Promise.all([
    getManagerUnitIdentity(scopeContext),
    getTeamMetrics(scopeContext, { window: 7, now }),
  ]);
  const overview = buildUnitOverview({
    ...identity,
    now,
    weeklySummary: teamMetrics.unit
      ? (await getWeeklyTeamSummary({ context: scopeContext, window: teamMetrics.unit.current, brokers: teamMetrics.brokers, now })).summary
      : null,
    metrics: {
      unit: teamMetrics.unit,
      unitConversionRate: teamMetrics.unitConversionRate,
      teamsBySupervisorId: new Map(teamMetrics.teams
        .filter((team) => team.supervisorId !== null)
        .map((team) => [team.supervisorId!, team])),
      unassignedTeam: teamMetrics.teams.find((team) => team.supervisorId === null) ?? null,
    },
  });
  return (
      <>
        <DashboardHeader breadcrumb="Gestão de equipe" title="Gestão da unidade" />
        <main className={litePage.stack}>
          {directorUnit.branches.length > 1 ? (
            <div className={litePage.toolbar}>
              <LiteUrlSelect className={litePage.select} label="Unidade" param="unidade" value={directorUnit.branchId} defaultValue={directorUnit.branches[0]!.id} options={directorUnit.branches.map((branch) => ({ value: branch.id, label: branch.name }))} />
            </div>
          ) : null}
          <UnitOverviewView overview={overview} embedded />
        </main>
      </>
  );
}
