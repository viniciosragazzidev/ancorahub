import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock3, Download } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { ArrowLeft, CalendarCheck, UserList, Users } from "@/components/huge-icons";
import { LeadStatusBadge } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDutyScheduleProfile } from "@/features/lead-distribution/duty-schedule-profile-queries";
import { getDutyCoverage } from "@/features/lead-distribution/domain";
import { leadDistributionStatusUi } from "@/features/lead-distribution/status-ui";
import { getReturnedUnacceptedLeadIds } from "@/features/lead-distribution/returned-unaccepted";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { hasCapability } from "@/shared/auth/permissions";
import { BrokerCapacityBar, BrokerLiveStatus } from "../_components/broker-live-status";
import { BrokerPresenceInviteButton } from "../_components/broker-presence-invite-button";
import { BrokerPauseButton } from "../_components/broker-pause-button";
import { groupDutyLeadsByShift, sortByAssignmentTime } from "@/features/lead-distribution/duty-leads-shift-groups";
import { DragScrollTable } from "@/components/ui/drag-scroll-table";

export const dynamic = "force-dynamic";

const DAYS_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const timeOnly = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: "America/Sao_Paulo" });

function StatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge variant="success">Ativo</Badge>;
  if (status === "archived") return <Badge variant="outline">Arquivado</Badge>;
  return <Badge variant="secondary">Inativo</Badge>;
}

export default async function DutyScheduleProfilePage({ params, searchParams }: { params: Promise<{ scheduleId: string }>; searchParams: Promise<{ situacao?: string }> }) {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") redirect("/access-denied");
  const { scheduleId } = await params;
  const { situacao } = await searchParams;

  let profile: Awaited<ReturnType<typeof getDutyScheduleProfile>>;
  try {
    profile = await getDutyScheduleProfile(context, scheduleId);
  } catch {
    redirect("/leads/distribuicao?view=plantao");
  }

  const { schedule, roster, linkedQueues, leads, leadsSince, leadsUntil, leadsUpcomingStartsAt, presenceEnabled, liveStatusEnabled } = profile;
  const confirmedCount = roster.filter((entry) => entry.presenceStatus === "confirmed").length;
  const readyNowCount = roster.filter((entry) => entry.liveStatus === "ready").length;
  const coverage = getDutyCoverage(roster.length, schedule.minimumBrokers);
  const returnedUnaccepted = await getReturnedUnacceptedLeadIds(context.tenantId, leads.map((lead) => lead.id));
  const canExportReport = hasCapability(context.role, "exportar_relatorios_operacionais", context.jobTitle);

  const isDistributed = (lead: (typeof leads)[number]) => Boolean(lead.corretorId) && lead.distributionStatus === "assigned";
  const distributedCount = leads.filter(isDistributed).length;
  const waitingCount = leads.length - distributedCount;
  // Only two situations matter operationally here; "todos" mixed them back
  // together and hid which bucket someone was actually looking at.
  const filter = situacao === "distribuidos" ? "distribuidos" : "aguardando";
  // Distributed rows read as the order leads were handed out (earliest
  // assignment first); the waiting list keeps its newest-arrival order.
  const visibleLeads = filter === "distribuidos"
    ? sortByAssignmentTime(leads.filter(isDistributed))
    : leads.filter((lead) => !isDistributed(lead));
  const filters = [
    { key: "aguardando", label: "Aguardando distribuição", count: waitingCount },
    { key: "distribuidos", label: "Distribuídos", count: distributedCount },
  ] as const;
  const sinceLabel = leadsSince.getTime() === 0
    ? "desde a criação deste plantão"
    : leadsUpcomingStartsAt
      ? `aguardando o início de hoje às ${timeOnly.format(leadsUpcomingStartsAt)} (desde ${dateTime.format(leadsSince)})`
      : leadsUntil
      ? `nesta ocorrência (${dateTime.format(leadsSince)} – ${dateTime.format(leadsUntil)})`
      : `desde o início desta ocorrência (${dateTime.format(leadsSince)})`;

  return <>
    <DashboardHeader
      breadcrumb="Distribuição · Plantões"
      title={schedule.name}
      rightSlot={<div className="flex flex-wrap items-center gap-2">
        {canExportReport ? (
          <Button render={<a href={`/api/reports/duty-schedule/${schedule.id}`} download />} size="sm" variant="outline" className="gap-1.5">
            <Download className="size-3.5" aria-hidden="true" /> Exportar PDF
          </Button>
        ) : null}
        <Button render={<Link href="/leads/distribuicao?view=plantao" />} size="sm" variant="outline"><ArrowLeft className="size-4" /> Voltar aos plantões</Button>
      </div>}
    />
    <main className="mx-auto flex min-h-full w-full max-w-[1440px] flex-col gap-5 bg-background p-4 lg:p-6">
      <Card className="border-transparent bg-transparent shadow-none">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight">{schedule.name}</h1>
              <StatusBadge status={schedule.status} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{schedule.branchName ?? "Todas as unidades"}</span>
              <span className="text-border">•</span>
              <span>{schedule.queueName}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:text-right">
            <div>
              <p className="text-muted-foreground">Dia / horário</p>
              <p className="mt-1 font-medium">{DAYS_FULL[schedule.dayOfWeek]} · {schedule.startsAt.slice(0, 5)}–{schedule.endsAt.slice(0, 5)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Fuso horário</p>
              <p className="mt-1 font-medium">{schedule.timezone}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <section aria-label="Resumo do plantão" className="overflow-hidden rounded-xl border border-border bg-card shadow-none sm:grid sm:grid-cols-3">
        <div className="min-w-0 border-b border-border/60 px-4 py-4 sm:border-b-0 sm:border-r">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Cobertura</p>
            <Users className="size-4 text-muted-foreground" />
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold tracking-tight">{coverage.assigned}/{coverage.minimum}</p>
          <p className="mt-1 text-xs text-muted-foreground">{coverage.covered ? "Escala completa" : `Faltam ${coverage.missing} corretor(es)`}</p>
        </div>
        <div className="min-w-0 border-b border-border/60 px-4 py-4 sm:border-b-0 sm:border-r">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Filas vinculadas</p>
            <CalendarCheck className="size-4 text-muted-foreground" />
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold tracking-tight">{linkedQueues.length}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{linkedQueues.length ? linkedQueues.map((queue) => queue.name).join(", ") : "Nenhuma fila vinculada"}</p>
        </div>
        <div className="min-w-0 px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Leads {sinceLabel}</p>
            <UserList className="size-4 text-muted-foreground" />
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold tracking-tight">{leads.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">{distributedCount} distribuídos · {waitingCount} aguardando</p>
        </div>
      </section>

      <div className="flex flex-col gap-5">
        <Card className="border-transparent bg-transparent shadow-none">
          <CardHeader className="border-b border-border/60 p-4">
            <CardTitle className="text-base">Leads do plantão</CardTitle>
            <CardDescription>Leads das filas deste plantão {sinceLabel} — aguardando distribuição, ofertados, distribuídos e em atendimento.</CardDescription>
            <nav aria-label="Filtrar leads por situação" className="mt-3 flex flex-wrap gap-2">
              {filters.map((item) => (
                <Button
                  key={item.key}
                  render={<Link href={`/leads/distribuicao/plantao/${schedule.id}?situacao=${item.key}`} />}
                  size="sm"
                  variant={filter === item.key ? "secondary" : "outline"}
                >
                  {item.label} <span className="ml-1 font-mono text-xs text-muted-foreground">{item.count}</span>
                </Button>
              ))}
            </nav>
          </CardHeader>
          <CardContent className="p-0">
            {visibleLeads.length ? (
              <DragScrollTable className="[&_[data-slot=table-container]]:max-h-[60vh] [&_[data-slot=table-container]]:overflow-y-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead>Fila</TableHead>
                      <TableHead>Corretor</TableHead>
                      <TableHead>Distribuição</TableHead>
                      <TableHead>Etapa</TableHead>
                      <TableHead>Recebido em</TableHead>
                      <TableHead>Distribuído em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupDutyLeadsByShift(visibleLeads).map((group) => (
                      <Fragment key={group.key}>
                        <TableRow className="bg-[var(--surface-secondary)] hover:bg-[var(--surface-secondary)]">
                          <TableCell colSpan={7} className="py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            <span className="flex items-center justify-between gap-2">
                              {group.label}
                              <span className="font-mono">{group.leads.length}</span>
                            </span>
                          </TableCell>
                        </TableRow>
                        {group.leads.map((lead) => {
                          const distribution = leadDistributionStatusUi(lead.distributionStatus);
                          return (
                            <TableRow key={lead.id} className={returnedUnaccepted.has(lead.id) ? "bg-warning/10 hover:bg-warning/15" : undefined}>
                              <TableCell className="font-medium">{lead.nome}</TableCell>
                              <TableCell className="text-muted-foreground">{lead.queueName ?? "—"}</TableCell>
                              <TableCell className="text-muted-foreground">{returnedUnaccepted.has(lead.id) ? <span className="flex items-center gap-1.5 font-medium text-warning" title="Já passou por um corretor que não aceitou/atendeu a tempo; aguardando novo corretor"><span className="size-2 shrink-0 animate-pulse rounded-full bg-warning motion-reduce:animate-none" aria-hidden="true" />Devolvido — não aceito</span> : (lead.brokerName ?? "Sem corretor")}</TableCell>
                              <TableCell><Badge variant={distribution.tone}>{distribution.label}</Badge></TableCell>
                              <TableCell><LeadStatusBadge status={lead.status} /></TableCell>
                              <TableCell className="text-muted-foreground">{dateTime.format(lead.createdAt)}</TableCell>
                              <TableCell className="text-muted-foreground">{lead.assignedAt && lead.corretorId ? dateTime.format(lead.assignedAt) : "—"}</TableCell>
                            </TableRow>
                          );
                        })}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </DragScrollTable>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhum lead nesta situação para este plantão {sinceLabel}.</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-transparent bg-transparent shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{presenceEnabled ? "Checklist de confirmação" : "Corretores escalados"}</CardTitle>
            <CardDescription>{presenceEnabled ? `${confirmedCount} de ${roster.length} corretores confirmaram a ocorrência atual.` : "Quem está na escala ativa deste plantão agora."}</CardDescription>
            {liveStatusEnabled && roster.length ? (
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                <span className="text-foreground">{readyNowCount}</span> de {roster.length} prontos para receber o próximo lead agora
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3" role={presenceEnabled ? "group" : undefined} aria-label={presenceEnabled ? "Status de confirmação dos corretores escalados" : undefined}>
            {roster.length && roster.every((entry) => entry.blockedReason) ? (
              <div role="alert" className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-xs text-foreground">
                <strong className="font-semibold">Nenhum escalado está elegível para receber leads.</strong> Há pendências de cadastro ou confirmação — os leads permanecem aguardando.
              </div>
            ) : null}
            {roster.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{roster.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-medium">{entry.brokerName}</p>
                    {presenceEnabled && entry.presenceStatus === "confirmed" ? <Badge variant="success" aria-label={`Presença confirmada${entry.confirmedAt ? ` às ${dateTime.format(entry.confirmedAt)}` : ""}`} title={entry.confirmedAt ? `Confirmado em ${dateTime.format(entry.confirmedAt)}` : "Presença confirmada"}><CheckCircle2 className="size-3.5" aria-hidden="true" /></Badge> : null}
                    {presenceEnabled && entry.presenceStatus === "pending" ? <Badge variant="warning" aria-label="Aguardando confirmação" title={entry.notificationErrorCode ? "Não foi possível enviar o lembrete" : "Aguardando confirmação"}><Clock3 className="size-3.5" aria-hidden="true" /></Badge> : null}
                    {presenceEnabled ? <BrokerPresenceInviteButton scheduleId={schedule.id} assignmentId={entry.id} brokerName={entry.brokerName} /> : null}
                    <BrokerPauseButton scheduleId={schedule.id} assignmentId={entry.id} brokerName={entry.brokerName} paused={Boolean(entry.pausedAt)} />
                  </div>
                  <p className="text-xs text-muted-foreground">{entry.internalCode ? `Código ${entry.internalCode}` : "Sem código"} · {entry.availabilityStatus ?? "—"}</p>
                  {entry.blockedReason ? <p className="mt-0.5 text-xs font-medium text-warning">{entry.blockedReason}</p> : null}
                  <div className="mt-1.5">
                    <BrokerLiveStatus status={entry.liveStatus} nextEventAt={entry.nextEventAt ? entry.nextEventAt.toISOString() : null} />
                  </div>
                  <BrokerCapacityBar activeLeads={entry.activeLeads} capacity={entry.capacity} />
                </div>
                {/* Leads received in this occurrence: morning (até 12:59) in blue, afternoon (13:00+) in red. */}
                <div className="flex shrink-0 items-center gap-1.5" aria-label={`${entry.leadsMorning} leads de manhã e ${entry.leadsAfternoon} à tarde`}>
                  <Badge variant="info" title="Leads recebidos de manhã (até 12:59)">Manhã {entry.leadsMorning}</Badge>
                  <Badge variant="destructive" title="Leads recebidos à tarde (a partir de 13:00)">Tarde {entry.leadsAfternoon}</Badge>
                </div>
              </div>
            ))}</div> : <p className="text-sm text-muted-foreground">Nenhum corretor escalado neste plantão.</p>}
          </CardContent>
        </Card>
      </div>

      {context.role === "manager" ? <p className="text-xs text-muted-foreground">Você está vendo apenas dados da sua unidade.</p> : null}
    </main>
  </>;
}
