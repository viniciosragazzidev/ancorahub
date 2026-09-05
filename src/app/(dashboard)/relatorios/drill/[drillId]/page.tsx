import Link from "next/link";
import { notFound } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { parsePeriod } from "@/shared/period";
import { isDrilldownId, getDrilldown } from "@/features/reports/metrics/metrics-service";
import { ArrowLeft } from "@/components/huge-icons";

export const dynamic = "force-dynamic";

export default async function DrilldownPage({
  params,
  searchParams,
}: {
  params: Promise<{ drillId: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { drillId } = await params;
  if (!isDrilldownId(drillId)) notFound();

  const context = await getRequiredTenantContext();
  const period = parsePeriod((await searchParams).period);
  const drilldown = await getDrilldown(context, drillId, period);

  return (
    <>
      <DashboardHeader
        breadcrumb={`Relatórios / ${drilldown.title}`}
        title={drilldown.title}
        rightSlot={
          <Link
            href={`/dashboard?period=${period}&tab=overview`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Voltar
          </Link>
        }
      />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <p className="text-sm text-muted-foreground max-w-2xl">{drilldown.explanation}</p>

        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">
            Total: <span className="font-medium text-foreground tabular-nums">{drilldown.total}</span> registros
          </p>
        </div>

        {drilldown.brokers.length > 0 && (
          <section aria-labelledby="drill-brokers-title">
            <h2 id="drill-brokers-title" className="mb-3 text-sm font-medium text-foreground">Corretores</h2>
            <div className="rounded-lg border border-border bg-card shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-3">Corretor</th>
                    <th className="px-4 py-3 text-right">Leads ativos</th>
                    <th className="px-4 py-3 text-right">Capacidade</th>
                    <th className="px-4 py-3 text-right">Excedente</th>
                  </tr>
                </thead>
                <tbody>
                  {drilldown.brokers.map((broker) => (
                    <tr key={broker.brokerId} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 font-medium">{broker.brokerName}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{broker.activeLeads}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{broker.capacity}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-red-600 font-medium">
                        {broker.activeLeads - broker.capacity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {drilldown.rows.length > 0 && (
          <section aria-labelledby="drill-leads-title">
            <h2 id="drill-leads-title" className="mb-3 text-sm font-medium text-foreground">Leads</h2>
            <div className="rounded-lg border border-border bg-card shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Corretor</th>
                    <th className="px-4 py-3">Unidade</th>
                    <th className="px-4 py-3 text-right">Criado em</th>
                  </tr>
                </thead>
                <tbody>
                  {drilldown.rows.map((lead) => (
                    <tr key={lead.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 font-medium">
                        <Link href={`/leads/${lead.id}`} className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
                          {lead.nome}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">{lead.status}</td>
                      <td className="px-4 py-2.5">{lead.brokerName ?? "—"}</td>
                      <td className="px-4 py-2.5">{lead.branchName ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                        {new Date(lead.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {drilldown.total > drilldown.rows.length && (
              <p className="mt-2 text-xs text-muted-foreground">
                Exibindo {drilldown.rows.length} de {drilldown.total} registros.
              </p>
            )}
          </section>
        )}
      </main>
    </>
  );
}
