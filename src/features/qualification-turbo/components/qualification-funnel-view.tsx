import Link from "next/link";
import { ChartBar, CurrencyCircleDollar, Flask, Funnel, Timer, UsersThree } from "@phosphor-icons/react/ssr";

import { DashboardHeader } from "@/components/dashboard-header";
import { StatCard } from "@/components/dashboard/metric-card";
import { Card, CardContent } from "@/components/ui/card";
import { SectionCardHeader } from "@/components/ui/section-card-header";
import { DashboardSectionTabs } from "@/features/dashboard/components/dashboard-section-tabs";
import { cn } from "@/lib/utils";

import { FUNNEL_PERIODS, type FunnelPeriod, type QualificationFunnel } from "../funnel";

const integer = new Intl.NumberFormat("pt-BR");
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function percent(part: number, whole: number) {
  if (!whole) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

function minutesLabel(minutes: number | null) {
  if (minutes === null) return "Sem respostas ainda";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h${String(minutes % 60).padStart(2, "0")}`;
}

function PeriodLinks({ active }: { active: FunnelPeriod }) {
  return (
    <nav aria-label="Período do funil" className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
      {FUNNEL_PERIODS.map((period) => (
        <Link
          key={period}
          href={`/dashboard?tab=funnel&period=${period}`}
          aria-current={period === active ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1 text-sm transition-colors",
            period === active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {period} dias
        </Link>
      ))}
    </nav>
  );
}

/** Funnel in one hue (Electric Blue): each bar is the share of the leads that arrived. */
function FunnelBars({ stages }: { stages: QualificationFunnel["stages"] }) {
  const first = stages[0]?.count ?? 0;
  return (
    <ol className="flex flex-col gap-3">
      {stages.map((stage, index) => {
        const previous = index > 0 ? stages[index - 1].count : null;
        const width = first ? Math.max(2, (stage.count / first) * 100) : 0;
        return (
          <li key={stage.key} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
            <span className="truncate text-muted-foreground">{stage.label}</span>
            <span className="h-6 overflow-hidden rounded-md bg-muted/60" aria-hidden="true">
              <span className="block h-full rounded-md bg-primary" style={{ width: `${width}%` }} />
            </span>
            <span className="w-32 text-right tabular-nums">
              <span className="font-medium text-foreground">{integer.format(stage.count)}</span>
              {previous !== null ? <span className="ml-2 text-xs text-muted-foreground">{percent(stage.count, previous)} da etapa</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-sm text-muted-foreground">{children}</p>;
}

export function QualificationFunnelView({ data, showQualityTab }: { data: QualificationFunnel; showQualityTab: boolean }) {
  const byKey = new Map(data.stages.map((stage) => [stage.key, stage.count]));
  const arrived = byKey.get("arrived") ?? 0;
  const replied = byKey.get("replied") ?? 0;
  const qualified = byKey.get("qualified") ?? 0;
  const converted = byKey.get("converted") ?? 0;
  const delivered = byKey.get("delivered") ?? 0;
  const sent = byKey.get("sent") ?? 0;

  return (
    <>
      <DashboardHeader breadcrumb="Operação comercial" title="Funil de qualificação" rightSlot={<PeriodLinks active={data.period} />} />
      <main className="mx-auto flex min-h-full w-full max-w-[1440px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <DashboardSectionTabs active="funnel" period={30} showQuality={showQualityTab} />

        <section aria-label="Resumo do período" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Leads que chegaram" value={integer.format(arrived)} sublabel={data.period === "today" ? "Hoje" : `Últimos ${data.period} dias`} icon={UsersThree} />
          <StatCard label="Responderam a mensagem" value={percent(replied, arrived)} sublabel={`${integer.format(replied)} leads · resposta em ${minutesLabel(data.medianMinutesToReply)} (mediana)`} icon={Timer} />
          <StatCard label="Qualificados" value={percent(qualified, arrived)} sublabel={`${integer.format(qualified)} leads prontos para o corretor`} icon={Funnel} />
          <StatCard label="Vendas" value={integer.format(converted)} sublabel={`${percent(converted, arrived)} dos leads que chegaram`} icon={ChartBar} />
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Card variant="overview">
            <SectionCardHeader
              icon={<Funnel />}
              title="Do anúncio à venda"
              description={`Os mesmos leads que chegaram ${data.period === "today" ? "hoje" : `nos últimos ${data.period} dias`}, etapa por etapa. ${sent && delivered < sent ? `${integer.format(sent - delivered)} primeiras mensagens não foram entregues pela Meta.` : ""}`}
            />
            <CardContent className="p-4">
              <FunnelBars stages={data.stages} />
            </CardContent>
          </Card>

          <Card variant="overview">
            <SectionCardHeader icon={<UsersThree />} title="Onde os leads estão agora" description="Situação atual dos leads do período." />
            <ul className="divide-y divide-border/50">
              {data.now.map((row) => (
                <li key={row.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0">
                    <span className="block text-sm text-foreground">{row.label}</span>
                    <span className="block text-xs text-muted-foreground">{row.hint}</span>
                  </span>
                  <span className="text-sm font-medium tabular-nums">{integer.format(row.count)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <Card variant="overview">
            <SectionCardHeader
              icon={<Flask />}
              title="Testes da primeira mensagem"
              description="Cada lead recebe uma variante e sempre a mesma. Com 50 envios por variante, o sistema passa a usar mais a que tem mais respostas."
            />
            {data.variants.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Mensagem</th>
                      <th className="px-4 py-2 text-right font-medium">Enviadas</th>
                      <th className="px-4 py-2 text-right font-medium">Responderam</th>
                      <th className="px-4 py-2 text-right font-medium">Qualificados</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {data.variants.map((row) => (
                      <tr key={`${row.approach}-${row.variant}`}>
                        <td className="px-4 py-2.5">
                          <span className="block text-foreground">{row.label}</span>
                          <span className="block text-xs text-muted-foreground">{row.approach}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{integer.format(row.sent)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          <span className="font-medium">{Math.round(row.rate * 100)}%</span>
                          <span className="ml-1 text-xs text-muted-foreground">({Math.round(row.low * 100)} a {Math.round(row.high * 100)}%)</span>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{percent(row.qualified, row.sent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>Os resultados aparecem depois das primeiras mensagens enviadas pela qualificação turbo.</Empty>
            )}
          </Card>

          <Card variant="overview">
            <SectionCardHeader icon={<Timer />} title="Qual mensagem trouxe a resposta" description="Último toque enviado antes da primeira resposta do lead." />
            <ul className="divide-y divide-border/50">
              {data.touches.map((row) => (
                <li key={row.touch} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="text-foreground">{row.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {integer.format(row.sent)} enviadas · <span className="font-medium text-foreground">{integer.format(row.repliesAfter)} respostas</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <Card variant="overview">
            <SectionCardHeader icon={<ChartBar />} title="Por que os leads foram perdidos" description="Motivo informado pelo corretor ou confirmado na sugestão da IA." />
            {data.lossReasons.length ? (
              <ul className="divide-y divide-border/50">
                {data.lossReasons.map((row) => (
                  <li key={row.label} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="text-foreground">{row.label}</span>
                    <span className="font-medium tabular-nums">{integer.format(row.count)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Nenhum lead do período foi marcado como perdido.</Empty>
            )}
          </Card>

          {data.cost ? <Card variant="overview">
            <SectionCardHeader
              icon={<CurrencyCircleDollar />}
              title={data.cost.source === "meta" ? "Custo na Meta" : "Custo estimado na Meta"}
              description={data.cost.source === "meta"
                ? "Mensagens cobradas pela Meta no período (dado de cada envio), na tabela de 1/10/2026: marketing R$ 0,32 e utilidade/atendimento R$ 0,035."
                : "Templates entregues a leads no período, pela tabela da Meta de 1/10/2026: marketing R$ 0,32 e utilidade R$ 0,035 por mensagem."}
            />
            <ul className="divide-y divide-border/50">
              <li className="flex items-center justify-between px-4 py-2.5 text-sm"><span>Total estimado</span><span className="font-medium tabular-nums">{brl.format(data.cost.total)}</span></li>
              <li className="flex items-center justify-between px-4 py-2.5 text-sm"><span className="text-muted-foreground">Marketing</span><span className="tabular-nums">{brl.format(data.cost.marketing)}</span></li>
              <li className="flex items-center justify-between px-4 py-2.5 text-sm"><span className="text-muted-foreground">Utilidade</span><span className="tabular-nums">{brl.format(data.cost.utility)}</span></li>
              <li className="flex items-center justify-between px-4 py-2.5 text-sm"><span className="text-muted-foreground">Por lead qualificado</span><span className="tabular-nums">{data.cost.perQualified === null ? "Sem qualificados" : brl.format(data.cost.perQualified)}</span></li>
            </ul>
          </Card> : null}
        </div>
      </main>
    </>
  );
}
