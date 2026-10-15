import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { ArrowLeft, ChartBar, CheckCircle, Clock, Target, UserList, UserSwitch, XCircle } from "@/components/huge-icons";
import { MemberStatusBadge, RoleBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/user-avatar";
import { getTeamMemberProfile, MEMBER_PROFILE_LEADS_LIMIT } from "@/features/team/member-profile";
import { getBrokerMonthGoal } from "@/features/goals/lite-goals-queries";
import { isTeamManagementEnabled } from "@/features/team-management-ui/flag";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { MemberDutyCalendar } from "./_components/member-duty-calendar";
import { MemberLeadsTabs } from "./_components/member-leads-tabs";
import { MemberOffersPanel, MemberTemperaturePanel } from "./_components/member-temperature";
import { MemberRankingPanel } from "./_components/member-ranking";
import { getMemberOfferRanking, getScopedMemberOfferRanking } from "@/features/engagement/broker-stats";
import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { getCachedSupervisorWorkspaceData } from "@/features/broker-workspace/chat/chat-rail-data";
import { rankHeadline, type RankPosition } from "@/features/engagement/ranking";
import { buildWhatsAppUrl } from "@/lib/whatsapp-url";
import { listBrokerNotes } from "@/features/supervisor-workspace/notes-actions";
import { SupervisorBrokerProfile, SupervisorNoteHistory } from "@/features/supervisor-workspace/broker-profile/supervisor-broker-profile";
import { getSupervisorLiteMemberPulse, getSupervisorLiteNextTask, getSupervisorLiteRecognitions, getSupervisorLiteWhatsAppStatus } from "@/features/supervisor-workspace/lite-queries";
import { getManagerLiteTeam } from "@/features/manager-workspace/manager-lite-team-queries";
import { LiteBrokerProfileActions } from "@/features/manager-workspace/manager-lite-profile-actions";
import { getTeamMetrics, type TeamMetricsResult } from "@/features/team-management/metrics";
import { buildBrokerPerformanceView, normalizeBrokerPerformanceWindow } from "@/features/team-management-ui/build-broker-performance";

export const dynamic = "force-dynamic";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Sao_Paulo" });

// Situação e reconhecimentos do topo do perfil Lite. Escopo checado em cada query (gestor = unidade, supervisor = equipe).
// The gestor sees the whole unit, not one duty roster, so the "Plantão de hoje" row stays hidden there (dutyToday undefined).
async function getBrokerProfileExtras(context: Parameters<typeof getSupervisorLiteNextTask>[0]["context"], memberId: string) {
  const [nextTask, recognitions, whatsapp] = await Promise.all([
    getSupervisorLiteNextTask({ context, memberId }).catch(() => null),
    getSupervisorLiteRecognitions({ context, memberId }).catch(() => []),
    getSupervisorLiteWhatsAppStatus({ context, memberId }).catch(() => null),
  ]);
  return { nextTask, recognitions, whatsapp };
}

function brokerPerformanceFromMetrics(metrics: TeamMetricsResult | null, brokerId: string, window: 7 | 30) {
  const broker = metrics?.brokers.find((item) => item.id === brokerId) ?? null;
  const team = broker
    ? metrics?.teams.find((item) => item.supervisorId === broker.supervisorId) ?? null
    : null;
  return buildBrokerPerformanceView(broker, {
    window,
    teamMedianAcceptSeconds: team?.current.medianAcceptanceSeconds ?? null,
  });
}


function Metric({ label, value, detail, icon: Icon, tone = "default" }: { label: string; value: string | number; detail: string; icon: typeof ChartBar; tone?: "default" | "success" | "warning" | "danger" }) {
  const toneClass = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "danger" ? "text-destructive" : "text-muted-foreground";
  return <div className="min-w-0 border-b border-border/60 px-4 py-4 sm:border-b-0 sm:border-r last:border-r-0">
    <div className="flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{label}</p><Icon className={`size-4 ${toneClass}`} /></div>
    <p className="mt-2 font-mono text-2xl font-semibold tracking-tight">{value}</p>
    <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
  </div>;
}

export default async function TeamMemberProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ janela?: string | string[] }>;
}) {
  const context = await getRequiredTenantContext();
  // Supervisor sees the profile of their own team's brokers (team checked in getTeamMemberProfile).
  if (context.role !== "director" && context.role !== "manager" && !(context.role === "supervisor" && context.supervisorTeamScope)) redirect("/access-denied");
  const { id } = await params;
  const { janela } = await searchParams;
  const window = normalizeBrokerPerformanceWindow(janela);
  const profile = await getTeamMemberProfile(id);
  if (!profile) redirect("/access-denied");

  const audience = await getLiteAudience(context);
  const managerLite = context.role === "manager" && audience === "manager";
  if (managerLite && profile.member.role !== "broker") redirect("/not-found");
  if (managerLite) {
    // Meta do mês do corretor: só com a gestão de equipes ligada. O gestor vê, não edita a meta do corretor.
    const monthGoalRow = (await isTeamManagementEnabled()) ? await getBrokerMonthGoal({ context, brokerId: profile.member.userId, now: new Date() }).catch(() => null) : null;
    const notes = await listBrokerNotes(profile.member.userId).catch(() => []);
    const teamData = await getManagerLiteTeam(context);
    const brokerIds = teamData.members.filter((member) => member.status === "active" && member.userId).map((member) => member.userId!);
    const [ranking, metricResult, pulse, extras] = await Promise.all([
      getScopedMemberOfferRanking(context.tenantId, brokerIds, profile.member.userId).catch(() => null),
      getTeamMetrics(context, { window, now: new Date() }).catch(() => null),
      getSupervisorLiteMemberPulse({ context, memberId: profile.member.userId, slaMinutes: teamData.slaMinutes }).catch(() => null),
      getBrokerProfileExtras(context, profile.member.userId),
    ]);
    const performance = brokerPerformanceFromMetrics(metricResult, profile.member.userId, window);
    const newLeads = profile.recentLeads.filter((lead) => lead.status === "new" || lead.status === "distributed").length;
    const activeStatuses = new Set(["new", "distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"]);
    const active = profile.member.membershipStatus === "active" && profile.member.userStatus === "active";
    return <SupervisorBrokerProfile
      member={{ userId: profile.member.userId, name: profile.member.name, image: profile.member.image, branchName: profile.member.branchName, availabilityStatus: profile.member.availabilityStatus, email: profile.member.email, phone: profile.member.brokerPhone, brokerCode: profile.member.brokerCode, statusLabel: active ? "Ativo" : "Desativado" }}
      metrics={{ portfolio: profile.metrics.leads.total, inService: profile.metrics.leads.active, withoutFirstContact: profile.metrics.leads.withoutFirstContact, sales: profile.metrics.sales.total, overdueTasks: profile.metrics.tasks.overdue, qualified: profile.metrics.leads.qualified, lost: profile.metrics.leads.lost }}
      recentLeads={profile.recentLeads.filter((lead) => activeStatuses.has(lead.status)).slice(0, 8).map((lead) => ({ id: lead.id, name: lead.name, status: lead.status, queueName: lead.queueName, assignedAt: lead.assignedAt?.toISOString() ?? null, createdAt: lead.createdAt.toISOString() }))}
      whatsappHref={buildWhatsAppUrl(profile.member.brokerPhone)}
      relationshipHref={`/relacionamento?brokerId=${encodeURIComponent(profile.member.userId)}`}
      ranking={ranking ? { medianAcceptSeconds: ranking.stats?.medianAcceptSeconds ?? null, positions: ranking.ranks.map((rank) => rankHeadline(rank)), periodDays: ranking.periodDays } : null}
      notes={notes} joinedAt={profile.member.joinedAt.toISOString()} weeklyAcceptances={pulse?.week ?? []}
      situation={{ dutyToday: undefined, newLeads, nextTask: extras.nextTask, whatsapp: extras.whatsapp }}
      performance={performance}
      recognitions={extras.recognitions}
      managerProfile={{ temperature: profile.metrics.temperature, quotes: profile.metrics.quotes, sales: profile.metrics.sales, interactions: profile.metrics.interactions, tasks: profile.metrics.tasks, dutyDays: profile.dutyDays.map((day) => ({ date: new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(`${day.date}T12:00:00-03:00`)), scheduleName: day.scheduleName, startsAt: day.startsAt, endsAt: day.endsAt, state: day.state })) }}
      managementActions={<LiteBrokerProfileActions userId={profile.member.userId} name={profile.member.name} email={profile.member.email} phone={profile.member.brokerPhone ?? ""} active={active} canResetPassword />}
      showSupervisorActions={false}
      monthGoal={monthGoalRow ? { brokerId: profile.member.userId, period: monthGoalRow.period, goal: monthGoalRow.goal, canEdit: false } : undefined}
    />;
  }
  const supervisorLite = context.role === "supervisor" && audience === "supervisor";
  if (supervisorLite) {
    // Meta do mês do corretor da equipe: o supervisor edita pelo mesmo bottom-sheet da equipe.
    const monthGoalRow = (await isTeamManagementEnabled()) ? await getBrokerMonthGoal({ context, brokerId: profile.member.userId, now: new Date() }).catch(() => null) : null;
    if (profile.member.role !== "broker") redirect("/not-found");
    const notes = await listBrokerNotes(profile.member.userId).catch(() => []);
    const teamData = profile.member.role === "broker" ? await getCachedSupervisorWorkspaceData().catch(() => null) : null;
    const brokerIds = teamData?.team.map((broker) => broker.userId) ?? [];
    const ranking = profile.member.role === "broker"
      ? await getScopedMemberOfferRanking(context.tenantId, brokerIds, profile.member.userId).catch(() => null)
      : null;
    const teamRanks: RankPosition[] = ranking ? teamData?.team.find((broker) => broker.userId === profile.member.userId)?.ranks ?? [] : [];
    const [metricResult, pulse, extras] = await Promise.all([
      getTeamMetrics(context, { window, now: new Date(), includeUnitConversionRate: false }).catch(() => null),
      profile.member.role === "broker" && teamData
        ? getSupervisorLiteMemberPulse({ context, memberId: profile.member.userId, slaMinutes: teamData.slaMinutes }).catch(() => null)
        : Promise.resolve(null),
      getBrokerProfileExtras(context, profile.member.userId),
    ]);
    const performance = brokerPerformanceFromMetrics(metricResult, profile.member.userId, window);
    const newLeads = profile.recentLeads.filter((lead) => lead.status === "new" || lead.status === "distributed").length;
    const duty = teamData?.duty.find((item) => item.brokerId === profile.member.userId);
    const liveAvailability = duty ? duty.paused ? "paused" : duty.presence === "confirmed" ? "on_duty" : "offline" : profile.member.availabilityStatus;
    const activeStatuses = new Set(["distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"]);
    return (
      <SupervisorBrokerProfile
        member={{
          userId: profile.member.userId,
          name: profile.member.name,
          image: profile.member.image,
          branchName: profile.member.branchName,
          availabilityStatus: liveAvailability,
          email: profile.member.email,
          phone: profile.member.brokerPhone,
          brokerCode: profile.member.brokerCode,
          statusLabel: profile.member.membershipStatus === "active" && profile.member.userStatus === "active" ? "Ativo" : "Desativado",
        }}
        metrics={{
          portfolio: profile.metrics.leads.total,
          inService: profile.metrics.leads.active,
          withoutFirstContact: profile.metrics.leads.withoutFirstContact,
          sales: profile.metrics.sales.active,
          overdueTasks: profile.metrics.tasks.overdue,
          qualified: profile.metrics.leads.qualified,
          lost: profile.metrics.leads.lost,
        }}
        recentLeads={profile.recentLeads
          .filter((lead) => activeStatuses.has(lead.status))
          .slice(0, 5)
          .map((lead) => ({
            id: lead.id,
            name: lead.name,
            status: lead.status,
            queueName: lead.queueName,
            assignedAt: lead.assignedAt?.toISOString() ?? null,
            createdAt: lead.createdAt.toISOString(),
          }))}
        whatsappHref={buildWhatsAppUrl(profile.member.brokerPhone)}
        relationshipHref="/relacionamento"
        ranking={ranking ? {
          medianAcceptSeconds: ranking.stats?.medianAcceptSeconds ?? null,
          positions: teamRanks.map((rank) => rankHeadline(rank)),
          periodDays: ranking.periodDays,
        } : null}
        notes={notes}
        joinedAt={profile.member.joinedAt.toISOString()}
        weeklyAcceptances={pulse?.week ?? []}
        situation={{
          dutyToday: teamData ? (duty ? { scheduleName: duty.scheduleName, startsAt: duty.startsAt, endsAt: duty.endsAt, paused: duty.paused, presence: duty.presence } : null) : undefined,
          newLeads,
          nextTask: extras.nextTask,
          whatsapp: extras.whatsapp,
        }}
        performance={performance}
        recognitions={extras.recognitions}
        managerProfile={{ temperature: profile.metrics.temperature, quotes: profile.metrics.quotes, sales: profile.metrics.sales, interactions: profile.metrics.interactions, tasks: profile.metrics.tasks, dutyDays: profile.dutyDays.map((day) => ({ date: new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(`${day.date}T12:00:00-03:00`)), scheduleName: day.scheduleName, startsAt: day.startsAt, endsAt: day.endsAt, state: day.state })) }}
        managementActions={<LiteBrokerProfileActions userId={profile.member.userId} name={profile.member.name} email={profile.member.email} phone={profile.member.brokerPhone ?? ""} active={profile.member.membershipStatus === "active" && profile.member.userStatus === "active"} canResetPassword={false} />}
        showSupervisorActions
        monthGoal={monthGoalRow ? { brokerId: profile.member.userId, period: monthGoalRow.period, goal: monthGoalRow.goal, canEdit: true } : undefined}
      />
    );
  }

  const { member, metrics, recentLeads, recentRedistributions, dutyDays } = profile;
  const isBroker = member.role === "broker";
  const supervisorNotes = isBroker && (context.role === "director" || context.role === "manager")
    ? await listBrokerNotes(member.userId).catch(() => [])
    : [];
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
          {isBroker && (context.role === "director" || context.role === "manager") ? (
            <Card>
              <CardHeader>
                <CardTitle>Feedbacks</CardTitle>
                <CardDescription>Histórico de feedbacks registrados pelo supervisor.</CardDescription>
              </CardHeader>
              <CardContent>
                <SupervisorNoteHistory notes={supervisorNotes} />
              </CardContent>
            </Card>
          ) : null}
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
