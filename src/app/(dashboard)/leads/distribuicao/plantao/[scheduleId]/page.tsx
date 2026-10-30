import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock3, Download, FileSpreadsheet } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { ArrowLeft, UserList, Users, WhatsappLogo } from "@/components/huge-icons";
import { readMetaLeadDisplayDetails } from "@/features/leads/meta-lead-display";
import { cn } from "@/lib/utils";
import { LeadStatusBadge, LeadTemperature } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDutyScheduleProfile } from "@/features/lead-distribution/duty-schedule-profile-queries";
import { getDutyOccurrenceHistory } from "@/features/lead-distribution/duty-occurrence-history";
import { firstValidShift, isSingleOccurrencePlantao } from "@/features/lead-distribution/monthly-duty-plan";
import { getDutyWindowOnDate, getRelevantDutyWindow, isDutyWindowActive, listCompletedDutyWindows, parseDutyLeadsSince, type DutyLeadsSinceOption } from "@/features/lead-distribution/duty-presence-domain";
import { getFeatureFlag, getSystemSetting, FEATURE_FLAGS } from "@/features/system-settings/queries";
import { getDutyCoverage, isHeldByRunningQualification } from "@/features/lead-distribution/domain";
import { isHotLeadEarlyDistributionEnabled } from "@/features/lead-distribution/qualification-hold";
import { leadDistributionStatusUi, QUALIFYING_LEAD_DISTRIBUTION_UI } from "@/features/lead-distribution/status-ui";
import { getReturnedUnacceptedLeadIds } from "@/features/lead-distribution/returned-unaccepted";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { hasCapability } from "@/shared/auth/permissions";
import { countBrokerLeadsByShift, groupDutyLeadsByShift, sortByAssignmentTime } from "@/features/lead-distribution/duty-leads-shift-groups";
import { sortByTemperaturePriority } from "@/features/lead-distribution/temperature-priority";
import { normalizeRoutingQualificationStatus } from "@/features/lead-distribution/routing-catalog";
import { DragScrollTable } from "@/components/ui/drag-scroll-table";
import { StatCard } from "@/components/dashboard/metric-card";
import { dataTableStyles } from "@/components/ui/data-table/data-table-frame";
import { SectionCardHeader } from "@/components/ui/section-card-header";
import { getCachedLeadsBranches, getCachedLeadsBrokers, getCachedSlaSettings } from "@/features/leads/reference-data";
import { DutyLeadDetailsTrigger } from "../_components/duty-lead-details-trigger";
import { BrokerDayHistoryTrigger } from "../_components/broker-day-history-trigger";
import { BrokerOccurrenceCard, type BrokerTurn } from "../_components/broker-occurrence-card";
import { getDutyTurnState } from "@/features/lead-distribution/duty-turn";
import { DutyTurnAutoRefresh } from "../_components/duty-turn-auto-refresh";
import { DutyTurnStrip } from "../_components/duty-turn-strip";
import { DutyTurnSortableGrid } from "../_components/duty-turn-sortable-grid";
import { BrokerPresenceInviteButton } from "../_components/broker-presence-invite-button";
import { BrokerPresenceReleaseButton } from "../_components/broker-presence-release-button";
import { BrokerPauseButton } from "../_components/broker-pause-button";
import { BrokerCapacityBar, BrokerLiveStatus } from "../_components/broker-live-status";
import { PendingRoster } from "../_components/pending-roster";
import { getDutySwapNotices } from "@/features/lead-distribution/duty-swap-queries";
import { swapNoticeText } from "@/features/lead-distribution/duty-swap";
import { ScheduleEscalarButton } from "../_components/schedule-escalar-button";
import { listInvitedBrokers, listPendingRosterEntries } from "@/features/lead-distribution/duty-roster-pending";
import type { LeadWorkspaceItem } from "@/features/leads/components/lead-workspace-types";
import { dutyShifts, worksInShift } from "@/features/lead-distribution/duty-shifts";
import { getDutyLeadQueueTabs, resolveDutyLeadQueueId, selectDutyLeadsForQueue } from "@/features/lead-distribution/duty-lead-queue-tabs";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
import { DirectorDutyLeads, type DutyLeadRecord } from "../_components/director-duty-leads";
import directorDutyStyles from "../_components/director-duty-schedule.module.css";
import { DirectorDutyHeaderActions } from "../_components/director-duty-header-actions";
import { DirectorDutyHistoryDistributions } from "../_components/director-duty-history-distributions";

export const dynamic = "force-dynamic";

const DAYS_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const timeOnly = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: "America/Sao_Paulo" });
const dayMonth = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
const historyDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "America/Sao_Paulo" });
function historyDateLabel(value: string) { return historyDate.format(new Date(`${value}T12:00:00-03:00`)); }

function DutyProfileHeader({
  name, state, stateTone, description, details, actions,
}: {
  actions?: React.ReactNode;
  name: string;
  state: string;
  stateTone: "success" | "info" | "secondary" | "outline";
  description: string;
  details: string[];
}) {
  return <section aria-label="Contexto do plantão" className="rounded-[var(--radius-card)] border border-border/70 bg-card p-4 sm:p-5">
    <div className="flex flex-wrap items-center gap-2">
      <h1 className="min-w-0 text-xl font-semibold tracking-tight sm:text-2xl">{name}</h1>
      <Badge variant={stateTone}>{state}</Badge>
      {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
    </div>
    <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
    <div className="mt-4 flex flex-wrap gap-2" aria-label="Informações do plantão">
      {details.map((detail) => <Badge key={detail} variant="outline">{detail}</Badge>)}
    </div>
  </section>;
}

const LEADS_SINCE_CHOICES: Array<{ value: DutyLeadsSinceOption; label: string }> = [
  { value: "plantao", label: "Janela do plantão" },
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem 19h" },
  { value: "sexta", label: "Sexta 19h" },
];

export default async function DutyScheduleProfilePage({ params, searchParams }: { params: Promise<{ scheduleId: string }>; searchParams: Promise<{ situacao?: string; data?: string; canal?: string; fila?: string; desde?: string }> }) {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") redirect("/access-denied");
  const { scheduleId } = await params;
  const directorLite = await isDirectorLitePageOnServer(context, `/leads/distribuicao/plantao/${scheduleId}`);
  const { situacao, data, canal, fila, desde } = await searchParams;
  const leadsSinceOption = parseDutyLeadsSince(desde);

  let profile: Awaited<ReturnType<typeof getDutyScheduleProfile>>;
  try {
    profile = await getDutyScheduleProfile(context, scheduleId, { leadsSince: leadsSinceOption });
  } catch {
    redirect("/leads/distribuicao?view=plantao");
  }

  const { schedule, roster, linkedQueues, leads: allLeads, leadsSince, leadsUntil, leadsUpcomingStartsAt, presenceEnabled, liveStatusEnabled, coldQueueWithoutWindow } = profile;
  // Invited brokers without an account yet: on the plantão as "Convite pendente".
  const [pendingRoster, invitedBrokers] = await Promise.all([
    listPendingRosterEntries(context.tenantId, schedule.id),
    listInvitedBrokers(context.tenantId, context.role === "manager" ? context.branchId ?? null : schedule.branchId ?? null),
  ]);
  const historyEnabled = (await getFeatureFlag(FEATURE_FLAGS.DUTY_OCCURRENCE_HISTORY)) === "true";
  // A plantão lasts one day: there is no "other occurrence" to browse.
  const singleDay = isSingleOccurrencePlantao(schedule);
  const singleDayDate = singleDay ? firstValidShift(schedule)?.start ?? null : null;
  const now = new Date();
  const completedWindows = historyEnabled ? listCompletedDutyWindows(schedule, now) : [];
  const liveWindow = getRelevantDutyWindow(schedule, now, 0);
  const liveOrUpcoming = schedule.status === "active" && (isDutyWindowActive(liveWindow, now) || Boolean(leadsUpcomingStartsAt));
  const requestedWindow = historyEnabled && data ? getDutyWindowOnDate(schedule, data) : null;
  const requestedCompleted = requestedWindow && requestedWindow.endsAt <= now && requestedWindow.startsAt >= schedule.validFrom && (!schedule.validUntil || requestedWindow.startsAt < schedule.validUntil)
    ? requestedWindow : null;
  const invalidHistoryDate = Boolean(historyEnabled && data && !requestedCompleted);
  const historicalWindow = requestedCompleted ?? (historyEnabled && !liveOrUpcoming ? completedWindows[0] ?? null : null);
  const occurrenceHistory = historicalWindow
    ? await getDutyOccurrenceHistory(context, schedule.id, linkedQueues.map((queue) => queue.id), historicalWindow)
    : null;
  if (historicalWindow && occurrenceHistory) {
    const canExportHistory = hasCapability(context.role, "exportar_relatorios_operacionais", context.jobTitle);
    return <>
      <DashboardHeader breadcrumb="Distribuição · Plantões" title={schedule.name} rightSlot={directorLite ? undefined : <Button render={<Link href="/distribuicao?view=plantao" />} size="sm" variant="outline"><ArrowLeft className="size-4" /> Voltar aos plantões</Button>} />
      <main className={cn(directorLite ? "flex min-h-full w-full flex-col bg-background" : "mx-auto flex w-full max-w-[1440px] flex-col gap-5 bg-background p-4 lg:p-6", directorLite && directorDutyStyles.page)}>
        {directorLite ? <DirectorDutyHeaderActions scheduleId={schedule.id} canExport={canExportHistory} reportDate={historicalWindow.dutyDate} /> : null}
        <DutyProfileHeader
          name={schedule.name}
          state="Terminado"
          stateTone="secondary"
          description="Este turno foi encerrado. Consulte a distribuição, as ofertas e os corretores escalados sem alterar o plantão."
          actions={canExportHistory ? <Button render={<a href={`/api/reports/duty-schedule/${schedule.id}?data=${historicalWindow.dutyDate}`} download />} size="sm" variant="outline" className="gap-1.5"><Download className="size-3.5" aria-hidden="true" /> Gerar relatório</Button> : null}
          details={[
            historyDateLabel(historicalWindow.dutyDate),
            `${timeOnly.format(historicalWindow.startsAt)}–${timeOnly.format(historicalWindow.endsAt)}`,
            schedule.branchName ?? "Todas as unidades",
            schedule.queueName,
          ]}
        />
        {invalidHistoryDate ? <p role="alert" className="rounded-[var(--radius-card)] border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-foreground">A data informada não corresponde a um plantão encerrado desta regra. Exibindo o último turno terminado.</p> : null}
        <section aria-label="Resumo da ocorrência encerrada" className="grid gap-2 sm:grid-cols-3">
          <StatCard label="Leads atribuídos" value={occurrenceHistory.distributions.length} sublabel="Aceites e atribuições registradas" />
          <StatCard label="Ofertas enviadas" value={occurrenceHistory.offers.total} sublabel={`${occurrenceHistory.offers.accepted} aceitas · ${occurrenceHistory.offers.declined} recusadas · ${occurrenceHistory.offers.expired} expiradas`} />
          <StatCard label="Presenças confirmadas" value={`${occurrenceHistory.confirmations.confirmed}/${occurrenceHistory.confirmations.total}`} sublabel={occurrenceHistory.confirmations.total ? "Confirmações registradas na data" : "Sem confirmações registradas"} />
        </section>
        {singleDay ? null : <Card className="border-border/70 shadow-none">
          <SectionCardHeader title="Histórico de ocorrências" badge={<Badge variant="secondary">{completedWindows.length} recentes</Badge>} description="Selecione outro turno encerrado desta regra semanal." />
          <CardContent className="flex flex-wrap items-end gap-2 pt-4">
            {completedWindows.map((window) => <Button key={window.dutyDate} size="sm" variant={window.dutyDate === historicalWindow.dutyDate ? "secondary" : "outline"} render={<Link href={`/leads/distribuicao/plantao/${schedule.id}?data=${window.dutyDate}`} />}>{historyDateLabel(window.dutyDate)}</Button>)}
            <form method="get" className="flex items-end gap-2">
              <label htmlFor="history-date" className="text-xs text-muted-foreground">Outra data<Input id="history-date" type="date" name="data" defaultValue={historicalWindow.dutyDate} className="mt-1" /></label>
              <Button type="submit" size="sm" variant="outline">Consultar</Button>
            </form>
          </CardContent>
        </Card>}
        <Card className="border-border/70 shadow-none">
          <SectionCardHeader
            icon={<UserList />}
            title="Leads distribuídos"
            badge={<Badge variant="secondary">{occurrenceHistory.distributions.length}</Badge>}
            description="Aceites e atribuições registrados neste turno. O vínculo antigo pode ser estimado quando a fila era compartilhada."
          />
          <CardContent className="p-0">
          {occurrenceHistory.distributions.length ? (directorLite ? <DirectorDutyHistoryDistributions rows={occurrenceHistory.distributions.map((entry) => ({ id: entry.id, leadName: entry.leadName, brokerName: entry.brokerName, assignedAt: entry.assignedAt.toISOString(), kind: entry.kind, exact: entry.exact }))} /> : <DragScrollTable><Table className={dataTableStyles.native}><TableHeader><TableRow><TableHead>Lead</TableHead><TableHead>Corretor na época</TableHead><TableHead>Distribuído em</TableHead><TableHead>Origem</TableHead><TableHead>Vínculo</TableHead></TableRow></TableHeader><TableBody>{occurrenceHistory.distributions.map((entry) => <TableRow key={entry.id}><TableCell className="font-medium">{entry.leadName}</TableCell><TableCell>{entry.brokerName}</TableCell><TableCell>{dateTime.format(entry.assignedAt)}</TableCell><TableCell><Badge variant="outline">{entry.kind}</Badge></TableCell><TableCell><Badge variant={entry.exact ? "success" : "outline"}>{entry.exact ? "Confirmado" : "Estimado pela fila"}</Badge></TableCell></TableRow>)}</TableBody></Table></DragScrollTable>) : <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma atribuição registrada neste período.</p>}
          {occurrenceHistory.truncated ? <p className="border-t border-border/70 p-3 text-xs text-muted-foreground">Exibindo os primeiros 200 registros deste período.</p> : null}
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-none">
          <SectionCardHeader
            icon={<Users />}
            title="Corretores escalados"
            badge={<Badge variant="secondary">{occurrenceHistory.roster.length}</Badge>}
            description="Leads recebidos por corretor neste turno. Vínculos válidos nesta data; alterações posteriores podem limitar a reconstituição de turnos antigos."
          />
          <CardContent className="pt-4">{occurrenceHistory.brokers.length ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{occurrenceHistory.brokers.map((entry) => (
            <div key={entry.brokerId} className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border/70 px-3 py-2">
              <div className="min-w-0">
                <BrokerDayHistoryTrigger scheduleId={schedule.id} brokerId={entry.brokerId} brokerName={entry.brokerName} dutyDate={historicalWindow.dutyDate} />
                <p className="truncate text-xs text-muted-foreground">{entry.branchName ?? "Sem unidade"}{entry.onRoster ? "" : " · fora da escala (recebeu lead)"}</p>
              </div>
              <Badge variant={entry.leads ? "info" : "outline"} className="shrink-0 tabular-nums" title="Leads recebidos neste turno">{entry.leads} {entry.leads === 1 ? "lead" : "leads"}</Badge>
            </div>
          ))}</div> : <p className="text-sm text-muted-foreground">Nenhum vínculo de escala encontrado para esta data.</p>}</CardContent>
        </Card>
      </main>
    </>;
  }
  const confirmedCount = roster.filter((entry) => entry.presenceStatus === "confirmed").length;
  // A plantão split in shifts shows its roster by shift (whole-day brokers in both).
  const shiftSections = dutyShifts(schedule)?.filter((shift) => shift.key !== "dia").map((shift) => ({
    key: shift.key,
    label: shift.label,
    entries: roster.filter((entry) => worksInShift(entry.shift, shift.key as "manha" | "tarde")),
  })) ?? null;
  const readyNowCount = roster.filter((entry) => entry.liveStatus === "ready").length;
  const coverage = getDutyCoverage(roster.length, schedule.minimumBrokers);
  const [swapNotices, branches, brokers, slaSettings, managementActionsSetting, assignmentChoiceSetting] = await Promise.all([
    // "Troca feita" on the slots of the published escala (never breaks the page).
    getDutySwapNotices(context.tenantId, roster.map((entry) => ({ id: entry.id, brokerId: entry.brokerId }))),
    getCachedLeadsBranches(context.tenantId),
    getCachedLeadsBrokers(context.tenantId, context.role, context.branchId ?? null),
    getCachedSlaSettings(context.tenantId),
    getSystemSetting("feature_lead_management_actions_enabled"),
    getSystemSetting("feature_manual_lead_assignment_offer_choice_enabled"),
  ]);
  const drawerContextRole = managementActionsSetting !== "false" ? context.role : "broker";
  // Rotation (29/10): who is receiving now, who is next and who received last, on the broker cards.
  // Only this plantão's saved turn and today's offers; on any failure the cards show without it.
  const turnState = schedule.status === "active" && liveWindow && isDutyWindowActive(liveWindow, now)
    ? await getDutyTurnState({
      tenantId: context.tenantId,
      scheduleId: schedule.id,
      dutyDate: liveWindow.dutyDate,
      roster: roster.filter((entry) => !entry.absent).map((entry) => ({ brokerId: entry.brokerId, confirmedAt: entry.confirmedAt ? entry.photoTakenAt ?? entry.confirmedAt : null, canReceive: entry.liveStatus === "ready" && !entry.pausedAt })),
      now,
    })
    : null;
  // The day "Escalar corretor" opens (29/10): the running turn, else this plantão's next one (a
  // dated plantão days ahead, or the weekly one in the coming week). Never today by default.
  const escalarDate = liveWindow && isDutyWindowActive(liveWindow, now) ? liveWindow.dutyDate
    : leadsUpcomingStartsAt ? dayKey.format(leadsUpcomingStartsAt)
      : Array.from({ length: 8 }, (_, offset) => dayKey.format(new Date(now.getTime() + offset * 86_400_000)))
        .find((date) => { const turn = getDutyWindowOnDate(schedule, date); return Boolean(turn && turn.endsAt > now); }) ?? null;
  const turnOf = (brokerId: string): BrokerTurn | null => turnState?.byBroker[brokerId] ?? null;
  // Cards in the order of the turn: receiving now, then the queue (next first), then who cannot receive now.
  const byTurn = <T extends { brokerId: string }>(entries: T[]) => turnState ? [...entries].sort((left, right) => (turnState.rank[left.brokerId] ?? 999) - (turnState.rank[right.brokerId] ?? 999)) : entries;
  const returnedUnaccepted = await getReturnedUnacceptedLeadIds(context.tenantId, allLeads.map((lead) => lead.id));
  const canExportReport = hasCapability(context.role, "exportar_relatorios_operacionais", context.jobTitle);

  // Leads that came in through WhatsApp (coex number / click-to-WhatsApp ads)
  // vs. the Meta form: a tab for each, the same mark as in /leads.
  const whatsappEntryOf = (lead: (typeof allLeads)[number]) => {
    const details = readMetaLeadDisplayDetails(lead.sourceChannel, lead.sourceMetadata);
    return details.entry === "whatsapp" ? { label: details.adsLabel } : null;
  };
  // This occurrence's own hours: its queues may also feed another plantão the
  // same day (PRESENCIAL 09:00–13:30 and PRESENCIAL TARDE 13:30–19:00), and a
  // lead handed out in the other one is not this plantão's.
  const occurrence = getDutyWindowOnDate(schedule, dayKey.format(leadsUpcomingStartsAt ?? leadsUntil ?? now));
  const isAssigned = (lead: (typeof allLeads)[number]) => Boolean(lead.corretorId) && lead.distributionStatus === "assigned";
  // An explicit dutyScheduleId is the persisted source of truth for which
  // occurrence received the lead. Legacy inferred attribution still has to
  // fall inside this occurrence's actual hours.
  const assignedInOccurrence = (lead: (typeof allLeads)[number]) => lead.dutyScheduleId === schedule.id
    || !occurrence
    || !lead.assignedAt
    || (lead.assignedAt >= occurrence.startsAt && lead.assignedAt < occurrence.endsAt);
  const isDistributed = (lead: (typeof allLeads)[number]) => isAssigned(lead) && assignedInOccurrence(lead);
  // Desqualificados ficam retidos fora da distribuição automática, inclusive
  // quando ainda estão sem corretor. Eles não devem aparecer nesta fila.
  const isDisqualified = (lead: (typeof allLeads)[number]) => normalizeRoutingQualificationStatus(lead.qualificationStatus) === "disqualified";
  // Not waiting for a broker either: Meta blocked the first message, or the
  // AI is still qualifying (the distribution holds those until it ends).
  const isMetaBlocked = (lead: (typeof allLeads)[number]) => lead.qualificationStatus === "meta_blocked";
  // A hot lead (alta aptidão) is handed out while the AI still talks (DEC-153): listed as waiting,
  // so the temperature order puts it on top.
  const earlyHot = await isHotLeadEarlyDistributionEnabled();
  const isQualifying = (lead: (typeof allLeads)[number]) => isHeldByRunningQualification(lead.qualificationStatus, lead.qualificationState, earlyHot);
  const isWaiting = (lead: (typeof allLeads)[number]) => !isAssigned(lead) && !isDisqualified(lead) && !isMetaBlocked(lead) && !isQualifying(lead);
  // Still being qualified by the AI: listed with a notice so it does not vanish (26/10), after the
  // ones that can be handed out. The distribution itself still holds it (service.ts).
  const isQualifyingUnassigned = (lead: (typeof allLeads)[number]) => !isAssigned(lead) && !isDisqualified(lead) && !isMetaBlocked(lead) && isQualifying(lead);
  const isListedWaiting = (lead: (typeof allLeads)[number]) => isWaiting(lead) || isQualifyingUnassigned(lead);
  const distributionUiOf = (lead: (typeof allLeads)[number]) => isQualifyingUnassigned(lead) ? QUALIFYING_LEAD_DISTRIBUTION_UI : leadDistributionStatusUi(lead.distributionStatus);
  const allWaitingLeads = allLeads.filter(isListedWaiting);
  const queueTabs = getDutyLeadQueueTabs(
    [...linkedQueues].sort((first, second) => first.name.localeCompare(second.name, "pt-BR")),
    allWaitingLeads,
  );
  const selectedQueueId = resolveDutyLeadQueueId(queueTabs, fila);
  // Distributed leads remain one combined list; only the waiting list is
  // narrowed to a queue when this plantão receives multiple queues.
  const filter = situacao === "distribuidos" ? "distribuidos" : "aguardando";
  const queueScopedLeads = selectDutyLeadsForQueue(allLeads, selectedQueueId, filter === "distribuidos");
  // The channel tabs count the situation on screen, so a lead handed out
  // leaves "Aguardando · WhatsApp" and joins "Distribuídos · WhatsApp".
  const inSituation = queueScopedLeads.filter(filter === "distribuidos" ? isDistributed : isListedWaiting);
  const whatsappInSituation = inSituation.filter((lead) => whatsappEntryOf(lead)).length;
  const channel = canal === "whatsapp" ? "whatsapp" : canal === "formulario" ? "formulario" : "todos";
  const channelLeads = channel === "todos" ? allLeads : allLeads.filter((lead) => (channel === "whatsapp") === Boolean(whatsappEntryOf(lead)));
  const leads = selectDutyLeadsForQueue(channelLeads, selectedQueueId, filter === "distribuidos");
  const channelTabs = [
    { key: "todos", label: "Todos", count: inSituation.length },
    { key: "formulario", label: "Formulário", count: inSituation.length - whatsappInSituation },
    { key: "whatsapp", label: "WhatsApp", count: whatsappInSituation },
  ] as const;
  // The plantão's leads: waiting for a broker plus handed out in this occurrence
  // (not disqualified/blocked/qualifying ones, nor the other plantão's).
  const plantaoLeads = allLeads.filter((lead) => isListedWaiting(lead) || isDistributed(lead));
  const whatsappLeadCount = plantaoLeads.filter((lead) => whatsappEntryOf(lead)).length;
  const leadsHref = (next: { situacao?: string; canal?: string; fila?: string; desde?: string }) => {
    const query = new URLSearchParams();
    const nextSituacao = next.situacao ?? situacao;
    const nextCanal = next.canal ?? channel;
    if (nextSituacao) query.set("situacao", nextSituacao);
    if (nextCanal !== "todos") query.set("canal", nextCanal);
    const nextQueueId = next.fila ?? selectedQueueId;
    if (nextQueueId) query.set("fila", nextQueueId);
    const nextDesde = next.desde ?? leadsSinceOption;
    if (nextDesde !== "plantao") query.set("desde", nextDesde);
    const search = query.toString();
    return `/leads/distribuicao/plantao/${schedule.id}${search ? `?${search}` : ""}`;
  };

  const distributedCount = channelLeads.filter(isDistributed).length;
  const waitingLeads = leads.filter(isListedWaiting);
  const waitingCount = selectDutyLeadsForQueue(channelLeads.filter(isListedWaiting), selectedQueueId, false).length;
  // Distributed rows read as the order leads were handed out (earliest
  // assignment first); the waiting list reads as the distribution order:
  // hot, then warm (or no temperature), then cold, oldest first in each.
  const visibleLeads = filter === "distribuidos"
    ? sortByAssignmentTime(leads.filter(isDistributed))
    : (() => {
      const ordered = sortByTemperaturePriority([...waitingLeads].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()));
      return [...ordered.filter((lead) => !isQualifyingUnassigned(lead)), ...ordered.filter(isQualifyingUnassigned)];
    })();
  // Leads each broker received in this occurrence (not in the other plantão of the same queues).
  const shiftCountsByBroker = countBrokerLeadsByShift(allLeads.filter(isDistributed), schedule.shiftSplitAt);
  const brokerShiftCounts = (brokerId: string) => shiftCountsByBroker.get(brokerId) ?? { manha: 0, tarde: 0 };
  // Morning/afternoon only for a plantão that crosses the cut (13:30 or its own split).
  const cut = schedule.shiftSplitAt?.slice(0, 5) ?? "13:30";
  const crossesCut = schedule.startsAt.slice(0, 5) < cut && schedule.endsAt.slice(0, 5) > cut;
  const leadGroups = filter === "distribuidos"
    ? crossesCut
      ? groupDutyLeadsByShift(visibleLeads, schedule.shiftSplitAt, { keepEmpty: true })
      : [{ key: "ordem", label: `Ordem de entrega · ${schedule.startsAt.slice(0, 5)}–${schedule.endsAt.slice(0, 5)}`, leads: visibleLeads }]
    : [{ key: "ordem", label: "Ordem de distribuição · quentes, mornos e frios", leads: visibleLeads }];
  const directorLeadGroups: Array<{ key: string; label: string; leads: DutyLeadRecord[] }> = leadGroups.map((group) => ({
    key: group.key,
    label: group.label,
    leads: group.leads.map((lead) => {
      const distribution = distributionUiOf(lead);
      const whatsappEntry = whatsappEntryOf(lead);
      const drawerLead: LeadWorkspaceItem = {
        id: lead.id,
        nome: lead.nome,
        telefone: lead.telefone,
        status: lead.status,
        qualificationStatus: lead.qualificationStatus ?? "",
        qualificationState: lead.qualificationState,
        distributionStatus: lead.distributionStatus,
        origem: lead.origem,
        email: lead.email,
        sourceChannel: lead.sourceChannel,
        sourceCampaign: lead.sourceCampaign,
        sourceMetadata: lead.sourceMetadata,
        tipo: lead.tipo,
        createdAt: lead.createdAt.toISOString(),
        assignedAt: lead.assignedAt?.toISOString() ?? null,
        stageEnteredAt: lead.stageEnteredAt?.toISOString() ?? null,
        serviceStartedAt: lead.serviceStartedAt?.toISOString() ?? null,
        firstContactAt: lead.firstContactAt?.toISOString() ?? null,
        corretorId: lead.corretorId,
        corretorNome: lead.brokerName,
        branchId: lead.branchId,
        branchName: lead.branchName,
        qualificationDetails: lead.qualificationDetails as Record<string, unknown> | null,
        queueId: lead.queueId,
        queueName: lead.queueName,
        queueColorHue: lead.queueColorHue,
        distributionRemovalReason: lead.distributionRemovalReason,
        distributionRemovalNote: lead.distributionRemovalNote,
      };
      return {
        lead: drawerLead,
        groupKey: group.key,
        groupLabel: group.label,
        createdAt: lead.createdAt.toISOString(),
        assignedAt: lead.assignedAt?.toISOString() ?? null,
        brokerName: lead.brokerName,
        queueName: lead.queueName,
        distributionLabel: distribution.label,
        distributionTone: distribution.tone,
        whatsappLabel: whatsappEntry?.label ?? null,
        returnedUnaccepted: returnedUnaccepted.has(lead.id),
        coldHeld: lead.qualificationStatus === "cold" && !lead.corretorId && Boolean(linkedQueues.find((queue) => queue.id === lead.queueId)?.holdColdLeads),
      };
    }),
  }));
  const filters = [
    { key: "aguardando", label: "Aguardando distribuição", count: waitingCount },
    { key: "distribuidos", label: "Distribuídos", count: distributedCount },
  ] as const;
  const totalWaitingCount = allWaitingLeads.length;
  const sinceLabel = coldQueueWithoutWindow
    ? "sem janela de horário (fila de leads frios: aparecem todos os que aguardam)"
    : leadsSinceOption !== "plantao"
    ? `desde ${dateTime.format(leadsSince)} (escolhido acima)`
    : leadsSince.getTime() === 0
    ? "desde a criação deste plantão"
    : leadsUpcomingStartsAt
      ? `aguardando o início ${dayKey.format(leadsUpcomingStartsAt) === dayKey.format(now) ? "de hoje" : `em ${dayMonth.format(leadsUpcomingStartsAt)}`} às ${timeOnly.format(leadsUpcomingStartsAt)}`
      : leadsUntil
      ? `nesta ocorrência (${dateTime.format(leadsSince)} – ${dateTime.format(leadsUntil)})`
      : `desde o início desta ocorrência (${dateTime.format(leadsSince)})`;

  return <>
    <DashboardHeader
      breadcrumb="Distribuição · Plantões"
      title={schedule.name}
      rightSlot={directorLite ? undefined : <div className="flex flex-wrap items-center gap-2">
        {canExportReport ? (
          <Button render={<a href={`/api/reports/duty-schedule/${schedule.id}`} download />} size="sm" variant="outline" className="gap-1.5">
            <Download className="size-3.5" aria-hidden="true" /> Exportar PDF
          </Button>
        ) : null}
        {canExportReport ? (
          <Button render={<a href={`/api/reports/duty-schedule/${schedule.id}?format=xlsx`} download />} size="sm" variant="outline" className="gap-1.5">
            <FileSpreadsheet className="size-3.5" aria-hidden="true" /> Exportar planilha
          </Button>
        ) : null}
        <Button render={<Link href="/distribuicao?view=plantao" />} size="sm" variant="outline"><ArrowLeft className="size-4" /> Voltar aos plantões</Button>
      </div>}
    />
    <main className={cn(directorLite ? "flex min-h-full w-full flex-col bg-background" : "mx-auto flex min-h-full w-full max-w-[1440px] flex-col gap-5 bg-background p-4 lg:p-6", directorLite && directorDutyStyles.page)}>
      {directorLite ? <DirectorDutyHeaderActions scheduleId={schedule.id} canExport={canExportReport} /> : null}
      <DutyProfileHeader
        name={schedule.name}
        state={isDutyWindowActive(liveWindow, now) ? "Em andamento" : leadsUpcomingStartsAt ? "Próximo turno" : schedule.status === "active" ? "Regra ativa" : schedule.status === "archived" ? "Arquivado" : "Inativo"}
        stateTone={isDutyWindowActive(liveWindow, now) ? "success" : leadsUpcomingStartsAt ? "info" : schedule.status === "active" ? "success" : "secondary"}
        description={leadsUpcomingStartsAt ? `O próximo turno começa em ${dateTime.format(leadsUpcomingStartsAt)}. Acompanhe a escala e os leads vinculados.` : "Acompanhe a cobertura da escala, os leads e a disponibilidade dos corretores deste plantão."}
        details={[
          `${DAYS_FULL[schedule.dayOfWeek]}${singleDayDate ? `, ${dayMonth.format(singleDayDate)}` : ""} · ${schedule.startsAt.slice(0, 5)}–${schedule.endsAt.slice(0, 5)}`,
          schedule.branchName ?? "Todas as unidades",
          schedule.queueName,
          schedule.timezone,
        ]}
      />
      {invalidHistoryDate ? <p role="alert" className="rounded-[var(--radius-card)] border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-foreground">A data informada não corresponde a um plantão encerrado desta regra.</p> : null}
      {historyEnabled && !singleDay && completedWindows.length ? <Card className="border-border/70 shadow-none">
        <SectionCardHeader title="Histórico de ocorrências" badge={<Badge variant="secondary">{completedWindows.length} recentes</Badge>} description="Consulte os turnos encerrados; a regra semanal continua válida." />
        <CardContent className="flex flex-wrap items-end gap-2 pt-4">
          {completedWindows.map((window) => <Button key={window.dutyDate} size="sm" variant="outline" render={<Link href={`/leads/distribuicao/plantao/${schedule.id}?data=${window.dutyDate}`} />}>{historyDateLabel(window.dutyDate)}</Button>)}
          <form method="get" className="flex items-end gap-2"><label htmlFor="history-date" className="text-xs text-muted-foreground">Outra data<Input id="history-date" type="date" name="data" className="mt-1" /></label><Button type="submit" size="sm" variant="outline">Consultar</Button></form>
        </CardContent>
      </Card> : null}

      <section aria-label="Resumo do plantão" className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        <StatCard
          label="Cobertura"
          value={`${coverage.assigned}/${coverage.minimum}`}
          sublabel={coverage.covered ? "Escala completa" : `Faltam ${coverage.missing} corretor(es)`}
          valueClassName={coverage.covered ? undefined : "text-warning"}
        />
        <StatCard
          label="Filas vinculadas"
          value={linkedQueues.length}
          sublabel={linkedQueues.length ? linkedQueues.map((queue) => queue.name).join(", ") : "Nenhuma fila vinculada"}
        />
        <StatCard label="Leads no plantão" value={plantaoLeads.length} sublabel={channel === "todos" ? `${distributedCount} distribuídos · ${totalWaitingCount} aguardando` : `${whatsappLeadCount} pelo WhatsApp · ${plantaoLeads.length - whatsappLeadCount} por formulário`} />
      </section>

      <div className="flex flex-col gap-5">
        <Card className="border-border/70 shadow-none">
          <SectionCardHeader
            icon={<UserList />}
            title="Leads do plantão"
            badge={<Badge variant="secondary">{waitingCount + distributedCount}</Badge>}
            description={`Leads das filas vinculadas ${sinceLabel}.`}
            actions={<div className="flex flex-col items-end gap-2">
            {coldQueueWithoutWindow ? null : <nav aria-label="Considerar leads sem distribuição a partir de" className="flex flex-wrap items-center justify-end gap-2">
              <span className="text-xs text-muted-foreground" title="Muda só o que você vê aqui e o que atribui à mão. A distribuição automática segue a janela do plantão.">Considerar leads a partir de (só para ver e atribuir à mão)</span>
              {LEADS_SINCE_CHOICES.map((choice) => (
                <Button
                  key={choice.value}
                  render={<Link href={leadsHref({ desde: choice.value })} />}
                  size="sm"
                  variant={leadsSinceOption === choice.value ? "secondary" : "ghost"}
                  aria-current={leadsSinceOption === choice.value ? "true" : undefined}
                >
                  {choice.label}
                </Button>
              ))}
            </nav>}
            <nav aria-label="Filtrar leads por situação" className="flex flex-wrap gap-2">
              {filters.map((item) => (
                <Button
                  key={item.key}
                  render={<Link href={leadsHref({ situacao: item.key })} />}
                  size="sm"
                  variant={filter === item.key ? "secondary" : "outline"}
                >
                  {item.label} <Badge variant="outline">{item.count}</Badge>
                </Button>
              ))}
            </nav>
            </div>}
          />
          <CardContent className="p-0">
            {filter === "aguardando" && queueTabs.length > 1 ? (
              <nav aria-label="Filtrar leads aguardando distribuição por fila" className="flex w-full items-center gap-1 overflow-x-auto border-b border-border px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {queueTabs.map((tab) => (
                  <Link
                    key={tab.id}
                    href={leadsHref({ fila: tab.id })}
                    aria-current={selectedQueueId === tab.id ? "page" : undefined}
                    className={cn(
                      "relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2 pb-2.5 pt-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                      selectedQueueId === tab.id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tab.name}
                    <span className="font-mono text-xs text-muted-foreground">{tab.count}</span>
                    {selectedQueueId === tab.id ? <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-primary" aria-hidden="true" /> : null}
                  </Link>
                ))}
              </nav>
            ) : null}
            <nav aria-label="Filtrar leads por canal de entrada" className="flex w-full items-center gap-1 overflow-x-auto border-b border-border px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {channelTabs.map((tab) => (
                <Link
                  key={tab.key}
                  href={leadsHref({ canal: tab.key })}
                  aria-current={channel === tab.key ? "page" : undefined}
                  className={cn(
                    "relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2 pb-2.5 pt-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    channel === tab.key ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.key === "whatsapp" ? <WhatsappLogo className="size-3.5" weight="fill" /> : null}
                  {tab.label}
                  <span className="font-mono text-xs text-muted-foreground">{tab.count}</span>
                  {channel === tab.key ? <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-primary" aria-hidden="true" /> : null}
                </Link>
              ))}
            </nav>
            {visibleLeads.length ? (
              directorLite ? (
                <DirectorDutyLeads
                  groups={directorLeadGroups}
                  brokers={brokers}
                  branches={branches}
                  contextRole={drawerContextRole}
                  contextJobTitle={context.jobTitle}
                  contextBranchId={context.branchId}
                  manualAssignmentChoiceEnabled={assignmentChoiceSetting !== "false"}
                  slaFirstContactMinutes={Number.parseInt(slaSettings.slaFirstContactMinutes ?? "15", 10) || 15}
                  slaStagnantDays={Number.parseInt(slaSettings.slaStagnantDays ?? "3", 10) || 3}
                  empty="Nenhum lead nesta ordem."
                />
              ) : (
              <DragScrollTable className="[&_[data-slot=table-container]]:max-h-[60vh] [&_[data-slot=table-container]]:overflow-y-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
                <Table className={dataTableStyles.native}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead>Temperatura</TableHead>
                      <TableHead>Fila</TableHead>
                      <TableHead>Corretor</TableHead>
                      <TableHead>Distribuição</TableHead>
                      <TableHead>Etapa</TableHead>
                      <TableHead>Recebido em</TableHead>
                      <TableHead>Distribuído em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leadGroups.map((group) => (
                      <Fragment key={group.key}>
                        <TableRow className="bg-[var(--surface-secondary)] hover:bg-[var(--surface-secondary)]">
                          <TableCell colSpan={8} className="py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            <span className="flex items-center justify-between gap-2">
                              {group.label}
                              <span className="font-mono">{group.leads.length}</span>
                            </span>
                          </TableCell>
                        </TableRow>
                        {group.leads.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="py-3 text-center text-xs text-muted-foreground">Nenhum lead distribuído neste turno.</TableCell>
                          </TableRow>
                        ) : null}
                        {group.leads.map((lead) => {
                          const distribution = distributionUiOf(lead);
                          const whatsappEntry = whatsappEntryOf(lead);
                          const drawerLead: LeadWorkspaceItem = {
                            id: lead.id,
                            nome: lead.nome,
                            telefone: lead.telefone,
                            status: lead.status,
                            qualificationStatus: lead.qualificationStatus ?? "",
                            qualificationState: lead.qualificationState,
                            distributionStatus: lead.distributionStatus,
                            origem: lead.origem,
                            email: lead.email,
                            sourceChannel: lead.sourceChannel,
                            sourceCampaign: lead.sourceCampaign,
                            sourceMetadata: lead.sourceMetadata,
                            tipo: lead.tipo,
                            createdAt: lead.createdAt.toISOString(),
                            assignedAt: lead.assignedAt?.toISOString() ?? null,
                            stageEnteredAt: lead.stageEnteredAt?.toISOString() ?? null,
                            serviceStartedAt: lead.serviceStartedAt?.toISOString() ?? null,
                            firstContactAt: lead.firstContactAt?.toISOString() ?? null,
                            corretorId: lead.corretorId,
                            corretorNome: lead.brokerName,
                            branchId: lead.branchId,
                            branchName: lead.branchName,
                            qualificationDetails: lead.qualificationDetails as Record<string, unknown> | null,
                            queueId: lead.queueId,
                            queueName: lead.queueName,
                            queueColorHue: lead.queueColorHue,
                            distributionRemovalReason: lead.distributionRemovalReason,
                            distributionRemovalNote: lead.distributionRemovalNote,
                          };
                          return (
                            <TableRow key={lead.id} className={returnedUnaccepted.has(lead.id) ? "bg-warning/10 hover:bg-warning/15" : "group/lead-row"}>
                              <TableCell className="font-medium"><div className="flex min-w-0 items-center gap-1.5"><DutyLeadDetailsTrigger lead={drawerLead} contextRole={drawerContextRole} contextJobTitle={context.jobTitle} contextBranchId={context.branchId} brokers={brokers} branches={branches} manualAssignmentChoiceEnabled={assignmentChoiceSetting !== "false"} slaFirstContactMinutes={Number.parseInt(slaSettings.slaFirstContactMinutes ?? "15", 10) || 15} slaStagnantDays={Number.parseInt(slaSettings.slaStagnantDays ?? "3", 10) || 3} />{whatsappEntry ? (
                                <span
                                  title={whatsappEntry.label ? `Entrou pelo WhatsApp · ${whatsappEntry.label}` : "Entrou pelo WhatsApp"}
                                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-1.5 py-px text-[10px] font-medium text-muted-foreground"
                                >
                                  <WhatsappLogo className="size-2.5" weight="fill" />
                                  WhatsApp
                                </span>
                              ) : null}</div></TableCell>
                              <TableCell>
                                <LeadTemperature status={lead.qualificationStatus} />
                                {lead.qualificationStatus === "cold" && !lead.corretorId && linkedQueues.find((queue) => queue.id === lead.queueId)?.holdColdLeads
                                  ? <span className="mt-1 block text-xs font-medium text-warning">Frio, retido pela fila</span>
                                  : null}
                              </TableCell>
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
              )
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhum lead {channel === "whatsapp" ? "do WhatsApp " : channel === "formulario" ? "de formulário " : ""}nesta situação para este plantão {sinceLabel}.</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-none">
          <SectionCardHeader
            icon={<Users />}
            title={presenceEnabled ? "Confirmação da escala" : "Corretores escalados"}
            badge={<Badge variant={presenceEnabled && confirmedCount === roster.length && roster.length ? "success" : "secondary"}>{presenceEnabled && roster.length ? `${confirmedCount}/${roster.length} confirmados` : `${roster.length} escalados`}</Badge>}
            description={liveStatusEnabled && roster.length
              ? `${readyNowCount} de ${roster.length} prontos para receber o próximo lead agora.`
              : presenceEnabled ? "Acompanhe quem confirmou presença neste turno." : "Quem está na escala ativa deste plantão agora."}
          />
          <CardContent className="space-y-3" role={presenceEnabled ? "group" : undefined} aria-label={presenceEnabled ? "Status de confirmação dos corretores escalados" : undefined}>
            {turnState ? <DutyTurnAutoRefresh /> : null}
            {turnState ? (() => {
              const nameOf = (brokerId: string | null | undefined) => roster.find((entry) => entry.brokerId === brokerId)?.brokerName ?? "Corretor";
              return <DutyTurnStrip
                scheduleName={schedule.name}
                previous={turnState.previous ? { id: turnState.previous.brokerId, name: nameOf(turnState.previous.brokerId), offeredAt: turnState.previous.offeredAt, outcome: turnState.previous.outcome } : null}
                current={turnState.current ? { id: turnState.current.brokerId, name: nameOf(turnState.current.brokerId), offeredAt: turnState.current.offeredAt } : null}
                nextId={turnState.nextBrokerId}
                nextName={turnState.nextBrokerId ? nameOf(turnState.nextBrokerId) : null}
              />;
            })() : null}
            {turnState ? <p className="text-xs text-muted-foreground">Rodízio: cada um tem sua vez, na ordem em que chegou. Quem recebe vai para o fim; lead expirado ou recusado gasta a vez e conta como pulo.{context.role === "director" ? " Para passar alguém na frente, arraste o card pelo ícone de arrastar até a posição desejada." : ""}</p> : null}
            {/* Escalar alguém neste plantão sem sair da página (mesma regra da Escala publicada). */}
            {context.role === "director" && escalarDate ? (
              <ScheduleEscalarButton
                scheduleId={schedule.id}
                scheduleName={schedule.name}
                date={escalarDate}
                brokers={brokers.map((broker) => ({ id: broker.id, name: broker.name, internalCode: null, branchId: broker.branchId ?? null }))}
              />
            ) : null}
            {roster.length && roster.every((entry) => entry.blockedReason) ? (
              <div role="alert" className="rounded-[var(--radius-card)] border border-warning/30 bg-warning/10 px-3 py-2.5 text-xs text-foreground">
                <strong className="font-semibold">Nenhum escalado está elegível para receber leads.</strong> Há pendências de cadastro ou confirmação — os leads permanecem aguardando.
              </div>
            ) : null}
            {roster.length ? (shiftSections ?? [{ key: "todos", label: null as string | null, entries: roster }]).map((section) => (
              <section key={section.key} aria-label={section.label ?? "Escalados"} className="space-y-2">
                {section.label ? (
                  <h3 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    {section.label}
                    <Badge variant="outline">{section.entries.length}</Badge>
                  </h3>
                ) : null}
                {section.entries.length ? ([
                  { key: "active", label: "Ativos", entries: byTurn(section.entries.filter((entry) => !entry.absent)) },
                  { key: "absent", label: "Faltaram", entries: section.entries.filter((entry) => entry.absent) },
                ]).map((group) => <section key={group.key} aria-label={group.label} className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground">{group.label} <Badge variant="outline">{group.entries.length}</Badge></h4>
                  {group.entries.length ? (() => { const cards = group.entries.map((entry) => ({ key: `${section.key}:${entry.id}`, id: entry.brokerId, name: entry.brokerName, node: (
              <BrokerOccurrenceCard
                key={`${section.key}:${entry.id}`}
                directorLite={directorLite}
                turn={entry.absent ? null : turnOf(entry.brokerId)}
                scheduleId={schedule.id}
                leadsSince={leadsSinceOption}
                assignmentId={entry.id}
                brokerId={entry.brokerId}
                brokerName={entry.brokerName}
                phone={entry.phone}
                presenceStatus={entry.presenceStatus}
                paused={Boolean(entry.pausedAt)}
                confirmedAt={entry.confirmedAt?.toISOString() ?? null}
                absent={entry.absent}
                attendanceMode={entry.attendanceMode}
                scheduleAttendanceMode={schedule.attendanceMode}
                canSetAttendanceMode={context.role === "director"}
                onSitePending={entry.onSitePending}
                onSiteReleaseOpen={entry.onSiteReleaseOpen}
                branchName={entry.branchName ?? null}
                canAssignLeads={managementActionsSetting !== "false"}
                presencePhotoId={entry.presencePhotoId ?? null}
                presenceReleaseNote={entry.presenceReleaseNote ?? null}
                canSwap={entry.publishedDutyDate !== null}
                swapNotice={swapNotices.get(entry.id) ?? null}
                summary={{
                  internalCode: entry.internalCode,
                  availabilityStatus: entry.availabilityStatus,
                  presenceEnabled,
                  releasedByName: entry.releasedByName,
                  onlineOverride: entry.onlineOverride,
                  notificationErrorCode: entry.notificationErrorCode,
                  liveStatus: entry.liveStatus,
                  nextEventAt: entry.nextEventAt?.toISOString() ?? null,
                  activeLeads: entry.activeLeads,
                  capacity: entry.capacity,
                  crossesCut,
                  leadsMorning: brokerShiftCounts(entry.brokerId).manha,
                  leadsAfternoon: brokerShiftCounts(entry.brokerId).tarde,
                }}
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium">{entry.brokerName}</span>
                    {swapNotices.has(entry.id) ? <Badge variant="info" title={swapNoticeText(swapNotices.get(entry.id)!)}>Troca feita</Badge> : null}
                    {entry.onlineOverride ? <Badge variant="info" title="Online neste plantão presencial: confirma com um toque, sem foto">Online</Badge> : null}
                    {presenceEnabled && entry.presenceStatus === "confirmed" ? <Badge variant="success" aria-label={`${entry.releasedByName ? `Liberado por ${entry.releasedByName}` : "Presença confirmada"}${entry.confirmedAt ? ` às ${dateTime.format(entry.confirmedAt)}` : ""}`} title={`${entry.releasedByName ? `Liberado por ${entry.releasedByName}` : "Confirmado"}${entry.confirmedAt ? ` em ${dateTime.format(entry.confirmedAt)}` : ""}`}><CheckCircle2 className="size-3.5" aria-hidden="true" /></Badge> : null}
                    {presenceEnabled && entry.presenceStatus === "pending" ? <Badge variant="warning" aria-label="Aguardando confirmação" title={entry.notificationErrorCode ? "Não foi possível enviar o lembrete" : "Aguardando confirmação"}><Clock3 className="size-3.5" aria-hidden="true" /></Badge> : null}
                    {presenceEnabled && entry.attendanceMode !== "presencial" && !entry.absent ? <BrokerPresenceInviteButton scheduleId={schedule.id} assignmentId={entry.id} brokerName={entry.brokerName} /> : null}
                    {/* Presencial with a photo: release only from the drawer, where the photo is (validation is mandatory). */}
                    {entry.attendanceMode === "presencial" && entry.presencePhotoId && entry.onSitePending && !entry.absent ? <Badge variant="warning" title="O corretor guarda o lugar na vez pela hora da foto">{entry.photoTakenAt ? `Foto para validar · há ${Math.max(0, Math.round((now.getTime() - entry.photoTakenAt.getTime()) / 60_000))} min` : "Foto para validar"}</Badge> : null}
                    {(presenceEnabled || entry.attendanceMode === "presencial") && entry.presenceStatus === "pending" && !entry.absent && !(entry.attendanceMode === "presencial" && entry.presencePhotoId) ? <BrokerPresenceReleaseButton scheduleId={schedule.id} assignmentId={entry.id} brokerName={entry.brokerName} inUnit={entry.attendanceMode === "presencial"} /> : null}
                    {!entry.absent && !entry.onSitePending ? <BrokerPauseButton scheduleId={schedule.id} assignmentId={entry.id} brokerName={entry.brokerName} paused={Boolean(entry.pausedAt)} /> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{entry.internalCode ? `Código ${entry.internalCode}` : "Sem código"} · {entry.branchName ?? "Sem unidade"} · {entry.availabilityStatus ?? "—"}{shiftSections && entry.shift === "dia" ? " · Dia todo" : ""}{presenceEnabled && entry.releasedByName ? ` · Liberado por ${entry.releasedByName}` : ""}</p>
                  {entry.blockedReason ? <p className="mt-0.5 text-xs font-medium text-warning">{entry.blockedReason}</p> : null}
                  <div className="mt-1.5">
                    <BrokerLiveStatus status={entry.liveStatus} nextEventAt={entry.nextEventAt ? entry.nextEventAt.toISOString() : null} />
                  </div>
                  <BrokerCapacityBar activeLeads={entry.activeLeads} capacity={entry.capacity} />
                </div>
                {/* Leads received in this occurrence, by the same morning/afternoon cut as the leads list. */}
                {crossesCut ? <div className="flex shrink-0 items-center gap-1.5" aria-label={`${brokerShiftCounts(entry.brokerId).manha} leads de manhã e ${brokerShiftCounts(entry.brokerId).tarde} à tarde neste plantão`}>
                  <Badge variant="info" title="Leads recebidos de manhã neste plantão">Manhã {brokerShiftCounts(entry.brokerId).manha}</Badge>
                  <Badge variant="destructive" title="Leads recebidos à tarde neste plantão">Tarde {brokerShiftCounts(entry.brokerId).tarde}</Badge>
                </div> : <Badge variant="outline" title="Leads recebidos neste plantão">{brokerShiftCounts(entry.brokerId).manha + brokerShiftCounts(entry.brokerId).tarde} leads</Badge>}
              </BrokerOccurrenceCard>
            ) }));
                  // The director drags the active cards to change who receives first (29/10).
                  return turnState && liveWindow && context.role === "director" && group.key === "active"
                    ? <DutyTurnSortableGrid scheduleId={schedule.id} dutyDate={liveWindow.dutyDate} order={turnState.order} queue={turnState.queue} items={cards} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" />
                    : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{cards.map((card) => card.node)}</div>;
                  })() : <p className="text-sm text-muted-foreground">Nenhum corretor nesta seção.</p>}
                </section>) : <p className="text-sm text-muted-foreground">Ninguém escalado neste turno.</p>}
              </section>
            )) : <p className="text-sm text-muted-foreground">Nenhum corretor escalado neste plantão.</p>}
            <PendingRoster
              scheduleId={schedule.id}
              entries={pendingRoster.map((entry) => ({ entryId: entry.id, id: entry.brokerProfileId, name: entry.name, internalCode: entry.internalCode, branchName: entry.branchName }))}
              candidates={invitedBrokers}
            />
          </CardContent>
        </Card>
      </div>

      {context.role === "manager" ? <p className="text-xs text-muted-foreground">Você está vendo apenas dados da sua unidade.</p> : null}
    </main>
  </>;
}
