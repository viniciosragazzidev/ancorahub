"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Avatar } from "@/components/arc/avatar/avatar";
import { AssistantAvatar } from "@/components/chat/assistant-avatar";
import { Badge } from "@/components/arc/badge/badge";
import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { revokeInviteAction, resendInviteAction } from "@/app/(dashboard)/equipe/actions";
import { decideBrokerTransferAction, type PendingTransferRequest } from "@/features/supervisor-workspace/transfer-actions";
import { TeamInviteLiteSheet } from "@/features/team/team-invite-lite-sheet";
import type { ManagerLiteTeamData } from "./manager-lite-team-queries";
import styles from "@/features/supervisor-workspace/my-team-page.module.css";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "medium", timeStyle: "short" });
const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045, delayChildren: 0.025 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const } },
};

export function ManagerLiteTeam({ initialData, initialTransfers }: { initialData: ManagerLiteTeamData; initialTransfers: PendingTransferRequest[] }) {
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState("");
  const [pending, startTransition] = useTransition();
  const [requests, setRequests] = useState(initialTransfers);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const reducedMotion = useReducedMotion() ?? false;
  const members = useMemo(() => initialData.members.filter((member) => member.name.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"))), [initialData.members, query]);

  function invoke(action: typeof resendInviteAction, invitationId: string) {
    setFeedback("");
    const form = new FormData();
    form.set("invitationId", invitationId);
    startTransition(async () => {
      const result = await action({}, form);
      setFeedback(result.error ?? result.message ?? (result.success ? "Ação concluída." : "Não foi possível concluir a ação."));
      if (result.success) window.location.reload();
    });
  }

  function decideTransfer(requestId: string, approve: boolean) {
    setFeedback("");
    setActiveRequestId(requestId);
    startTransition(async () => {
      const result = await decideBrokerTransferAction(requestId, approve);
      setActiveRequestId(null);
      if (!result.ok) {
        setFeedback(result.reason);
        return;
      }
      setRequests((current) => current.filter((request) => request.id !== requestId));
      setFeedback(approve ? "Transferência aprovada." : "Pedido recusado.");
    });
  }

  return (
    <motion.div
      className={`arc-venancor ${styles.page}`}
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0.12 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      aria-labelledby="manager-team-title"
    >
      <div className={styles.inner}>
        <header className={styles.pageHeader}>
          <div>
            <h1 id="manager-team-title">Equipe da unidade</h1>
            <p className={styles.muted}>{initialData.unitName ?? "Unidade não configurada"}</p>
          </div>
          {initialData.unitBranchId ? <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" render={<Link href={`/unidades/${encodeURIComponent(initialData.unitBranchId)}`} />}>Ver resumo da unidade</Button>
            <TeamInviteLiteSheet audience="manager" branchId={initialData.unitBranchId} branchName={initialData.unitName} unassignedBrokers={initialData.unassignedBrokers} />
          </div> : null}
        </header>

        <section className={`${styles.teamHero} ${styles.unitHero}`} aria-label="Resumo dos corretores">
          <div className={styles.heroText}><h2>Corretores da unidade</h2><p>Consulte a operação e abra o perfil de cada corretor.</p></div>
          <div className={styles.overview}>
            <span><motion.strong key={`brokers-${initialData.counts.brokers}`} initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0.12 : 0.2 }}>{initialData.counts.brokers}</motion.strong> corretores ativos</span>
            <span><motion.strong key={`service-${initialData.counts.inService}`} initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0.12 : 0.2 }}>{initialData.counts.inService}</motion.strong> em atendimento</span>
            <span data-alert={initialData.counts.late > 0}><motion.strong key={`late-${initialData.counts.late}`} initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0.12 : 0.2 }}>{initialData.counts.late}</motion.strong> atrasados</span>
          </div>
        </section>

        {!initialData.unitBranchId ? (
          <EmptyState title="Sua unidade ainda não está configurada" description="Peça ao administrador para vincular seu acesso a uma unidade." icon={<AssistantAvatar shape="mochi" hue={150} size={72} state="working" />} />
        ) : null}

        {requests.length ? (
          <motion.section
            className={styles.section}
            aria-labelledby="transfer-requests-title"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reducedMotion ? { duration: 0.12 } : { duration: 0.2, delay: 0.04 }}
          >
            <div className={styles.sectionTitle}>
              <h2 id="transfer-requests-title">Pedidos de transferência</h2>
              <span>{requests.length} pendentes</span>
            </div>
            <motion.ul className={styles.list} variants={listVariants} initial="hidden" animate="visible">
              {requests.map((request) => (
                <motion.li key={request.id} className={`${styles.memberCard} ${styles.unitTransferCard}`} variants={reducedMotion ? undefined : itemVariants}>
                  <div className={styles.heroText}>
                    <h2>{request.brokerName}</h2>
                    <p>{request.fromSupervisorName} para {request.toSupervisorName}</p>
                    <p>{request.reason}</p>
                    <small className={styles.muted}>{dateFormat.format(new Date(request.createdAt))}</small>
                  </div>
                  <div className={`${styles.brokerActions} ${styles.unitTransferActions}`}>
                    <Button size="sm" disabled={pending} loading={pending && activeRequestId === request.id} onClick={() => decideTransfer(request.id, true)}>Aprovar</Button>
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => decideTransfer(request.id, false)}>Recusar</Button>
                  </div>
                </motion.li>
              ))}
            </motion.ul>
          </motion.section>
        ) : null}

        {initialData.supervisorInvites.length ? (
          <section className={styles.section} aria-labelledby="supervisor-invites-title">
            <div className={styles.sectionTitle}><h2 id="supervisor-invites-title">Convites para supervisores</h2><span>{initialData.supervisorInvites.length} pendentes</span></div>
            <motion.ul className={styles.list} variants={listVariants} initial="hidden" animate="visible">
              {initialData.supervisorInvites.map((invite) => (
                <motion.li key={invite.id} className={styles.row} variants={reducedMotion ? undefined : itemVariants}>
                  <span>{invite.name}<small>Supervisor · {invite.email || "sem e-mail"}</small></span>
                  <div className={styles.brokerActions}>
                    <Button variant="outline" size="sm" disabled={pending} onClick={() => invoke(resendInviteAction, invite.id)}>Reenviar</Button>
                    <Button variant="ghost" size="sm" disabled={pending} onClick={() => invoke(revokeInviteAction, invite.id)}>Cancelar</Button>
                  </div>
                </motion.li>
              ))}
            </motion.ul>
          </section>
        ) : null}

        <Input aria-label="Buscar corretor por nome" placeholder="Buscar corretor" value={query} onChange={(event) => setQuery(event.target.value)} />
        {feedback ? <motion.p className={styles.feedback} role="status" aria-live="polite" initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0.12 : 0.2 }}>{feedback}</motion.p> : null}

        {members.length ? (
          <motion.ul className={styles.list} variants={listVariants} initial="hidden" animate="visible">
            {members.map((member) => (
              <motion.li key={member.id} className={styles.memberCard} data-attention={member.late > 0} variants={reducedMotion ? undefined : itemVariants} whileTap={reducedMotion ? undefined : { scale: 0.995 }}>
                {member.status === "pending" ? (
                  <div className={styles.memberLink}><Avatar name={member.name} src={member.image ?? undefined} size="lg" className={styles.avatar} /><span>{member.name}<small><Badge size="sm">Convite pendente</Badge></small></span></div>
                ) : (
                  <Link className={styles.memberLink} href={`/equipe/${encodeURIComponent(member.userId ?? member.id)}`}>
                    <Avatar name={member.name} src={member.image ?? undefined} size="lg" status={member.availability === "available" || member.availability === "on_duty" ? "online" : "offline"} className={styles.avatar} />
                    <span>{member.name}<small><Badge tone={member.status === "disabled" ? "danger" : member.availability === "available" || member.availability === "on_duty" ? "success" : "neutral"} size="sm">{member.status === "disabled" ? "Desativado" : member.availability === "available" ? "Disponível" : member.availability === "on_duty" ? "Em plantão" : member.availability === "paused" ? "Pausado" : "Fora do ar"}</Badge></small></span>
                  </Link>
                )}
                <div className={styles.memberNumbers}><span><strong>{member.inService}</strong> em atendimento</span>{member.late > 0 ? <Badge tone="danger" size="sm">Atrasado · {member.late}</Badge> : null}</div>
                <BottomSheet className="arc-venancor" trigger={<button type="button" className={styles.memberMenuTrigger} aria-label={`Ações de ${member.name}`}>•••</button>} title={`Ações de ${member.name}`} description="Escolha uma ação para este corretor." closeLabel="Fechar" detents={[0.38, 0.7]}>
                  <nav className={styles.sheetList} aria-label="Ações do corretor">
                    {member.status !== "pending" ? <Link href={`/equipe/${encodeURIComponent(member.userId ?? member.id)}`} className={styles.sheetRow}><span>Ver perfil</span><small>Informações e operação</small></Link> : null}
                    {member.userId ? <Link href={`/relacionamento?brokerId=${encodeURIComponent(member.userId)}`} className={styles.sheetRow}><span>Mandar recado</span><small>Pela Central de relacionamento</small></Link> : null}
                    {member.status === "pending" && member.inviteId ? <div className={styles.sheetRow}>
                      <Button variant="outline" size="sm" disabled={pending} onClick={() => invoke(resendInviteAction, member.inviteId!)}>Reenviar convite</Button>
                      <Button variant="ghost" size="sm" disabled={pending} onClick={() => invoke(revokeInviteAction, member.inviteId!)}>Cancelar convite</Button>
                    </div> : null}
                  </nav>
                </BottomSheet>
              </motion.li>
            ))}
          </motion.ul>
        ) : initialData.unitBranchId ? (
          <EmptyState title={query ? "Nenhum corretor encontrado" : "Sua unidade ainda não tem corretores"} description={query ? "Tente buscar por outro nome." : "Os corretores da unidade aparecerão aqui."} icon={<AssistantAvatar shape="mochi" hue={150} size={72} state="working" />} />
        ) : null}
      </div>
    </motion.div>
  );
}
