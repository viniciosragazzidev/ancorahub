"use client";

/**
 * Painel essencial do diretor (chave ligada): só três blocos, nesta ordem.
 * 1) Plantões acontecendo agora · 2) Leads por fila na janela · 3) WhatsApp dos corretores.
 */
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, CalendarCheck, Inbox, MessagesSquare } from "lucide-react";

import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { motionTokens as m } from "@/components/arc/motion-tokens";
import type { DashboardDuty } from "@/features/dashboard/welcome";
import type { EssentialDashboard } from "@/features/dashboard/essential/essential-data";
import type { EssentialDuty, EssentialQueue } from "@/features/dashboard/essential/essential-summary";

import styles from "./director-lite.module.css";
import { n, plural } from "./format";
import { enterT, fadeT, LiteItem, LiteNumber, LiteReveal, staggerDelay, useReduce } from "./motion";

type Totals = EssentialDashboard["queues"]["totals"];

/** Um número do card: valor médio e rótulo curto embaixo. `text` troca o número por um texto (ex.: 2/3). */
function Stat({ label, value, text, warn }: { label: string; value?: number; text?: string; warn?: boolean }) {
  return (
    <div className={styles.stat2} data-warn={warn ? "true" : undefined}>
      <span className={styles.statNumber}>{text ?? <LiteNumber value={value ?? 0} />}</span>
      <span className={styles.statCaption}>{label}</span>
    </div>
  );
}

/** Ajuda de uma seção: um ícone de 44px que abre a explicação em linhas curtas (sem frases dentro dos cards). */
function Help({ label, lines }: { label: string; lines: string[] }) {
  return (
    <details className={styles.help}>
      <summary className={styles.helpButton} aria-label={label} title={label}>?</summary>
      <ul className={styles.helpPanel}>
        {lines.map((line) => <li key={line}>{line}</li>)}
      </ul>
    </details>
  );
}

function DutyCard({ duty, index }: { duty: EssentialDuty; index: number }) {
  return (
    <LiteItem as="li" index={index} className={styles.dutyCard}>
      <div className={styles.dutyTop}>
        <Link href={`/leads/distribuicao/plantao/${duty.scheduleId}`} className={styles.dutyName}>
          <span className={styles.liveDot} aria-hidden="true" />
          <span className={styles.truncate} title={duty.name}>{duty.name}</span>
        </Link>
        <span className={styles.dutyTime}>{duty.startsAt} às {duty.endsAt}</span>
      </div>
      <div className={styles.dutyNumbers}>
        <Stat label="disponíveis" value={duty.available} />
        <Stat label="distribuídos" value={duty.distributed} />
        <Stat label="corretores" text={`${duty.activeBrokers}/${duty.brokerCount}`} warn={duty.belowMinimum} />
      </div>
    </LiteItem>
  );
}

function DutiesBlock({ running, next }: { running: EssentialDuty[]; next: DashboardDuty | null }) {
  return (
    <LiteReveal as="section" className={styles.card} label="Plantões acontecendo agora">
      <header className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle}>Plantões acontecendo agora</h2>
          <p className={styles.cardDescription}>{running.length ? `${plural(running.length, "plantão ativo", "plantões ativos")} neste momento.` : "Nenhum plantão ativo neste momento."}</p>
        </div>
        <Help
          label="Como ler os números dos plantões"
          lines={[
            "Disponíveis: aguardando distribuição nesta fila agora.",
            "Distribuídos: entregues a corretor desde o início do plantão.",
            "Corretores: com presença confirmada hoje, de quantos escalados. Laranja quando está abaixo do mínimo.",
          ]}
        />
      </header>
      {running.length ? (
        <ul className={styles.dutyGrid}>
          {running.map((duty, index) => <DutyCard key={duty.scheduleId} duty={duty} index={index} />)}
        </ul>
      ) : (
        <div className={styles.cardEmpty}>
          <p className={styles.muted}>
            {next ? `Próximo: ${next.name}, ${next.dutyDate.slice(8, 10)}/${next.dutyDate.slice(5, 7)} às ${next.startsAt}.` : "Nenhum plantão configurado para as próximas horas."}
          </p>
          <Link href="/leads/distribuicao?view=plantao" className={styles.textLink}>
            <CalendarCheck aria-hidden="true" size={16} /> Ver plantões <ArrowRight aria-hidden="true" size={14} />
          </Link>
        </div>
      )}
    </LiteReveal>
  );
}

/** Barra empilhada quente, morno e frio da fila (um só tom de azul, do mais forte ao mais claro). */
function StackedTemperature({ queue, delay }: { queue: Pick<EssentialQueue, "hot" | "warm" | "cold">; delay: number }) {
  const reduce = useReduce();
  const total = queue.hot + queue.warm + queue.cold;
  const parts = [
    { level: "hot", value: queue.hot, label: "quentes" },
    { level: "warm", value: queue.warm, label: "mornos" },
    { level: "cold", value: queue.cold, label: "frios" },
  ];
  return (
    <span className={styles.stacked} role="img" aria-label={`${queue.hot} quentes, ${queue.warm} mornos, ${queue.cold} frios`}>
      {total ? parts.filter((part) => part.value > 0).map((part) => (
        <motion.span
          key={part.level}
          data-level={part.level}
          style={{ flexGrow: part.value }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={reduce ? fadeT : { ...enterT, delay: delay + m.stagger.line }}
          title={`${part.value} ${part.label}`}
        />
      )) : <span className={styles.muted}>sem leads</span>}
    </span>
  );
}

function QueuesBlock({ rows, totals, label, empty }: { rows: EssentialQueue[]; totals: Totals; label: string; empty: boolean }) {
  return (
    <LiteReveal as="section" className={styles.card} label="Leads por fila" delay={staggerDelay(1)}>
      <header className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle}>Leads por fila</h2>
          <p className={styles.cardDescription}>{totals.arrived ? `${plural(totals.arrived, "lead entrou", "leads entraram")} ${label}.` : `Nenhum lead entrou ${label}.`}</p>
        </div>
        <span className={styles.badge} data-tone="info">{label}</span>
      </header>
      {rows.length && !empty ? (
        <div className={styles.cardBody}>
          <table className={styles.table}>
            <caption className={styles.srOnly}>Leads por fila, {label}</caption>
            <thead>
              <tr>
                <th scope="col">Fila</th>
                <th scope="col" className={styles.numCol} title="Leads que entraram na janela">Entraram</th>
                <th scope="col" className={styles.numCol} title="Quentes e mornos">Qualificados</th>
                <th scope="col" className={styles.numCol} title="Leads frios">Frios</th>
                <th scope="col" title="Tentativas de requalificação de WhatsApp nos frios">Requalificação</th>
                <th scope="col" className={styles.numCol} title="Leads ainda sem temperatura">Em qualificação</th>
                <th scope="col">Temperatura</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((queue, index) => (
                <tr key={queue.id ?? "none"}>
                  <td data-label="Fila">
                    <span className={styles.queueName}>
                      <span className={styles.seriesDot} data-series={(index % 6) + 1} aria-hidden="true" />
                      <span className={styles.truncate} title={queue.name}>{queue.name}</span>
                    </span>
                  </td>
                  <td data-label="Entraram" className={styles.numCol}><LiteNumber value={queue.arrived} /></td>
                  <td data-label="Qualificados" className={styles.numCol}><LiteNumber value={queue.qualified} /></td>
                  <td data-label="Frios" className={styles.numCol}><LiteNumber value={queue.cold} /></td>
                  <td data-label="Requalificação" className={styles.requalCell}>
                    <span className={styles.requalMain}>{plural(queue.requalification.attempts, "tentativa", "tentativas")}</span>
                    <span className={styles.requalDetail}>{n(queue.requalification.coldLeads)} frios: {n(queue.requalification.once)} com 1, {n(queue.requalification.twice)} com 2, {n(queue.requalification.threePlus)} com 3+</span>
                  </td>
                  <td data-label="Em qualificação" className={styles.numCol}><LiteNumber value={queue.inQualification} /></td>
                  <td data-label="Temperatura"><StackedTemperature queue={queue} delay={staggerDelay(index)} /></td>
                </tr>
              ))}
              <tr className={styles.totalRow}>
                <td data-label="Total">Total</td>
                <td data-label="Entraram" className={styles.numCol}><LiteNumber value={totals.arrived} /></td>
                <td data-label="Qualificados" className={styles.numCol}><LiteNumber value={totals.qualified} /></td>
                <td data-label="Frios" className={styles.numCol}><LiteNumber value={totals.cold} /></td>
                <td data-label="Requalificação" className={styles.requalCell}>
                  <span className={styles.requalMain}>{plural(totals.requalification.attempts, "tentativa", "tentativas")}</span>
                  <span className={styles.requalDetail}>{n(totals.requalification.coldLeads)} frios: {n(totals.requalification.once)} com 1, {n(totals.requalification.twice)} com 2, {n(totals.requalification.threePlus)} com 3+</span>
                </td>
                <td data-label="Em qualificação" className={styles.numCol}><LiteNumber value={totals.inQualification} /></td>
                <td data-label="Temperatura"><StackedTemperature queue={totals} delay={0} /></td>
              </tr>
            </tbody>
          </table>
          <p className={styles.hint}>
            Qualificados = quentes + mornos. Em qualificação = leads que ainda não têm temperatura, para a conta fechar. Requalificação = tentativas de WhatsApp enviadas aos frios; cada frio conta uma vez na faixa da sua tentativa mais alta.
          </p>
        </div>
      ) : (
        <div className={styles.cardEmpty}>
          <EmptyState icon={<Inbox aria-hidden="true" />} title="Nenhum lead nesta janela" description="Quando um lead chegar, ele aparece aqui, por fila." />
        </div>
      )}
    </LiteReveal>
  );
}

function WhatsAppBlock({ whatsapp, label }: { whatsapp: EssentialDashboard["whatsapp"]; label: string }) {
  return (
    <LiteReveal as="section" className={styles.card} label="WhatsApp dos corretores" delay={staggerDelay(2)}>
      <header className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle}>WhatsApp dos corretores</h2>
          <p className={styles.cardDescription}>Corretores com WhatsApp pessoal conectado, {label}.</p>
        </div>
        <Help
          label="Como ler os números do WhatsApp"
          lines={[
            "Recebidos: leads entregues a corretores conectados na janela.",
            "Respondendo: desses, o cliente mandou mensagem pelo WhatsApp do corretor. A porcentagem é respondendo sobre recebidos.",
            "Atendimentos ativos: leads abertos, sem ganho nem perda, com mensagem do cliente nas últimas 24h.",
          ]}
        />
      </header>
      <div className={styles.cardBody}>
        <p className={styles.headline}>
          <LiteNumber value={whatsapp.connected} className={styles.headlineValue} />
          <span>de {n(whatsapp.total)} {whatsapp.total === 1 ? "corretor conectou" : "corretores conectaram"} o WhatsApp pessoal</span>
        </p>
        <div className={styles.dutyNumbers}>
          <Stat label="recebidos" value={whatsapp.received} />
          <Stat label={`respondendo · ${whatsapp.responseRate}%`} value={whatsapp.responding} />
          <Stat label="atendimentos ativos" value={whatsapp.active} />
        </div>
        {whatsapp.brokers.length ? (
          <ul className={styles.nameList} aria-label="Corretores conectados, com atendimentos ativos">
            {whatsapp.brokers.map((broker, index) => (
              <LiteItem as="li" key={broker.id} index={index}>
                <Link href={`/conversas?tab=leads&brokerId=${encodeURIComponent(broker.id)}`} className={styles.nameRow} title={`Ver conversas de ${broker.name}`}>
                  <span className={styles.truncate}>{broker.name}</span>
                  <span className={styles.tabular}>{plural(broker.active, "ativo", "ativos")} · {n(broker.responding)} de {n(broker.received)} respondendo</span>
                  <ArrowRight aria-hidden="true" size={14} className={styles.arrow} />
                </Link>
              </LiteItem>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<MessagesSquare aria-hidden="true" />} title="Nenhum corretor conectou o WhatsApp" description="Quem conectar o WhatsApp pessoal aparece aqui com os atendimentos." />
        )}
      </div>
    </LiteReveal>
  );
}

/** O painel: blocos de cima para baixo. Só o bloco 2 segue o período; o 1 e o 3 são "agora". */
export function EssentialView({ data }: { data: EssentialDashboard }) {
  return (
    <div className={styles.essential}>
      <DutiesBlock running={data.duties.running} next={data.duties.next} />
      <QueuesBlock rows={data.queues.rows} totals={data.queues.totals} label={data.queues.label} empty={data.queues.totals.arrived === 0} />
      <WhatsAppBlock whatsapp={data.whatsapp} label={data.whatsapp.label} />
    </div>
  );
}
