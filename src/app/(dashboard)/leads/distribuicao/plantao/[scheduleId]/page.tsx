import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { ArrowLeft, CalendarCheck, UserList, Users } from "@/components/huge-icons";
import { LeadStatusBadge } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDutyScheduleProfile } from "@/features/lead-distribution/duty-schedule-profile-queries";
import { getDutyCoverage } from "@/features/lead-distribution/domain";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

const DAYS_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" });

function StatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge variant="success">Ativo</Badge>;
  if (status === "archived") return <Badge variant="outline">Arquivado</Badge>;
  return <Badge variant="secondary">Inativo</Badge>;
}

export default async function DutyScheduleProfilePage({ params }: { params: Promise<{ scheduleId: string }> }) {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") redirect("/access-denied");
  const { scheduleId } = await params;

  let profile: Awaited<ReturnType<typeof getDutyScheduleProfile>>;
  try {
    profile = await getDutyScheduleProfile(context, scheduleId);
  } catch {
    redirect("/leads/distribuicao?view=plantao");
  }

  const { schedule, roster, linkedQueues, leads, windowDays } = profile;
  const coverage = getDutyCoverage(roster.length, schedule.minimumBrokers);

  return <>
    <DashboardHeader
      breadcrumb="Distribuição · Plantões"
      title={schedule.name}
      rightSlot={<Button render={<Link href="/leads/distribuicao?view=plantao" />} size="sm" variant="outline"><ArrowLeft className="size-4" /> Voltar aos plantões</Button>}
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
            <p className="text-xs text-muted-foreground">Leads nos últimos {windowDays} dias</p>
            <UserList className="size-4 text-muted-foreground" />
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold tracking-tight">{leads.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Distribuídos para corretores deste plantão</p>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.85fr)]">
        <Card className="border-transparent bg-transparent shadow-none">
          <CardHeader className="border-b border-border/60 p-4">
            <CardTitle className="text-base">Leads do plantão</CardTitle>
            <CardDescription>Leads distribuídos para um corretor escalado neste plantão nos últimos {windowDays} dias.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {leads.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Corretor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Distribuído em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.nome}</TableCell>
                      <TableCell className="text-muted-foreground">{lead.brokerName ?? "—"}</TableCell>
                      <TableCell><LeadStatusBadge status={lead.status} /></TableCell>
                      <TableCell className="text-muted-foreground">{lead.assignedAt ? dateTime.format(lead.assignedAt) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhum lead caiu para este plantão nos últimos {windowDays} dias.</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-transparent bg-transparent shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Corretores escalados</CardTitle>
            <CardDescription>Quem está na escala ativa deste plantão agora.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {roster.length ? roster.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{entry.brokerName}</p>
                  <p className="text-xs text-muted-foreground">{entry.internalCode ? `Código ${entry.internalCode}` : "Sem código"} · {entry.availabilityStatus ?? "—"}</p>
                </div>
                <Badge variant="secondary">{entry.leadsInWindow} lead{entry.leadsInWindow === 1 ? "" : "s"}</Badge>
              </div>
            )) : <p className="text-sm text-muted-foreground">Nenhum corretor escalado neste plantão.</p>}
          </CardContent>
        </Card>
      </div>

      {context.role === "manager" ? <p className="text-xs text-muted-foreground">Você está vendo apenas dados da sua unidade.</p> : null}
    </main>
  </>;
}
