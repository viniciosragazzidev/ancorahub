import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getManagerUnitDuties } from "@/features/manager-scope/unit-duty-queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

const dayLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

function formatDay(day: string, today: string) {
  const label = dayLabel.format(new Date(`${day}T12:00:00-03:00`));
  return day === today ? `Hoje, ${label}` : label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Plantões da unidade (gestor, 10/11): só os plantões em que há corretor da unidade dele, e dentro de cada um só
 * esses corretores. Só leitura: criar, editar e escalar continua com o diretor.
 */
export default async function UnitDutiesPage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "manager") redirect(context.role === "director" ? "/distribuicao?view=plantao" : "/access-denied");

  const { days, occurrences } = await getManagerUnitDuties(context).catch((error) => {
    console.error("[equipe/plantoes] falha ao carregar os plantões da unidade", error instanceof Error ? error.message : error);
    return null;
  }) ?? { days: [] as string[], occurrences: null };
  const today = days[0] ?? "";

  return (
    <>
      <DashboardHeader breadcrumb="Equipe" title="Plantões da unidade" />
      <main className="flex flex-col gap-4 p-4 sm:p-6">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Plantões de hoje e dos próximos 7 dias em que há corretor da sua unidade. Aparecem só os corretores da sua
          unidade. Para mudar a escala, fale com o diretor.
        </p>
        {occurrences === null ? (
          <p role="alert" className="rounded-lg border border-border/70 bg-card p-4 text-sm">Não foi possível carregar os plantões agora. Tente de novo em instantes.</p>
        ) : !context.branchId ? (
          <p role="status" className="rounded-lg border border-border/70 bg-card p-4 text-sm">Sua conta ainda não tem unidade definida. Peça ao diretor para vincular você a uma unidade.</p>
        ) : occurrences.length === 0 ? (
          <p role="status" className="rounded-lg border border-border/70 bg-card p-4 text-sm">Nenhum corretor da sua unidade está escalado em plantão nos próximos dias.</p>
        ) : (
          days.filter((day) => occurrences.some((occurrence) => occurrence.date === day)).map((day) => (
            <section key={day} aria-label={formatDay(day, today)} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">{formatDay(day, today)}</h2>
              {occurrences.filter((occurrence) => occurrence.date === day).map((occurrence) => (
                <Card key={occurrence.key}>
                  <CardContent className="flex flex-col gap-3 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">{occurrence.scheduleName}</h3>
                      <Badge variant="outline">{occurrence.startsAt} às {occurrence.endsAt}</Badge>
                      <Badge variant="secondary">{occurrence.brokers.length === 1 ? "1 corretor da unidade" : `${occurrence.brokers.length} corretores da unidade`}</Badge>
                    </div>
                    <ul className="flex flex-col divide-y divide-border/60">
                      {occurrence.brokers.map((broker) => (
                        <li key={broker.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                          <Link href={`/equipe/${encodeURIComponent(broker.id)}`} className="font-medium hover:underline">{broker.name}</Link>
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <span>{broker.startsAt} às {broker.endsAt}</span>
                            {broker.paused ? <Badge variant="outline">Pausado</Badge> : null}
                            {day === today ? (
                              <Link href={`/plantoes/corretor/${encodeURIComponent(broker.id)}?plantao=${encodeURIComponent(occurrence.scheduleId)}`} className="text-primary hover:underline">Ver plantão agora</Link>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </section>
          ))
        )}
      </main>
    </>
  );
}
