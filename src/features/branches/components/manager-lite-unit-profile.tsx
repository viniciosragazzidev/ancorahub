"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { AssistantAvatar } from "@/components/chat/assistant-avatar";
import { Avatar } from "@/components/arc/avatar/avatar";
import { Badge } from "@/components/arc/badge/badge";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { PeriodSelect } from "@/components/period-select";
import { Button } from "@/components/ui/button";
import type { BranchProfileData } from "@/features/branches/queries";
import type { PeriodValue } from "@/shared/period";
import styles from "@/features/supervisor-workspace/my-team-page.module.css";

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045, delayChildren: 0.025 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 7 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const } },
};

export function ManagerLiteUnitProfile({ data, period }: { data: BranchProfileData; period: PeriodValue }) {
  const reducedMotion = useReducedMotion() ?? false;
  const { branch, metrics, members, topBrokers } = data;

  return (
    <motion.div
      className={`arc-venancor ${styles.page}`}
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0.12 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      aria-labelledby="manager-unit-title"
    >
      <main className={styles.inner}>
        <header className={styles.pageHeader}>
          <div>
            <Button variant="ghost" size="sm" render={<Link href="/equipe" />} className="mb-2">Voltar para a equipe</Button>
            <h1 id="manager-unit-title">Minha unidade</h1>
            <p className={styles.muted}>{branch.name}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge>{branch.status === "active" ? "Ativa" : "Inativa"}</Badge>
              <Badge>{branch.acceptingLeads ? "Recebendo leads" : "Pausada para leads"}</Badge>
            </div>
          </div>
          <PeriodSelect value={period} />
        </header>

        <section className={styles.section} aria-labelledby="unit-metrics-title">
          <div className={styles.sectionTitle}><h2 id="unit-metrics-title">Resumo da unidade</h2><span>{metrics.period}</span></div>
          <div className={styles.overview}>
            <span><motion.strong key={`leads-${metrics.totalLeads}`} initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0.12 : 0.2 }}>{metrics.totalLeads}</motion.strong> Leads no período</span>
            <span><motion.strong key={`conversion-${metrics.taxaConversao}`} initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0.12 : 0.2 }}>{metrics.taxaConversao}%</motion.strong> Conversão</span>
            <span><motion.strong key={`active-${metrics.leadsAtivos}`} initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0.12 : 0.2 }}>{metrics.leadsAtivos}</motion.strong> Em atendimento</span>
            <span><motion.strong key={`distributed-${metrics.leadsDistribuidos}`} initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0.12 : 0.2 }}>{metrics.leadsDistribuidos}</motion.strong> Aguardando contato</span>
          </div>
        </section>

        <motion.section
          className={styles.section}
          aria-labelledby="unit-members-title"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 7 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reducedMotion ? { duration: 0.12 } : { duration: 0.2, delay: 0.04 }}
        >
          <div className={styles.sectionTitle}><h2 id="unit-members-title">Membros da unidade</h2><span>{members?.length ?? 0}</span></div>
          {members?.length ? (
            <motion.ul className={styles.list} variants={listVariants} initial="hidden" animate="visible">
              {members.map((member) => (
                <motion.li key={member.userId} className={styles.row} variants={reducedMotion ? undefined : itemVariants}>
                  {member.role === "broker" ? (
                    <Link href={`/equipe/${encodeURIComponent(member.userId)}`} className={styles.memberLink}>
                      <Avatar name={member.name} size="md" className={styles.avatar} />
                      <span>{member.name}<small>{member.activeLeads} leads ativos</small></span>
                    </Link>
                  ) : (
                    <span className={styles.memberLink}>
                      <Avatar name={member.name} size="md" className={styles.avatar} />
                      <span>{member.name}<small>{member.activeLeads} leads ativos</small></span>
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <Badge>{member.role === "broker" ? "Corretor" : member.role === "supervisor" ? "Supervisor" : member.role === "manager" ? "Gestor" : "Diretor"}</Badge>
                    <Badge>{member.availabilityStatus === "available" ? "Disponível" : "Pausado"}</Badge>
                  </div>
                </motion.li>
              ))}
            </motion.ul>
          ) : <EmptyState title="Sua unidade ainda não tem membros" description="Os membros ativos da unidade aparecerão aqui." icon={<AssistantAvatar shape="mochi" hue={150} size={72} state="working" />} />}
        </motion.section>

        <motion.section
          className={styles.section}
          aria-labelledby="unit-ranking-title"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 7 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reducedMotion ? { duration: 0.12 } : { duration: 0.2, delay: 0.08 }}
        >
          <div className={styles.sectionTitle}><h2 id="unit-ranking-title">Top corretores</h2><span>{metrics.period}</span></div>
          {topBrokers?.length ? (
            <motion.ol className={styles.list} variants={listVariants} initial="hidden" animate="visible" aria-label="Ranking de corretores por conversão">
              {topBrokers.map((broker, index) => (
                <motion.li key={broker.userId} className={styles.row} variants={reducedMotion ? undefined : itemVariants}>
                  <Link href={`/equipe/${encodeURIComponent(broker.userId)}`} className={styles.memberLink}>
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--surface)] text-sm tabular-nums">{index + 1}</span>
                    <Avatar name={broker.name} size="md" className={styles.avatar} />
                    <span>{broker.name}<small>{broker.converted} de {broker.totalLeads} leads convertidos</small></span>
                  </Link>
                  <Badge>{broker.conversionRate}%</Badge>
                </motion.li>
              ))}
            </motion.ol>
          ) : <EmptyState title="Ranking sem dados neste período" description="A conversão dos corretores aparecerá quando houver leads no período." icon={<AssistantAvatar shape="mochi" hue={150} size={72} state="working" />} />}
        </motion.section>
      </main>
    </motion.div>
  );
}
