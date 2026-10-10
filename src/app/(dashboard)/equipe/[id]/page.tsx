import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { ArrowLeft, ChartBar, CheckCircle, Clock, Target, UserList, UserSwitch, XCircle } from "@/components/huge-icons";
import { MemberStatusBadge, RoleBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/user-avatar";
import { getTeamMemberProfile, MEMBER_PROFILE_LEADS_LIMIT } from "@/features/team/member-profile";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { MemberDutyCalendar } from "./_components/member-duty-calendar";
import { MemberLeadsTabs } from "./_components/member-leads-tabs";
import { MemberOffersPanel, MemberTemperaturePanel } from "./_components/member-temperature";
import { MemberRankingPanel } from "./_components/member-ranking";
import { getMemberOfferRanking } from "@/features/engagement/broker-stats";

export const dynamic = "force-dynamic";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Sao_Paulo" });


function Metric({ label, value, detail, icon: Icon, tone = "default" }: { label: string; value: string | number; detail: string; icon: typeof ChartBar; tone?: "default" | "success" | "warning" | "danger" }) {
  const toneClass = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "danger" ? "text-destructive" : "text-muted-foreground";
  return <div className="min-w-0 border-b border-border/60 px-4 py-4 sm:border-b-0 sm:border-r last:border-r-0">
    <div className="flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{label}</p><Icon className={`size-4 ${toneClass}`} /></div>
    <p className="mt-2 font-mono text-2xl font-semibold tracking-tight">{value}</p>
    <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
  </div>;
}

export default async function TeamMemberProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") redirect("/access-denied");
  const { id } = await params;
  const profile = await getTeamMemberProfile(id);
  if (!profile) redirect("/access-denied");

  const { member, metrics, recentLeads, recentRedistributions, dutyDays } = profile;
  const isBroker = member.role === "broker";
  // Behind the journey flag (inside): off, the profile shows nothing new and runs no query.
  const ranking = isBroker ? await getMemberOfferRanking(context.tenantId, member.userId).catch(() => null) : null;
  const roleName = member.customRoleName ?? ({ director: "Diretor", manager: "Gestor", supervisor: "Supervisor", broker: "Corretor" }[member.role]);
  const firstContactRate = metrics.leads.total > 0 ? Math.round(((metrics.leads.total - metrics.leads.withoutFirstContact) / metrics.leads.total) * 100) : 0;

  return <>
    <DashboardHeader breadcrumb="Equipe" title="Perfil do membro" rightSlot={<Button render={<Link href="/equipe" />} size="sm" variant="outline"><ArrowLeft className="size-4" /> Voltar à equipe</Button>} />
    <main className="mx-auto flex min-h-full w-full max-w-[1440px] flex-col gap-5 bg-background p-4 lg:p-6">
      <Card className="border-transparent bg-transparent shadow-none">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-center gap-4">
            <UserAvatar seed={member.email} name={member.name} size="lg" className="size-14 shrink-0 rounded-xl" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-xl font-semibold tracking-tight">{member.name}</h1><MemberStatusBadge status={member.membershipStatus === "active" ? member.userStatus : "disabled"} /></div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"><RoleBadge role={member.role} jobTitle={member.jobTitle} /><span>{roleName}</span><span className="text-border">•</span><span>{member.branchName ?? "Geral da empresa"}</span></div>
              <p className="mt-2 truncate text-sm text-muted-foreground">{member.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:text-right"><div><p className="text-muted-foreground">Disponibilidade</p><p className="mt-1 font-medium capitalize">{member.availabilityStatus}</p></div><div><p className="text-muted-foreground">No time desde</p><p className="mt-1 font-medium">{date.format(member.joinedAt)}</p></div>{member.brokerCode ? <div><p className="text-muted-foreground">Código</p><p className="mt-1 font-mono font-medium">{member.brokerCode}</p></div> : null}{member.brokerLifecycleStatus ? <div><p className="text-muted-foreground">Cadastro</p><p className="mt-1 font-medium capitalize">{member.brokerLifecycleStatus.toLowerCase()}</p></div> : null}</div>
        </CardContent>
      </Card>

      <section aria-label="Resumo operacional" className="overflow-hidden rounded-xl border border-border bg-card shadow-none sm:grid sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Carteira" value={metrics.leads.total} detail={`${metrics.leads.active} em andamento`} icon={UserList} />
        <Metric label="Qualificados" value={metrics.leads.qualified} detail={`${metrics.leads.converted} convertidos`} icon={Target} tone="success" />
        <Metric label="Sem contato" value={metrics.leads.withoutFirstContact} detail={`${firstContactRate}% com 1º contato`} icon={Clock} tone={metrics.leads.withoutFirstContact ? "warning" : "success"} />
        <Metric label="Perdidos" value={metrics.leads.lost} detail="Leads encerrados" icon={XCircle} tone={metrics.leads.lost ? "danger" : "default"} />
        <Metric label="Vendas ativas" value={metrics.sales.active} detail={currency.format(Number(metrics.sales.volume))} icon={ChartBar} tone="success" />
        <Metric label="Tarefas" value={metrics.tasks.open} detail={`${metrics.tasks.overdue} vencida(s)`} icon={CheckCircle} tone={metrics.tasks.overdue ? "warning" : "default"} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 content-start gap-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <MemberTemperaturePanel counts={metrics.temperature} />
            <MemberOffersPanel offers={metrics.offers} />
          </div>
          <MemberLeadsTabs leads={recentLeads} limit={MEMBER_PROFILE_LEADS_LIMIT} />
        </div>

        <aside className="grid content-start gap-5">
          {isBroker && ranking ? <MemberRankingPanel stats={ranking.stats} ranks={ranking.ranks} periodDays={ranking.periodDays} withoutStep={ranking.withoutStep} /> : null}
          {isBroker ? <MemberDutyCalendar days={dutyDays} /> : null}
          <Card className="border-border bg-card shadow-none">
            <CardHeader className="pb-3"><CardTitle className="text-base">Resultado comercial</CardTitle><CardDescription>Produção registrada no CRM.</CardDescription></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-xs text-muted-foreground">Cotações criadas</p><p className="mt-1 font-mono text-xl font-semibold">{metrics.quotes.total}</p><p className="text-xs text-muted-foreground">{metrics.quotes.sent} enviadas</p></div>
              <div><p className="text-xs text-muted-foreground">Vendas</p><p className="mt-1 font-mono text-xl font-semibold">{metrics.sales.total}</p><p className="text-xs text-muted-foreground">{metrics.sales.cancelled} cancelada(s)</p></div>
              <div><p className="text-xs text-muted-foreground">Atividades</p><p className="mt-1 font-mono text-xl font-semibold">{metrics.interactions}</p><p className="text-xs text-muted-foreground">Interações registradas</p></div>
              <div><p className="text-xs text-muted-foreground">Tarefas concluídas</p><p className="mt-1 font-mono text-xl font-semibold">{metrics.tasks.completed}</p><p className="text-xs text-muted-foreground">de {metrics.tasks.total} atribuídas</p></div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card shadow-none">
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><UserSwitch className="size-4" /> Redistribuições</CardTitle><CardDescription>Leads que saíram da carteira deste membro. Não pressupõe responsabilidade individual sem uma causa registrada.</CardDescription></CardHeader>
            <CardContent className="space-y-3">{recentRedistributions.length ? recentRedistributions.map((event) => <div key={event.id} className="rounded-lg border border-border/70 px-3 py-2.5"><div className="flex items-start justify-between gap-3"><p className="min-w-0 truncate text-sm font-medium">{event.leadName}</p><span className="shrink-0 text-[11px] text-muted-foreground">{date.format(event.createdAt)}</span></div><p className="mt-1 text-xs text-muted-foreground">{event.reason || event.action}</p></div>) : <p className="text-sm text-muted-foreground">Não há redistribuições registradas dentro do escopo atual.</p>}<div className="rounded-lg bg-muted/35 px-3 py-2 text-xs text-muted-foreground">{metrics.redistributions} no histórico, sendo <strong className="font-medium text-foreground">{metrics.redistributionsWithoutFirstContact}</strong> antes do primeiro atendimento.</div></CardContent>
          </Card>
        </aside>
      </div>
      {context.role === "manager" ? <p className="text-xs text-muted-foreground">Você está vendo apenas dados e leads da sua unidade.</p> : null}
    </main>
  </>;
}
