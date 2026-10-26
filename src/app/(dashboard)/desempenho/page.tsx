import Link from "next/link";
import { redirect } from "next/navigation";

import { isLightRouteAllowed } from "@/components/light/light-routes";
import { BrokerPerformanceLite } from "@/features/broker-performance/components/broker-performance-lite";
import { buildBrokerPerformanceView, parseBrokerPerformancePeriod } from "@/features/broker-performance/domain";
import { getBrokerPerformance, isBrokerPerformanceLiteEnabled } from "@/features/broker-performance/queries";
import { getBrokerWorkspaceData } from "@/features/broker-workspace/queries";
import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

export default async function BrokerPerformancePage({ searchParams }: { searchParams: Promise<{ periodo?: string | string[] }> }) {
  const context = await getRequiredTenantContext();
  if (context.role !== "broker" || (await getLiteAudience(context)) !== "broker" || !isLightRouteAllowed("/desempenho", "broker")) redirect("/dashboard");

  // Flag do Super-admin: desligada, o corretor continua com o resumo do dia abaixo.
  if (await isBrokerPerformanceLiteEnabled()) {
    const period = parseBrokerPerformancePeriod((await searchParams).periodo);
    const data = await getBrokerPerformance(context, { period, now: new Date() });
    return (
      <main className="arc-venancor lite-page flex min-h-full flex-col bg-(--surface) text-(--foreground)">
        <BrokerPerformanceLite view={buildBrokerPerformanceView(data)} />
      </main>
    );
  }

  const data = await getBrokerWorkspaceData();
  const { receivedToday, acceptedToday, inServiceNow, slaAtRiskNow } = data.today;
  const summary = slaAtRiskNow > 0
    ? `${slaAtRiskNow} ${slaAtRiskNow === 1 ? "lead está" : "leads estão"} com o primeiro contato atrasando.`
    : receivedToday === 0
      ? "Nenhum lead chegou hoje ainda. Os próximos aparecem aqui assim que forem distribuídos."
      : acceptedToday >= receivedToday
        ? "Você aceitou tudo o que chegou hoje. Bom ritmo."
        : `Hoje chegaram ${receivedToday} e você aceitou ${acceptedToday}.`;
  const stats = [
    { label: "Recebidos hoje", value: receivedToday },
    { label: "Aceitos hoje", value: acceptedToday },
    { label: "Em atendimento", value: inServiceNow },
    { label: "SLA em risco", value: slaAtRiskNow },
  ];

  return (
    <main className="arc-venancor lite-page flex min-h-full flex-col gap-6 bg-(--surface) text-(--foreground)">
      <header>
        <h1 className="lite-page-title">Desempenho</h1>
        <p className="lite-page-subtitle">{summary}</p>
      </header>

      <section aria-labelledby="performance-today-title" className="grid gap-3">
        <h2 id="performance-today-title" className="text-base font-semibold">Seu dia</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="grid min-h-28 content-between gap-3 rounded-3xl bg-(--surface-muted) p-4 shadow-(--shadow-resting)">
              <dt className="text-sm text-(--text-secondary)">{stat.label}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {data.goal ? (
        <section aria-labelledby="performance-goal-title" className="grid gap-3">
          <h2 id="performance-goal-title" className="text-base font-semibold">{data.goal.name}</h2>
          <div className="grid gap-4 rounded-3xl bg-(--surface-muted) p-5 shadow-(--shadow-resting) sm:grid-cols-3">
            <div><p className="text-sm text-(--text-secondary)">Progresso</p><p className="mt-1 text-xl font-semibold tabular-nums">{data.goal.percentage}%</p></div>
            <div><p className="text-sm text-(--text-secondary)">Atual</p><p className="mt-1 text-xl font-semibold tabular-nums">{data.goal.currentValue}</p></div>
            <div><p className="text-sm text-(--text-secondary)">Meta</p><p className="mt-1 text-xl font-semibold tabular-nums">{data.goal.targetValue}</p></div>
          </div>
        </section>
      ) : null}

      <nav aria-label="Atalhos do desempenho" className="flex flex-wrap gap-3">
        <Link href="/minha-fila" className="inline-flex min-h-11 items-center text-sm font-medium text-(--accent-strong)">Ver meus leads</Link>
        <Link href="/plantoes" className="inline-flex min-h-11 items-center text-sm font-medium text-(--accent-strong)">Ver plantões</Link>
      </nav>
    </main>
  );
}
