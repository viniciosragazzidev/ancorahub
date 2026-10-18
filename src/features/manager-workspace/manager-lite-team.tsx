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
import { revokeInviteAction, resendInviteAction } from "@/app/(dashboard)/equipe/actions";
import { decideBrokerTransferAction, type PendingTransferRequest } from "@/features/supervisor-workspace/transfer-actions";
import { TeamInviteLiteSheet } from "@/features/team/team-invite-lite-sheet";
import { PeopleFilters, PeopleRow, PeopleSection } from "@/components/light/people-list/people-list";
import type { ManagerLiteTeamData } from "./manager-lite-team-queries";
import styles from "@/features/supervisor-workspace/my-team-page.module.css";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "medium", timeStyle: "short" });

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
          <PeopleSection id="transfer-requests-title" title="Pedidos de transferência" count={requests.length}>
            {requests.map((request, index) => (
              <PeopleRow
                key={request.id}
                index={index}
                name={request.brokerName}
                chip={`${request.fromSupervisorName} → ${request.toSupervisorName}`}
                preview={request.reason}
                meta={dateFormat.format(new Date(request.createdAt))}
                dot="waiting"
                dotLabel="Aguardando sua decisão"
                action={<div className={styles.brokerActions}>
                  <Button size="sm" disabled={pending} loading={pending && activeRequestId === request.id} onClick={() => decideTransfer(request.id, true)}>Aprovar</Button>
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => decideTransfer(request.id, false)}>Recusar</Button>
                </div>}
              />
            ))}
          </PeopleSection>
        ) : null}

        {initialData.supervisorInvites.length ? (
          <PeopleSection id="supervisor-invites-title" title="Convites para supervisores" count={initialData.supervisorInvites.length}>
            {initialData.supervisorInvites.map((invite, index) => (
              <PeopleRow
                key={invite.id}
                index={index}
                name={invite.name}
                chip="Supervisor"
                preview={invite.email || "sem e-mail"}
                action={<div className={styles.brokerActions}>
                  <Button variant="outline" size="sm" disabled={pending} onClick={() => invoke(resendInviteAction, invite.id)}>Reenviar</Button>
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => invoke(revokeInviteAction, invite.id)}>Cancelar</Button>
                </div>}
              />
            ))}
          </PeopleSection>
        ) : null}

        <PeopleFilters search={query} onSearch={setQuery} searchPlaceholder="Buscar corretor por nome" />
        {feedback ? <motion.p className={styles.feedback} role="status" aria-live="polite" initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0.12 : 0.2 }}>{feedback}</motion.p> : null}

        {members.length ? (
          <PeopleSection id="unit-members-title" title="Corretores" count={members.length}>
            {members.map((member, index) => {
              const online = member.availability === "available" || member.availability === "on_duty";
              const label = member.status === "pending" ? "Convite pendente" : member.status === "disabled" ? "Desativado" : member.availability === "available" ? "Disponível" : member.availability === "on_duty" ? "Em plantão" : member.availability === "paused" ? "Pausado" : "Fora do ar";
              const tone = member.status === "disabled" ? "danger" : member.status !== "pending" && online ? "success" : "neutral";
              return (
                <PeopleRow
                  key={member.id}
                  index={index}
                  href={member.status === "pending" ? undefined : `/equipe/${encodeURIComponent(member.userId ?? member.id)}`}
                  name={member.name}
                  avatar={member.image ? <Avatar name={member.name} src={member.image} size="lg" status={member.status === "pending" ? undefined : online ? "online" : "offline"} /> : undefined}
                  chip={<Badge tone={tone} size="sm">{label}</Badge>}
                  preview={[`${member.inService} em atendimento`, member.late > 0 ? `${member.late} atrasado${member.late === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ")}
                  previewTone={member.late > 0 ? "alert" : "muted"}
                  dot={member.late > 0 ? "alert" : null}
                  dotLabel={member.late > 0 ? "Tem lead atrasado" : undefined}
                  action={<BottomSheet className="arc-venancor" trigger={<button type="button" className={styles.memberMenuTrigger} aria-label={`Ações de ${member.name}`}>•••</button>} title={`Ações de ${member.name}`} description="Escolha uma ação para este corretor." closeLabel="Fechar" detents={[0.38, 0.7]}>
                    <nav className={styles.sheetList} aria-label="Ações do corretor">
                      {member.status !== "pending" ? <Link href={`/equipe/${encodeURIComponent(member.userId ?? member.id)}`} className={styles.sheetRow}><span>Ver perfil</span><small>Informações e operação</small></Link> : null}
                      {member.userId ? <Link href={`/relacionamento?brokerId=${encodeURIComponent(member.userId)}`} className={styles.sheetRow}><span>Mandar recado</span><small>Pela Central de relacionamento</small></Link> : null}
                      {member.status === "pending" && member.inviteId ? <div className={styles.sheetRow}>
                        <Button variant="outline" size="sm" disabled={pending} onClick={() => invoke(resendInviteAction, member.inviteId!)}>Reenviar convite</Button>
                        <Button variant="ghost" size="sm" disabled={pending} onClick={() => invoke(revokeInviteAction, member.inviteId!)}>Cancelar convite</Button>
                      </div> : null}
                    </nav>
                  </BottomSheet>}
                />
              );
            })}
          </PeopleSection>
        ) : initialData.unitBranchId ? (
          <EmptyState title={query ? "Nenhum corretor encontrado" : "Sua unidade ainda não tem corretores"} description={query ? "Tente buscar por outro nome." : "Os corretores da unidade aparecerão aqui."} icon={<AssistantAvatar shape="mochi" hue={150} size={72} state="working" />} />
        ) : null}
      </div>
    </motion.div>
  );
}
