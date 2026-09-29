import Link from "next/link";
import { notFound } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { parsePeriod } from "@/shared/period";
import { isDrilldownId, getDrilldown } from "@/features/reports/metrics/metrics-service";
import { ArrowLeft } from "@/components/huge-icons";
import { DataTableFrame } from "@/components/ui/data-table/data-table-frame";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
            <DataTableFrame>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Corretor</TableHead>
                    <TableHead className="text-right">Leads ativos</TableHead>
                    <TableHead className="text-right">Capacidade</TableHead>
                    <TableHead className="text-right">Excedente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drilldown.brokers.map((broker) => (
                    <TableRow key={broker.brokerId}>
                      <TableCell className="font-medium">{broker.brokerName}</TableCell>
                      <TableCell className="text-right tabular-nums">{broker.activeLeads}</TableCell>
                      <TableCell className="text-right tabular-nums">{broker.capacity}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-destructive">
                        {broker.activeLeads - broker.capacity}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataTableFrame>
          </section>
        )}

        {drilldown.rows.length > 0 && (
          <section aria-labelledby="drill-leads-title">
            <h2 id="drill-leads-title" className="mb-3 text-sm font-medium text-foreground">Leads</h2>
            <DataTableFrame>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Corretor</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead className="text-right">Criado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drilldown.rows.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">
                        <Link href={`/leads/${lead.id}`} className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
                          {lead.nome}
                        </Link>
                      </TableCell>
                      <TableCell>{lead.status}</TableCell>
                      <TableCell>{lead.brokerName ?? "—"}</TableCell>
                      <TableCell>{lead.branchName ?? "—"}</TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {new Date(lead.createdAt).toLocaleDateString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataTableFrame>
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
