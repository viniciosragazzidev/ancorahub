import Link from "next/link";
import { ArrowUpRight, CheckCircle, ChartBar, Warning } from "@/components/huge-icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DashboardViewModel } from "../contracts";

export function OperationalDashboard({ model, period }: { model: DashboardViewModel; period: number }) {
  return (
    <main className="flex min-h-full flex-col gap-5 bg-background p-(--mobile-page-padding) sm:gap-6 lg:p-6">
      <section aria-labelledby="dashboard-title" className="space-y-1">
        <h1 id="dashboard-title" className="text-2xl font-semibold tracking-tight">{model.header.title}</h1>
        <p className="text-sm text-muted-foreground">{model.header.description} · Últimos {period} dias</p>
      </section>

      <section aria-label="Indicadores principais" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {model.metrics.map((metric) => (
          <Card key={metric.id} className="shadow-none">
            <CardContent className="p-4"><p className="text-xs text-muted-foreground">{metric.label}</p><p className="mt-2 font-mono text-2xl font-semibold">{metric.value}</p><p className="mt-1 text-xs text-muted-foreground">{metric.description}</p></CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <Card className="shadow-none"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Warning className="size-4 text-warning" /> Atenção agora</CardTitle></CardHeader><CardContent className="space-y-2">
          {model.attention.length ? model.attention.map((item) => <Link key={item.id} href={item.href} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-3 transition-colors hover:bg-muted/40"><span className="min-w-0"><span className="block truncate text-sm font-medium">{item.title}</span><span className="block text-xs text-muted-foreground">{item.description}</span></span><span className="flex shrink-0 items-center gap-2"><Badge variant={item.tone === "danger" ? "destructive" : "warning"}>{item.count}</Badge><ArrowUpRight className="size-3.5 text-muted-foreground" /></span></Link>) : <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-3 text-sm text-success"><CheckCircle className="size-4" /> Nenhuma exceção operacional.</div>}
        </CardContent></Card>
        <Card className="shadow-none"><CardHeader><CardTitle className="text-base">{model.primary.title}</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{model.primary.description}</p><Link href="/leads" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">Abrir operação <ArrowUpRight className="size-3.5" /></Link></CardContent></Card>
      </section>

      <Card className="shadow-none"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ChartBar className="size-4 text-primary" /> {model.secondary?.title}</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-5"><div><p className="text-xs text-muted-foreground">Recebidos</p><p className="font-mono text-xl font-semibold">{model.metrics[0]?.value}</p></div><div><p className="text-xs text-muted-foreground">Conversão</p><p className="font-mono text-xl font-semibold">{model.metrics[1]?.value}</p></div><div><p className="text-xs text-muted-foreground">Atenção</p><p className="font-mono text-xl font-semibold">{model.metrics[2]?.value}</p></div><div><p className="text-xs text-muted-foreground">Vendas</p><p className="font-mono text-xl font-semibold">{model.metrics[3]?.value}</p></div><div><p className="text-xs text-muted-foreground">Detalhes</p><Link href="/relatorios" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">Relatórios <ArrowUpRight className="size-3.5" /></Link></div></CardContent></Card>
    </main>
  );
}
