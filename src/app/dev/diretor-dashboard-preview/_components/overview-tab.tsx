"use client";

/** "Visão da operação": the command center of the day (CommandCenter) in the director Lite look. */
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight, Calculator, CalendarCheck, CalendarDays, ChartColumn, CheckCircle2, CircleDollarSign, MessagesSquare, Plus, Search, UserPlus, Users,
} from "lucide-react";

import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { motionTokens as m } from "@/components/arc/motion-tokens";
import type { CommandCenterData } from "@/features/dashboard/today";

import styles from "../preview.module.css";
import type { OverviewPeriod } from "./data";
import { arrival, LEAD_STATUS, n, plural } from "./format";
import { enterT, exitT, fadeT, LiteAttention, LiteBar, LiteDelta, LiteItem, LiteNumber, LiteReveal, staggerDelay, useReduce } from "./motion";

type Attention = CommandCenterData["attention"][number];

const periodWords = (period: OverviewPeriod) =>
  period === "today" ? { since: "desde as 19h", section: "Turno de hoje, desde ontem às 19h", unit: "no turno" } : { since: `em ${period} dias`, section: `Últimos ${period} dias`, unit: `em ${period} dias` };

function LeadSearch() {
  const [query, setQuery] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    window.location.assign(value ? `/leads?search=${encodeURIComponent(value)}` : "/leads");
  };
  return (
    <form role="search" className={styles.search} onSubmit={submit}>
      <Search aria-hidden="true" size={18} className={styles.searchIcon} />
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar lead por nome ou telefone" aria-label="Buscar lead por nome ou telefone" className={styles.searchInput} />
    </form>
  );
}

function TodayNumbers({ today, period, pulse }: { today: CommandCenterData["today"]; period: OverviewPeriod; pulse: number }) {
  const reduce = useReduce();
  const words = periodWords(period);
  const items = [
    { label: `Chegaram ${words.since}`, value: today.received, href: "/leads", action: "Ver leads", pulse },
    { label: `Distribuídos ${words.since}`, value: today.distributed, href: "/leads/distribuicao", action: "Ver distribuição" },
    { label: "Aguardando corretor agora", value: today.waiting, href: "/leads/distribuicao", action: "Distribuir", warn: today.waiting > 0 },
    { label: "Sem 1º contato agora", value: today.withoutFirstContact, href: "/leads?attention=unworked", action: "Cobrar atendimento", warn: today.withoutFirstContact > 0 },
  ];
  return (
    <section aria-labelledby="kpi-title" className={styles.block}>
      <h2 id="kpi-title" className={styles.blockTitle}>{words.section}</h2>
      <div className={styles.kpis}>
        {items.map((item, index) => (
          <LiteItem key={item.action} index={index} className={styles.kpiWrap}>
            <motion.a href={item.href} className={styles.kpi} data-warn={item.warn ? "true" : undefined} whileTap={reduce ? undefined : { scale: 0.985 }} transition={m.spring.snappy}>
              <LiteAttention pulse={item.pulse ?? 0} />
              <span className={styles.kpiTop}>
                <span className={styles.kpiLabel}>{item.label}</span>
                <LiteDelta show={Boolean(item.warn)}>Pede ação</LiteDelta>
              </span>
              <LiteNumber value={item.value} className={styles.kpiValue} />
              <span className={styles.kpiAction}>
                {item.action}
                <ArrowRight aria-hidden="true" size={14} className={styles.arrow} />
              </span>
            </motion.a>
          </LiteItem>
        ))}
      </div>
    </section>
  );
}

function Shortcuts({ data, onQuality, now }: { data: CommandCenterData; onQuality: () => void; now: Date }) {
  const running = data.welcome.runningDuties?.[0] ?? null;
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now).slice(0, 7);
  const items = [
    running ? { href: `/leads/distribuicao/plantao/${running.scheduleId}`, label: "Plantão agora", icon: CalendarCheck } : { href: "/leads/distribuicao?view=plantao", label: "Plantões", icon: CalendarCheck },
    { href: `/leads/distribuicao?view=plantao&escalaMes=${month}`, label: "Escala do mês", icon: CalendarDays },
    { href: "/conversas", label: "Conversas", icon: MessagesSquare },
    { href: "/cotacao", label: "Nova cotação", icon: Calculator },
    { href: "/vendas", label: "Vendas", icon: CircleDollarSign },
    { href: "/equipe/convidar", label: "Convidar corretor", icon: UserPlus },
  ];
  return (
    <nav aria-label="Atalhos" className={styles.shortcuts}>
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <LiteItem key={item.label} index={index} className={styles.shortcutWrap}>
            <Link href={item.href} className={styles.chip}>
              <Icon aria-hidden="true" size={18} />
              {item.label}
            </Link>
          </LiteItem>
        );
      })}
      <LiteItem index={items.length} className={styles.shortcutWrap}>
        <button type="button" className={styles.chip} onClick={onQuality}>
          <ChartColumn aria-hidden="true" size={18} />
          Relatórios
        </button>
      </LiteItem>
    </nav>
  );
}

function QueuesCard({ queues, received, period }: { queues: CommandCenterData["today"]["queues"]; received: number; period: OverviewPeriod }) {
  const words = periodWords(period);
  const max = Math.max(1, ...queues.map((queue) => queue.today));
  return (
    <LiteReveal as="section" className={`${styles.card} ${styles.areaQueues}`} label="Leads por fila">
      <header className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle}>Leads {period === "today" ? "do turno" : `de ${period} dias`} por fila</h2>
          <p className={styles.cardDescription}>
            {queues.length ? `${plural(received, "lead chegou", "leads chegaram")} ${words.since} em ${plural(queues.length, "fila", "filas")}.` : `Nenhum lead chegou ${words.since}.`}
          </p>
        </div>
      </header>
      {queues.length ? (
        <ul className={styles.rows}>
          {queues.map((queue, index) => (
            <li key={queue.id ?? "none"}>
              <Link href={queue.id ? `/leads?fila=${queue.id}` : "/leads?fila=__none"} className={styles.queueRow}>
                <span className={styles.queueMain}>
                  <span className={styles.queueName}>
                    <span className={styles.seriesDot} data-series={(index % 6) + 1} aria-hidden="true" />
                    <span className={styles.truncate} title={queue.name}>{queue.name}</span>
                    <LiteDelta show={queue.waiting > 0}>{queue.waiting} aguardando</LiteDelta>
                  </span>
                  <LiteBar value={queue.today / max} delay={staggerDelay(index)} tone={`series-${(index % 6) + 1}`} />
                </span>
                <span className={styles.queueCount}>
                  <LiteNumber value={queue.today} className={styles.rowNumber} />
                  <span className={styles.muted}>{words.unit}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.cardEmpty}>
          <Link href="/leads/distribuicao" className={styles.textLink}>Ver as filas <ArrowRight aria-hidden="true" size={14} /></Link>
        </div>
      )}
    </LiteReveal>
  );
}

function RecentLeads({ rows, now, freshId }: { rows: CommandCenterData["recentLeads"]; now: Date; freshId: string | null }) {
  const reduce = useReduce();
  return (
    <LiteReveal as="section" className={`${styles.card} ${styles.areaRecent}`} label="Leads recentes" delay={staggerDelay(1)}>
      <header className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle}>Leads recentes</h2>
          <p className={styles.cardDescription}>Os últimos que chegaram, em tempo real.</p>
        </div>
        <Link href="/leads" className={styles.textLink}>Todos os leads <ArrowRight aria-hidden="true" size={14} /></Link>
      </header>
      {rows.length ? (
        <div role="table" aria-label="Leads recentes" className={styles.leadTable}>
          <div role="row" className={`${styles.leadRow} ${styles.leadHead}`}>
            <span role="columnheader">Chegada</span>
            <span role="columnheader">Contato</span>
            <span role="columnheader">Etapa</span>
            <span role="columnheader" className={styles.hideMd}>Unidade</span>
          </div>
          <AnimatePresence initial={false}>
            {rows.slice(0, 6).map((row) => {
              const time = arrival(row.createdAt, now);
              const status = LEAD_STATUS[row.status] ?? { label: row.status, tone: "neutral" as const };
              const fresh = row.id === freshId;
              return (
                <motion.div
                  key={row.id}
                  role="row"
                  layout={reduce ? false : "position"}
                  className={styles.leadRow}
                  data-fresh={fresh || undefined}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0, transition: reduce ? fadeT : enterT }}
                  exit={{ opacity: 0, transition: exitT }}
                  transition={m.spring.smooth}
                >
                  {fresh ? <LiteAttention pulse={1} /> : null}
                  <span role="cell" className={styles.arrival}>
                    <span className={styles.tabular}>{time.main}</span>
                    <span className={styles.muted}>{time.sub}</span>
                  </span>
                  <span role="cell" className={styles.leadName}>
                    <Link href={`/leads/${row.id}`} className={styles.truncate} title={row.name}>{row.name}</Link>
                  </span>
                  <span role="cell"><span className={styles.badge} data-tone={status.tone}>{status.label}</span></span>
                  <span role="cell" className={`${styles.muted} ${styles.hideMd} ${styles.truncate}`}>{row.branchName ?? "Sem unidade"}</span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        <div className={styles.cardEmpty}>
          <EmptyState icon={<Users aria-hidden="true" />} title="Nenhum lead no período" description="Os leads aparecem aqui assim que chegarem." />
        </div>
      )}
    </LiteReveal>
  );
}

function AttentionCard({ items, onOpen }: { items: Attention[]; onOpen: (item: Attention) => void }) {
  const reduce = useReduce();
  return (
    <LiteReveal as="section" className={`${styles.card} ${styles.areaAttention}`} label="Precisam de atenção">
      <header className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle}>Precisam de atenção</h2>
          <p className={styles.cardDescription}>{items.length ? "Toque para ver os leads e corretores." : "Nenhuma pendência na operação agora."}</p>
        </div>
        <Link href="/leads/distribuicao" className={styles.textLink}>Distribuição <ArrowRight aria-hidden="true" size={14} /></Link>
      </header>
      {items.length ? (
        <div className={styles.attentionGrid}>
          {items.slice(0, 4).map((item, index) => (
            <LiteItem key={item.id} index={index} className={styles.attentionWrap}>
              <motion.button type="button" className={styles.attentionCell} data-tone={item.tone} onClick={() => onOpen(item)} whileTap={reduce ? undefined : { scale: 0.985 }} transition={m.spring.snappy} aria-haspopup="dialog">
                <span className={styles.attentionTitle}>{item.title}</span>
                <LiteNumber value={item.count} className={styles.attentionValue} />
                <span className={styles.attentionDescription}>{item.description}</span>
              </motion.button>
            </LiteItem>
          ))}
        </div>
      ) : (
        <div className={styles.cardEmpty}>
          <EmptyState icon={<CheckCircle2 aria-hidden="true" />} title="Nada pendente" description="A distribuição e o acompanhamento estão em dia." />
        </div>
      )}
    </LiteReveal>
  );
}

function DutiesCard({ welcome }: { welcome: CommandCenterData["welcome"] }) {
  const running = welcome.runningDuties ?? [];
  const list = running.length ? running : welcome.nextDuty ? [welcome.nextDuty] : [];
  return (
    <LiteReveal as="section" className={`${styles.card} ${styles.areaDuties}`} label="Plantões" delay={staggerDelay(1)}>
      <header className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle}>{running.length ? "Plantões agora" : "Próximo plantão"}</h2>
          <p className={styles.cardDescription}>{running.length ? `${plural(welcome.pulse.brokersOnDutyNow, "corretor", "corretores")} em plantão.` : "Nenhum plantão rodando agora."}</p>
        </div>
      </header>
      {list.length ? (
        <ul className={styles.rows}>
          {list.map((duty, index) => {
            const short = duty.brokerCount < duty.minimumBrokers;
            return (
              <LiteItem as="li" key={duty.scheduleId} index={index}>
                <Link href={`/leads/distribuicao/plantao/${duty.scheduleId}`} className={styles.dutyRow}>
                  <span className={styles.dutyText}>
                    <span className={styles.rowTitle}>
                      {duty.running ? <span className={styles.liveDot} aria-hidden="true" /> : null}
                      <span className={styles.truncate} title={duty.name}>{duty.name}</span>
                    </span>
                    <span className={styles.muted}>{duty.running ? "Agora" : `${duty.dutyDate.slice(8, 10)}/${duty.dutyDate.slice(5, 7)}`}, {duty.startsAt} às {duty.endsAt}{duty.queueName ? `, ${duty.queueName}` : ""}</span>
                  </span>
                  <span className={styles.badge} data-tone={short ? "warning" : "neutral"} aria-label={`${duty.brokerCount} de ${duty.minimumBrokers} corretores mínimos`}>
                    <Users aria-hidden="true" size={14} />
                    <span className={styles.tabular}>{duty.brokerCount}/{duty.minimumBrokers}</span>
                  </span>
                </Link>
              </LiteItem>
            );
          })}
        </ul>
      ) : (
        <div className={styles.cardEmpty}>
          <Link href="/leads/distribuicao?view=plantao" className={styles.textLink}>Ver plantões <ArrowRight aria-hidden="true" size={14} /></Link>
        </div>
      )}
    </LiteReveal>
  );
}

function ReadinessCard({ whatsapp }: { whatsapp: CommandCenterData["whatsapp"] }) {
  const missing = whatsapp.total - whatsapp.connected;
  const percent = whatsapp.total ? Math.round((whatsapp.connected / whatsapp.total) * 100) : 0;
  return (
    <LiteReveal as="section" className={`${styles.card} ${styles.areaReadiness}`} label="WhatsApp dos corretores" delay={staggerDelay(2)}>
      <header className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle}>WhatsApp dos corretores</h2>
          <p className={styles.cardDescription}>{whatsapp.total ? "Obrigatório para receber leads do plantão a partir de 20/10." : "Nenhum corretor ativo."}</p>
        </div>
      </header>
      {whatsapp.total ? (
        <div className={styles.cardBody}>
          <div className={styles.miniStats}>
            <span className={styles.miniStat}>
              <LiteNumber value={whatsapp.connected} className={styles.miniValue} />
              <span className={styles.muted}>Conectaram</span>
            </span>
            <span className={styles.miniStat} data-warn={missing ? "true" : undefined}>
              <LiteNumber value={missing} className={styles.miniValue} />
              <span className={styles.muted}>Não conectaram</span>
            </span>
          </div>
          <span role="progressbar" aria-label="Corretores com WhatsApp conectado" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className={styles.progressWrap}>
            <LiteBar value={percent / 100} tone="success" />
          </span>
          <span className={styles.muted}>{percent}% de {plural(whatsapp.total, "corretor ativo", "corretores ativos")}</span>
          {whatsapp.notConnected.length ? (
            <ul className={styles.nameList} aria-label="Corretores sem WhatsApp conectado">
              {whatsapp.notConnected.map((broker, index) => (
                <LiteItem as="li" key={broker.id} index={index}>
                  <Link href={`/equipe/${broker.id}`} className={styles.nameRow} title={broker.name}>
                    <span className={styles.truncate}>{broker.name}</span>
                    <ArrowRight aria-hidden="true" size={14} className={styles.arrow} />
                  </Link>
                </LiteItem>
              ))}
              {missing > whatsapp.notConnected.length ? <li className={styles.muted}>e mais {missing - whatsapp.notConnected.length}</li> : null}
            </ul>
          ) : null}
        </div>
      ) : null}
    </LiteReveal>
  );
}

function ActivityCard({ activity }: { activity: CommandCenterData["whatsapp"]["activity"] }) {
  const [all, setAll] = useState(false);
  const max = Math.max(1, ...activity.brokers.map((broker) => broker.leadCount));
  const visible = all ? activity.brokers : activity.brokers.slice(0, 12);
  return (
    <LiteReveal as="section" className={`${styles.card} ${styles.areaActivity}`} label="Respostas no WhatsApp por corretor">
      <header className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle}>Respostas no WhatsApp</h2>
          <p className={styles.cardDescription}>Leads que responderam no WhatsApp do corretor nos últimos 7 dias. Toque no corretor para abrir as conversas.</p>
        </div>
      </header>
      <div className={styles.cardBody}>
        <p className={styles.headline} aria-label={`${activity.totalLeads} leads responderam nos últimos 7 dias`}>
          <LiteNumber value={activity.totalLeads} className={styles.headlineValue} />
          <span>leads responderam nos últimos 7 dias</span>
          <span className={styles.muted}>{plural(activity.connectedBrokerCount, "corretor conectado", "corretores conectados")}</span>
        </p>
        {activity.brokers.length ? (
          <>
            <ul className={styles.activityGrid} aria-label="Leads que responderam por corretor">
              <AnimatePresence initial={false}>
                {visible.map((broker, index) => (
                  <motion.li key={broker.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: { ...enterT, delay: staggerDelay(Math.max(0, index - 12)) } }} exit={{ opacity: 0, transition: exitT }}>
                    <Link href={`/conversas?tab=leads&brokerId=${encodeURIComponent(broker.id)}&respondeu=7d`} className={styles.activityRow} title={`Ver conversas de ${broker.name}`} aria-label={`${broker.name}, ${plural(broker.leadCount, "lead", "leads")}`}>
                      <span className={styles.activityName}>
                        <span className={styles.truncate}>{broker.name}</span>
                        <span className={styles.tabular}>{plural(broker.leadCount, "lead", "leads", "nenhum lead")}</span>
                      </span>
                      <LiteBar value={broker.leadCount / max} delay={staggerDelay(index)} height={4} />
                    </Link>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
            {activity.brokers.length > 12 ? (
              <button type="button" className={styles.ghostButton} onClick={() => setAll((was) => !was)} aria-expanded={all}>
                {all ? "Mostrar menos" : `Ver todos os ${n(activity.brokers.length)} corretores`}
              </button>
            ) : null}
          </>
        ) : (
          <p className={styles.muted}>Nenhum corretor conectado.</p>
        )}
      </div>
    </LiteReveal>
  );
}

export function OverviewTab({ data, period, now, pulse, freshId, onDrill, onQuality }: {
  data: CommandCenterData; period: OverviewPeriod; now: Date; pulse: number; freshId: string | null;
  onDrill: (item: Attention) => void; onQuality: () => void;
}) {
  const reduce = useReduce();
  return (
    <div className={styles.stack}>
      <section aria-label="Buscar e criar" className={styles.searchRow}>
        <LeadSearch />
        <motion.a href="/leads?new=1" className={styles.primaryButton} whileTap={reduce ? undefined : { scale: 0.97 }} transition={m.spring.snappy}>
          <Plus aria-hidden="true" size={18} /> Novo lead
        </motion.a>
      </section>
      <TodayNumbers today={data.today} period={period} pulse={pulse} />
      <Shortcuts data={data} onQuality={onQuality} now={now} />
      <div className={styles.overviewGrid}>
        <QueuesCard queues={data.today.queues} received={data.today.received} period={period} />
        <RecentLeads rows={data.recentLeads} now={now} freshId={freshId} />
        <AttentionCard items={data.attention} onOpen={onDrill} />
        <DutiesCard welcome={data.welcome} />
        <ReadinessCard whatsapp={data.whatsapp} />
        <ActivityCard activity={data.whatsapp.activity} />
      </div>
    </div>
  );
}
