"use client";

/**
 * Perfil do membro no visual Lite (/equipe/[id], visão de quem não usa o Lite de gestor ou supervisor). Mesmos dados
 * da tela atual (getTeamMemberProfile): identidade, seis números, temperatura, ofertas, leads recebidos por período e
 * temperatura, feedbacks, ranking, plantões, resultado comercial e redistribuições. Datas no fuso de São Paulo, com o
 * instante do servidor (`now`) para o período bater no servidor e no navegador.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

import { LiteFilterChips } from "@/components/lite/controls";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LitePagination, useLitePages } from "@/components/lite/data/pagination";
import { LITE_TIME_ZONE, liteDateFormatter } from "@/components/lite/format/date";
import page from "@/components/lite/page/lite-page.module.css";
import { acceptRate, formatDuration, RANK_LABEL, type BrokerOfferStats, type RankPosition } from "@/features/engagement/ranking";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";
import { SupervisorNoteHistory } from "@/features/supervisor-workspace/broker-profile/supervisor-broker-profile";
import type { SupervisorNote } from "@/features/supervisor-workspace/notes-types";
import type { getTeamMemberProfile } from "@/features/team/member-profile";

import styles from "./member-profile-lite.module.css";

type Profile = NonNullable<Awaited<ReturnType<typeof getTeamMemberProfile>>>;
type Lead = Profile["recentLeads"][number];
type DutyDay = Profile["dutyDays"][number];
type Temperature = "hot" | "warm" | "cold";
type Period = "today" | "7d" | "30d" | "month" | "all";

const TEMPERATURES: Record<Temperature, { label: string; tone: "danger" | "warning" | "info" }> = {
  hot: { label: "Quentes", tone: "danger" },
  warm: { label: "Mornos", tone: "warning" },
  cold: { label: "Frios", tone: "info" },
};
const TEMPERATURE_ONE: Record<Temperature, string> = { hot: "Quente", warm: "Morno", cold: "Frio" };
const PERIODS: Array<{ id: Period; label: string }> = [
  { id: "today", label: "Hoje" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "month", label: "Este mês" },
  { id: "all", label: "Todos" },
];
const AVAILABILITY: Record<string, string> = { available: "Disponível", paused: "Pausado", on_duty: "Em plantão", offline: "Fora do plantão" };
const ROLE_LABELS: Record<string, string> = { director: "Diretor", manager: "Gestor", supervisor: "Supervisor", broker: "Corretor" };
const PRESENCE: Record<string, { label: string; tone: "success" | "warning" | "danger" }> = {
  confirmed: { label: "Presença confirmada", tone: "success" },
  pending: { label: "Presença pendente", tone: "warning" },
  absent: { label: "Faltou", tone: "danger" },
};

const longDate = liteDateFormatter({ dateStyle: "medium" });
const dateTime = liteDateFormatter({ dateStyle: "short", timeStyle: "short" });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: LITE_TIME_ZONE });
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const asTemperature = (value: string | null | undefined): Temperature | null => (value === "hot" || value === "warm" || value === "cold" ? value : null);
const receivedAt = (lead: Lead) => new Date(lead.assignedAt ?? lead.createdAt);
const sentence = (text: string) => text.charAt(0) + text.slice(1).toLocaleLowerCase("pt-BR");

export function inPeriod(lead: Pick<Lead, "assignedAt" | "createdAt">, period: Period, now: Date) {
  if (period === "all") return true;
  const at = new Date(lead.assignedAt ?? lead.createdAt);
  const today = dayKey.format(now);
  if (period === "today") return dayKey.format(at) === today;
  if (period === "month") return dayKey.format(at).slice(0, 7) === today.slice(0, 7);
  return now.getTime() - at.getTime() <= (period === "7d" ? 7 : 30) * 86_400_000;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year!, month! - 1, 15)));
  return label.charAt(0).toLocaleUpperCase("pt-BR") + label.slice(1);
}

function dayLabel(key: string) {
  const label = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "UTC" }).format(new Date(`${key}T12:00:00Z`));
  return label.charAt(0).toLocaleUpperCase("pt-BR") + label.slice(1);
}

function shiftMonth(key: string, offset: number) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function Bar({ parts, label }: { parts: Array<{ key: string; value: number; tone: string }>; label: string }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  return (
    <span className={styles.bar} role="img" aria-label={label}>
      {total ? parts.map((part) => (part.value ? <span key={part.key} className={styles.barPart} data-tone={part.tone} style={{ width: `${(part.value / total) * 100}%` }} /> : null)) : null}
    </span>
  );
}

function LeadsSection({ leads, limit, now }: { leads: Lead[]; limit: number; now: Date }) {
  const [period, setPeriod] = useState<Period>("7d");
  const [temperature, setTemperature] = useState<Temperature | null>(null);
  const counts = useMemo(() => Object.fromEntries(PERIODS.map((item) => [item.id, leads.filter((lead) => inPeriod(lead, item.id, now)).length])) as Record<Period, number>, [leads, now]);
  const inThisPeriod = useMemo(() => leads.filter((lead) => inPeriod(lead, period, now)), [leads, now, period]);
  const byTemperature = useMemo(() => {
    const result: Record<Temperature, number> = { hot: 0, warm: 0, cold: 0 };
    for (const lead of inThisPeriod) {
      const key = asTemperature(lead.temperature);
      if (key) result[key] += 1;
    }
    return result;
  }, [inThisPeriod]);
  const shown = temperature ? inThisPeriod.filter((lead) => asTemperature(lead.temperature) === temperature) : inThisPeriod;
  const { pageRows, pagination } = useLitePages(shown, 10);

  const columns: LiteColumn<Lead>[] = [
    {
      id: "lead",
      label: "Lead",
      primary: true,
      render: (lead) => (
        <span>
          <Link href={`/leads/${lead.id}`} className={`${page.cellTitle} ${page.cellLink}`} title={lead.name}>{lead.name}</Link>
          {lead.queueName ? <span className={page.cellSub}>{lead.queueName}</span> : null}
        </span>
      ),
    },
    {
      id: "temperature",
      label: "Temperatura",
      render: (lead) => {
        const key = asTemperature(lead.temperature);
        return key ? <span className={page.badge} data-tone={TEMPERATURES[key].tone}>{TEMPERATURE_ONE[key]}</span> : <span className={page.muted}>Sem temperatura</span>;
      },
    },
    { id: "status", label: "Status", render: (lead) => <span className={page.badge}>{sentence(LEAD_STATUS_LABELS[lead.status] ?? lead.status)}</span> },
    { id: "contact", label: "1º contato", render: (lead) => (lead.firstContactAt ? <span className={page.numeric}>{dateTime.format(new Date(lead.firstContactAt))}</span> : <span className={page.badge} data-tone="warning">Pendente</span>) },
    { id: "received", label: "Recebido em", render: (lead) => <span className={page.numeric}>{dateTime.format(receivedAt(lead))}</span> },
  ];

  return (
    <section className={page.group} aria-labelledby="membro-leads">
      <div className={page.cardHead}>
        <h2 id="membro-leads" className={page.sectionTitle}>Leads recebidos</h2>
        <p className={page.muted}>Pela data em que chegaram ao corretor.{leads.length >= limit ? ` Considera os ${limit} mais recentes.` : ""}</p>
      </div>
      <LiteFilterChips label="Período" scroll active={[period]} onToggle={(id) => setPeriod(id as Period)} chips={PERIODS.map((item) => ({ id: item.id, label: item.label, count: counts[item.id] }))} />
      <LiteFilterChips label="Temperatura" scroll active={temperature ? [temperature] : []} onToggle={(id) => setTemperature(temperature === id ? null : (id as Temperature))} chips={(Object.keys(TEMPERATURES) as Temperature[]).map((key) => ({ id: key, label: TEMPERATURES[key].label, count: byTemperature[key] }))} />
      <LiteResponsiveData
        caption="Leads recebidos"
        columns={columns}
        rows={pageRows}
        rowKey={(lead) => lead.id}
        empty={<p>Nenhum lead {temperature ? `${TEMPERATURES[temperature].label.toLocaleLowerCase("pt-BR")} ` : ""}neste período.</p>}
      />
      <LitePagination label="Páginas de leads" {...pagination} />
    </section>
  );
}

function DutySection({ days, now }: { days: DutyDay[]; now: Date }) {
  const today = dayKey.format(now);
  const [month, setMonth] = useState(today.slice(0, 7));
  const months = [...new Set(days.map((day) => day.date.slice(0, 7)))].sort();
  const first = months[0] && months[0] < today.slice(0, 7) ? months[0] : today.slice(0, 7);
  const last = months.at(-1) && months.at(-1)! > today.slice(0, 7) ? months.at(-1)! : today.slice(0, 7);
  const monthDays = days.filter((day) => day.date.startsWith(month));
  return (
    <section className={page.card} aria-labelledby="membro-plantoes">
      <div className={styles.cardHeadRow}>
        <div className={page.cardHead}>
          <h2 id="membro-plantoes" className={page.sectionTitle}>Plantões</h2>
          <p className={page.muted}>{monthLabel(month)} · {monthDays.length} {monthDays.length === 1 ? "plantão" : "plantões"}</p>
        </div>
        <span className={styles.monthNav}>
          <button type="button" className={page.iconButton} aria-label="Mês anterior" disabled={month <= first} onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft aria-hidden="true" size={18} /></button>
          <button type="button" className={page.iconButton} aria-label="Próximo mês" disabled={month >= last} onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight aria-hidden="true" size={18} /></button>
        </span>
      </div>
      {monthDays.length === 0 ? <p className={page.muted}>Nenhum plantão neste mês.</p> : (
        <ul className={styles.duties}>
          {monthDays.map((item) => (
            <li key={`${item.date}:${item.scheduleId}`} className={styles.duty} data-past={item.date < today ? "true" : undefined}>
              <span className={styles.dutyHead}>
                <span>
                  <Link href={`/leads/distribuicao/plantao/${item.scheduleId}${item.state === "done" ? `?data=${item.date}` : ""}`} className={`${page.cellTitle} ${page.cellLink}`}>{item.scheduleName}</Link>
                  <span className={page.cellSub}>{dayLabel(item.date)} · {item.startsAt} às {item.endsAt} · {item.typeName ?? "Sem tipo"} · {item.attendanceMode === "presencial" ? "Presencial" : "Online"}</span>
                </span>
                <span className={page.badge} data-tone={item.state === "today" ? "info" : undefined}>{item.state === "done" ? "Encerrado" : item.state === "today" ? "Hoje" : "Agendado"}</span>
              </span>
              {item.state !== "upcoming" || item.presence ? (
                <span className={styles.dutyFacts}>
                  {item.state !== "upcoming" ? <span className={page.cellSub}>{item.leads} leads · {item.offersSent} ofertas · {item.offersAccepted} aceitas</span> : null}
                  {item.presence ? <span className={page.badge} data-tone={PRESENCE[item.presence]?.tone}>{PRESENCE[item.presence]?.label}</span> : null}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function MemberProfileLite({ profile, leadsLimit, notes, showFeedbacks, ranking, scopeNote, now }: {
  profile: Profile;
  /** MEMBER_PROFILE_LEADS_LIMIT: acima disso a lista avisa que considera só os mais recentes. */
  leadsLimit: number;
  notes: SupervisorNote[];
  showFeedbacks: boolean;
  ranking: { stats: BrokerOfferStats | null; ranks: RankPosition[]; periodDays: number; withoutStep: number } | null;
  /** Aviso do gestor: só dados da própria unidade. */
  scopeNote: boolean;
  now: string;
}) {
  const at = useMemo(() => new Date(now), [now]);
  const { member, metrics, recentLeads, recentRedistributions, dutyDays } = profile;
  const isBroker = member.role === "broker";
  const roleName = member.customRoleName ?? ROLE_LABELS[member.role] ?? member.role;
  const active = member.membershipStatus === "active" && member.userStatus === "active";
  const statusLabel = member.membershipStatus !== "active" ? "Desativado" : member.userStatus === "pending" ? "Pendente" : member.userStatus === "active" ? "Ativo" : "Desativado";
  const firstContactRate = metrics.leads.total > 0 ? Math.round(((metrics.leads.total - metrics.leads.withoutFirstContact) / metrics.leads.total) * 100) : 0;
  const temperatureTotal = metrics.temperature.hot + metrics.temperature.warm + metrics.temperature.cold;
  const offers = metrics.offers;
  const answered = offers.total - offers.pending;
  const offerRate = answered > 0 ? Math.round((offers.accepted / answered) * 100) : null;
  const rankRate = ranking?.stats && ranking.stats.offered ? Math.round(acceptRate(ranking.stats) * 100) : null;

  return (
    <div className={`arc-venancor ${page.stack}`} data-skin="diretor">
      <section className={page.card} aria-labelledby="membro-nome">
        <div className={styles.identity}>
          <div className={styles.who}>
            <span className={styles.nameRow}>
              <h2 id="membro-nome" className={styles.name}>{member.name}</h2>
              <span className={page.badge} data-tone={active ? "success" : statusLabel === "Pendente" ? "warning" : undefined}>{statusLabel}</span>
            </span>
            <span className={page.cellSub}>{roleName} · {member.branchName ?? "Geral da empresa"}</span>
            <span className={page.cellSub}>{member.email}</span>
          </div>
          <dl className={styles.facts}>
            <div><dt>Disponibilidade</dt><dd>{AVAILABILITY[member.availabilityStatus] ?? member.availabilityStatus}</dd></div>
            <div><dt>No time desde</dt><dd>{longDate.format(new Date(member.joinedAt))}</dd></div>
            {member.brokerCode ? <div><dt>Código</dt><dd className={page.numeric}>{member.brokerCode}</dd></div> : null}
            {member.brokerLifecycleStatus ? <div><dt>Cadastro</dt><dd>{sentence(member.brokerLifecycleStatus.replace(/_/g, " "))}</dd></div> : null}
          </dl>
        </div>
        <Link href="/equipe" className={`${page.button} ${styles.back}`}><ArrowLeft aria-hidden="true" size={16} />Voltar à equipe</Link>
      </section>

      <div className={`${page.stats} ${styles.six}`} aria-label="Resumo operacional">
        <div className={page.stat}><span className={page.statLabel}>Carteira</span><span className={page.statValue}>{metrics.leads.total}</span><span className={page.statHint}>{metrics.leads.active} em andamento</span></div>
        <div className={page.stat}><span className={page.statLabel}>Qualificados</span><span className={page.statValue}>{metrics.leads.qualified}</span><span className={page.statHint}>{metrics.leads.converted} convertidos</span></div>
        <div className={page.stat} data-tone={metrics.leads.withoutFirstContact ? "warning" : undefined}><span className={page.statLabel}>Sem contato</span><span className={page.statValue}>{metrics.leads.withoutFirstContact}</span><span className={page.statHint}>{firstContactRate}% com 1º contato</span></div>
        <div className={page.stat}><span className={page.statLabel}>Perdidos</span><span className={page.statValue}>{metrics.leads.lost}</span><span className={page.statHint}>leads encerrados</span></div>
        <div className={page.stat}><span className={page.statLabel}>Vendas ativas</span><span className={page.statValue}>{metrics.sales.active}</span><span className={page.statHint}>{currency.format(Number(metrics.sales.volume))}</span></div>
        <div className={page.stat} data-tone={metrics.tasks.overdue ? "warning" : undefined}><span className={page.statLabel}>Tarefas</span><span className={page.statValue}>{metrics.tasks.open}</span><span className={page.statHint}>{metrics.tasks.overdue} vencida{metrics.tasks.overdue === 1 ? "" : "s"}</span></div>
      </div>

      <div className={styles.columns}>
        <div className={page.stack}>
          <div className={styles.pair}>
            <section className={page.card} aria-labelledby="membro-temperatura">
              <div className={styles.cardHeadRow}>
                <h2 id="membro-temperatura" className={page.sectionTitle}>Temperatura dos leads</h2>
                <span className={page.cellSub}>{temperatureTotal} qualificados{metrics.temperature.unknown ? ` · ${metrics.temperature.unknown} sem temperatura` : ""}</span>
              </div>
              <Bar label={(Object.keys(TEMPERATURES) as Temperature[]).map((key) => `${metrics.temperature[key]} ${TEMPERATURES[key].label.toLocaleLowerCase("pt-BR")}`).join(", ")} parts={(Object.keys(TEMPERATURES) as Temperature[]).map((key) => ({ key, value: metrics.temperature[key], tone: TEMPERATURES[key].tone }))} />
              <dl className={styles.trio}>
                {(Object.keys(TEMPERATURES) as Temperature[]).map((key) => (
                  <div key={key}><dt><span className={styles.dot} data-tone={TEMPERATURES[key].tone} aria-hidden="true" />{TEMPERATURES[key].label}</dt><dd>{metrics.temperature[key]}</dd><dd className={page.cellSub}>{temperatureTotal ? Math.round((metrics.temperature[key] / temperatureTotal) * 100) : 0}%</dd></div>
                ))}
              </dl>
            </section>
            <section className={page.card} aria-labelledby="membro-ofertas">
              <div className={styles.cardHeadRow}>
                <h2 id="membro-ofertas" className={page.sectionTitle}>Ofertas enviadas x aceitas</h2>
                <span className={page.cellSub}>{offerRate === null ? "Sem respostas ainda" : `${offerRate}% de aceite`}</span>
              </div>
              <p className={styles.big}>{offers.accepted}<span className={page.muted}>/{offers.total}</span> <span className={page.cellSub}>aceitas de enviadas</span></p>
              <Bar label={`${offers.accepted} de ${offers.total} ofertas aceitas`} parts={[{ key: "accepted", value: offers.accepted, tone: "success" }, { key: "rest", value: Math.max(0, offers.total - offers.accepted), tone: "none" }]} />
              <dl className={styles.trio}>
                <div><dt>Recusadas</dt><dd>{offers.declined}</dd></div>
                <div><dt>Expiradas</dt><dd>{offers.expired}</dd></div>
                <div><dt>Pendentes</dt><dd>{offers.pending}</dd></div>
              </dl>
            </section>
          </div>
          <LeadsSection leads={recentLeads} limit={leadsLimit} now={at} />
        </div>

        <aside className={page.stack}>
          {showFeedbacks ? (
            <section className={page.card} aria-labelledby="membro-feedbacks">
              <div className={page.cardHead}>
                <h2 id="membro-feedbacks" className={page.sectionTitle}>Feedbacks</h2>
                <p className={page.muted}>Histórico de feedbacks registrados pelo supervisor.</p>
              </div>
              <SupervisorNoteHistory notes={notes} />
            </section>
          ) : null}
          {isBroker && ranking ? (
            <section className={page.card} aria-labelledby="membro-ranking">
              <div className={styles.cardHeadRow}>
                <h2 id="membro-ranking" className={page.sectionTitle}>Velocidade e ranking</h2>
                <span className={page.cellSub}>Últimos {ranking.periodDays} dias</span>
              </div>
              <dl className={styles.trio}>
                <div><dt>Tempo para aceitar</dt><dd>{formatDuration(ranking.stats?.medianAcceptSeconds ?? null)}</dd></div>
                <div><dt>Ofertas x aceitas</dt><dd>{ranking.stats ? `${ranking.stats.accepted}/${ranking.stats.offered}` : "0/0"}</dd></div>
                <div><dt>Taxa de aceite</dt><dd>{rankRate === null ? "Sem dado" : `${rankRate}%`}</dd></div>
              </dl>
              {ranking.ranks.length ? (
                <ul className={styles.ranks}>
                  {ranking.ranks.map((rank) => (
                    <li key={rank.key}>
                      <span className={page.muted}>{RANK_LABEL[rank.key].replace(/^n[oa]s? /, "").replace(/^\w/, (letter) => letter.toUpperCase())}</span>
                      <span className={page.numeric} data-top={rank.position <= 3 ? "true" : undefined}>{rank.position}º de {rank.total}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className={page.muted}>Ainda sem ofertas suficientes para o ranking.</p>}
              <p className={ranking.withoutStep ? styles.warn : page.muted}>{ranking.withoutStep ? `${ranking.withoutStep} ${ranking.withoutStep === 1 ? "lead aceito está" : "leads aceitos estão"} sem etapa registrada.` : "Todos os leads aceitos têm etapa registrada."}</p>
            </section>
          ) : null}
          {isBroker ? <DutySection days={dutyDays} now={at} /> : null}
          <section className={page.card} aria-labelledby="membro-resultado">
            <div className={page.cardHead}>
              <h2 id="membro-resultado" className={page.sectionTitle}>Resultado comercial</h2>
              <p className={page.muted}>Produção registrada no CRM.</p>
            </div>
            <dl className={styles.quad}>
              <div><dt>Cotações criadas</dt><dd>{metrics.quotes.total}</dd><dd className={page.cellSub}>{metrics.quotes.sent} enviadas</dd></div>
              <div><dt>Vendas</dt><dd>{metrics.sales.total}</dd><dd className={page.cellSub}>{metrics.sales.cancelled} cancelada{metrics.sales.cancelled === 1 ? "" : "s"}</dd></div>
              <div><dt>Atividades</dt><dd>{metrics.interactions}</dd><dd className={page.cellSub}>interações registradas</dd></div>
              <div><dt>Tarefas concluídas</dt><dd>{metrics.tasks.completed}</dd><dd className={page.cellSub}>de {metrics.tasks.total} atribuídas</dd></div>
            </dl>
          </section>
          <section className={page.card} aria-labelledby="membro-redistribuicoes">
            <div className={page.cardHead}>
              <h2 id="membro-redistribuicoes" className={page.sectionTitle}>Redistribuições</h2>
              <p className={page.muted}>Leads que saíram da carteira deste membro. Não pressupõe responsabilidade individual sem uma causa registrada.</p>
            </div>
            {recentRedistributions.length ? (
              <ul className={styles.events}>
                {recentRedistributions.map((event) => (
                  <li key={event.id}>
                    <span className={styles.eventHead}><span className={styles.ellipsis}>{event.leadName}</span><span className={`${page.cellSub} ${page.numeric}`}>{longDate.format(new Date(event.createdAt))}</span></span>
                    <span className={page.cellSub}>{event.reason || event.action}</span>
                  </li>
                ))}
              </ul>
            ) : <p className={page.muted}>Não há redistribuições registradas dentro do escopo atual.</p>}
            <p className={styles.note}>{metrics.redistributions} no histórico, sendo <strong>{metrics.redistributionsWithoutFirstContact}</strong> antes do primeiro atendimento.</p>
          </section>
        </aside>
      </div>
      {scopeNote ? <p className={page.muted}>Você está vendo apenas dados e leads da sua unidade.</p> : null}
    </div>
  );
}
