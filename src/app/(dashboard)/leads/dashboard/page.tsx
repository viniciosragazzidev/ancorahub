import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ChartBar, Warning } from "@/components/huge-icons";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getAttentionSnapshot, getCommercialOverview, getFunnelSnapshot } from "@/features/reports/metrics/metrics-service";

export const dynamic = "force-dynamic";

export default async function LeadsDashboardPage() {
  const context = await getRequiredTenantContext();
  const period = 7 as const;
  const [commercial, funnel, attention] = await Promise.all([
    getCommercialOverview(context, period, { includeFinancial: false }),
    getFunnelSnapshot(context, period),
    getAttentionSnapshot(context, period),
  ]);
  const attentionCount = attention.items.reduce((total, item) => total + item.count, 0);
  return <>
    <DashboardHeader breadcrumb="Leads" title="Visão geral de leads" rightSlot={<Link href="/leads" className="text-sm font-medium text-primary hover:underline">Abrir lista <ArrowUpRight className="ml-1 inline size-3.5" /></Link>} />
    <main className="flex flex-1 flex-col gap-5 p-(--mobile-page-padding) lg:p-6">
      <p className="text-sm text-muted-foreground">Saúde da carteira nos últimos {period} dias, dentro do seu escopo.</p>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Indicadores de leads">
        {[
          ["Novos hoje", funnel.received],
          ["Conversão", `${commercial.conversion.rate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`],
          ["Sem responsável", attention.items.find((item) => item.id === "high-intent-unassigned")?.count ?? 0],
          ["Em risco", attentionCount],
        ].map(([label, value]) => <Card key={String(label)} className="shadow-none"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 font-mono text-2xl font-semibold">{value}</p></CardContent></Card>)}
      </section>
      <Card className="shadow-none"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Warning className="size-4 text-warning" /> Gargalos de leads</CardTitle></CardHeader><CardContent className="space-y-2">{attention.items.filter((item) => item.count > 0).map((item) => <Link key={item.id} href={item.href} className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-3 hover:bg-muted/40"><span><span className="block text-sm font-medium">{item.title}</span><span className="block text-xs text-muted-foreground">{item.description}</span></span><span className="font-mono font-semibold">{item.count}</span></Link>)}{!attentionCount && <p className="text-sm text-success">Nenhum gargalo identificado.</p>}</CardContent></Card>
      <Card className="shadow-none"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ChartBar className="size-4 text-primary" /> Funil da carteira</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-5">{funnel.rows.slice(0, 5).map((row) => <div key={row.stage}><p className="text-xs text-muted-foreground">{row.stage}</p><p className="font-mono text-xl font-semibold">{row.inStage}</p></div>)}</CardContent></Card>
    </main>
  </>;
}
