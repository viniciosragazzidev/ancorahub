"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { motion, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import { AssistantAvatar } from "@/components/chat/assistant-avatar";
import { Avatar } from "@/components/arc/avatar/avatar";
import { Badge } from "@/components/arc/badge/badge";
import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { resendInviteAction, revokeInviteAction } from "@/app/(dashboard)/equipe/actions";
import { TeamInviteLiteSheet } from "@/features/team/team-invite-lite-sheet";

import { addBrokerToMyTeamAction } from "./actions";
import { cancelMyTeamInviteAction, inviteBrokerToMyTeamAction, removeBrokerFromMyTeamAction } from "./my-team-actions";
import type { SupervisorTeamPageData } from "./my-team-queries";
import styles from "./my-team-page.module.css";

export function teamAvatarHue(name: string) {
  let hash = 0;
  for (const character of name.trim().toLocaleLowerCase("pt-BR")) hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  return hash % 360;
}

export function MyTeamPage({ initialData }: { initialData: SupervisorTeamPageData }) {
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState<"members" | "invites" | "unit">("members");
  const [feedback, setFeedback] = useState("");
  const [pending, startTransition] = useTransition();
  const reducedMotion = useReducedMotion() ?? false;
  const listVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.04 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 7 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const } },
  };

  function runAction(action: () => Promise<{ ok: boolean; message: string }>, onSuccess?: () => void) {
    setFeedback("");
    startTransition(async () => {
      const result = await action();
      setFeedback(result.message);
      if (result.ok) onSuccess?.();
    });
  }
  function removeMember(brokerId: string) {
    runAction(() => removeBrokerFromMyTeamAction(brokerId), () => window.location.reload());
  }
  function invite(brokerId: string) {
    runAction(() => inviteBrokerToMyTeamAction({ brokerId }), () => window.location.reload());
  }
  function addDirectly(brokerId: string) {
    runAction(() => addBrokerToMyTeamAction(brokerId), () => window.location.reload());
  }
  function cancelInvite(inviteId: string) {
    runAction(() => cancelMyTeamInviteAction(inviteId), () => setData((current) => ({ ...current, invites: current.invites.filter((item) => item.id !== inviteId), brokers: current.brokers.map((item) => item.inviteId === inviteId ? { ...item, inviteId: null } : item) })));
  }
  function manageAccessInvite(action: typeof resendInviteAction | typeof revokeInviteAction, invitationId: string) {
    setFeedback("");
    const formData = new FormData();
    formData.set("invitationId", invitationId);
    startTransition(async () => {
      const result = await action({}, formData);
      const success = result.success === true;
      setFeedback(success ? (action === resendInviteAction ? "Convite reenviado." : "Convite cancelado.") : result.error ?? "Não foi possível atualizar o convite.");
      if (success) window.location.reload();
    });
  }

  return <motion.div className={`arc-venancor ${styles.page}`} aria-labelledby="my-team-title" initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={reducedMotion ? { duration: 0.12 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
    <div className={styles.inner}>
      <header className={styles.pageHeader}><h1 id="my-team-title" className="sr-only">Minha equipe</h1><TeamInviteLiteSheet audience="supervisor" branchId={data.branchId} branchName={data.branchName} /></header>
      {data.team ? <motion.section className={styles.teamHero} aria-label="Perfil da equipe" style={{ "--team-hue": `${teamAvatarHue(data.team.name)}` } as React.CSSProperties} initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} transition={reducedMotion ? { duration: 0.12 } : { duration: 0.2, delay: 0.04 }}>
        <Avatar name={data.team.name} src={data.team.imageUrl ?? undefined} size="xl" className={styles.teamImage} />
        <div className={styles.heroText}><h2>{data.team.name}</h2><p>{data.team.description || "Sua equipe de atendimento."}</p><Button variant="outline" size="sm" render={<Link href="/equipe/minha/configurar" />}>Configurar equipe</Button></div>
        <div className={styles.overview}><span><motion.strong key={`brokers-${data.overview.brokers}`} initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0.12 : 0.2 }}>{data.overview.brokers}</motion.strong> corretores</span><span><motion.strong key={`service-${data.overview.inService}`} initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0.12 : 0.2 }}>{data.overview.inService}</motion.strong> em atendimento</span><span data-alert={data.overview.late > 0}><motion.strong key={`late-${data.overview.late}`} initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0.12 : 0.2 }}>{data.overview.late || "·"}</motion.strong> atrasados</span></div>
        {data.ranking ? <p className={styles.teamRanking} aria-label={`Sua equipe está em ${data.ranking.position}º lugar na unidade${data.ranking.positionChange ? `, ${data.ranking.positionChange > 0 ? `subiu ${data.ranking.positionChange}` : `desceu ${Math.abs(data.ranking.positionChange)}`} posições` : ""}`}>
          Sua equipe está em <strong>Nº {data.ranking.position}</strong> na unidade
          {data.ranking.positionChange === null ? null : data.ranking.positionChange > 0 ? <span data-change="up" aria-label={`Subiu ${data.ranking.positionChange} posições`}> ↑ {data.ranking.positionChange}</span> : data.ranking.positionChange < 0 ? <span data-change="down" aria-label={`Desceu ${Math.abs(data.ranking.positionChange)} posições`}> ↓ {Math.abs(data.ranking.positionChange)}</span> : <span data-change="same" aria-label="Manteve a posição"> ↔</span>}
        </p> : null}
      </motion.section> : <EmptyState label="Equipe ainda não criada" title="Sua equipe começa com um bom plano" description="Crie o perfil da equipe e convide corretores da sua unidade." icon={<AssistantAvatar shape="mochi" hue={150} size={72} state="working" />} action={<Button render={<Link href="/equipe/minha/configurar" />}>Criar minha equipe</Button>} />}

      <SegmentedControl label="Seções da equipe" value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} options={[{ value: "members", label: "Membros", accessory: <Badge size="sm">{data.members.length}</Badge> }, { value: "invites", label: "Convites", accessory: <Badge size="sm">{data.invites.length + data.pendingAccessInvites.length}</Badge> }, { value: "unit", label: "Unidade", accessory: <Badge size="sm">{data.brokers.length}</Badge> }]} />
      {feedback ? <motion.p className={styles.feedback} role="status" aria-live="polite" initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0.12 : 0.2 }}>{feedback}</motion.p> : null}

      {activeTab === "members" ? <section className={styles.section} aria-labelledby="team-members-title"><h2 id="team-members-title" className="sr-only">Membros</h2>
        {data.members.length ? <motion.ul className={styles.list} variants={listVariants} initial={reducedMotion ? false : "hidden"} animate="visible">{data.members.map((member) => <motion.li key={member.id} className={styles.memberCard} data-attention={member.late > 0} variants={reducedMotion ? undefined : itemVariants} whileTap={reducedMotion ? undefined : { scale: 0.995 }}>
          <Link className={styles.memberLink} href={`/equipe/${encodeURIComponent(member.id)}`}><Avatar name={member.name} src={member.imageUrl ?? undefined} size="lg" status={member.availability === "available" ? "online" : "offline"} className={styles.avatar} style={{ "--team-hue": `${teamAvatarHue(member.name)}` } as React.CSSProperties} /><span>{member.name}<small><Badge tone={member.availability === "available" ? "success" : "neutral"} size="sm">{member.availability === "available" ? "Disponível" : member.availability === "paused" ? "Pausado" : "Fora do ar"}</Badge></small></span></Link>
          <div className={styles.memberNumbers}><span><strong>{member.receivedToday}</strong> hoje</span><span><strong>{member.inService}</strong> em atendimento</span>{member.late ? <Badge tone="warning" size="sm">{member.late === 1 ? "1 atrasado" : `${member.late} atrasados`}</Badge> : null}</div>
          <BottomSheet className="arc-venancor" trigger={<button type="button" className={styles.memberMenuTrigger} aria-label={`Ações de ${member.name}`}>•••</button>} title={`Ações de ${member.name}`} description="Escolha uma ação para este membro." closeLabel="Fechar" detents={[0.38, 0.7]}>
            <MemberSheetActions memberId={member.id} memberName={member.name} pending={pending} onRemove={() => removeMember(member.id)} />
          </BottomSheet>
        </motion.li>)}</motion.ul> : <EmptyState title="Sua equipe ainda não tem membros" description="Adicione alguém da sua unidade ou envie um convite." icon={<AssistantAvatar shape="mochi" hue={150} size={72} state="working" />} action={<Button variant="outline" onClick={() => setActiveTab("unit")}>Ver corretores da unidade</Button>} />}
      </section> : null}

      {activeTab === "invites" ? <section className={styles.section} aria-labelledby="team-invites-title"><div className={styles.sectionTitle}><h2 id="team-invites-title">Convites pendentes</h2></div>
        {data.invites.length || data.pendingAccessInvites.length ? <motion.ul className={styles.list} variants={listVariants} initial={reducedMotion ? false : "hidden"} animate="visible">
          {data.pendingAccessInvites.map((invite) => <motion.li key={invite.id} className={styles.row} variants={reducedMotion ? undefined : itemVariants}><span>{invite.brokerName}<small>Primeiro acesso · {invite.email ?? "sem e-mail"} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(invite.createdAt))}</small></span><div className={styles.brokerActions}><Button variant="outline" size="sm" disabled={pending} onClick={() => manageAccessInvite(resendInviteAction, invite.id)}>Reenviar</Button><Button variant="ghost" size="sm" disabled={pending} onClick={() => manageAccessInvite(revokeInviteAction, invite.id)}>Cancelar</Button></div></motion.li>)}
          {data.invites.map((invite) => <motion.li key={invite.id} className={styles.row} variants={reducedMotion ? undefined : itemVariants}><span>{invite.brokerName}<small>Convite para entrar na equipe · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(invite.createdAt))}</small></span><Button variant="outline" size="sm" disabled={pending} onClick={() => cancelInvite(invite.id)}>Cancelar convite</Button></motion.li>)}
        </motion.ul> : <EmptyState title="Nenhum convite pendente" description="Os convites enviados para corretores aparecem aqui." icon={<AssistantAvatar shape="mochi" hue={150} size={72} state="working" />} />}
      </section> : null}

      {activeTab === "unit" ? <section className={styles.section} aria-labelledby="team-brokers-title"><div className={styles.sectionTitle}><h2 id="team-brokers-title">Corretores da sua unidade</h2></div>
        {data.brokers.length ? <motion.ul className={styles.list} variants={listVariants} initial={reducedMotion ? false : "hidden"} animate="visible">{data.brokers.map((broker) => <motion.li key={broker.id} className={styles.row} variants={reducedMotion ? undefined : itemVariants}><span className={styles.memberLink}><Avatar name={broker.name} src={broker.imageUrl ?? undefined} size="md" className={styles.avatar} style={{ "--team-hue": `${teamAvatarHue(broker.name)}` } as React.CSSProperties} /><span>{broker.name}<small>{broker.supervisorName ? `Equipe de ${broker.supervisorName}` : "Livre para entrar na equipe"}</small></span></span>
          {broker.supervisorId ? <Link className={styles.textLink} href="/equipe/transferencia">Pedir transferência</Link> : broker.inviteId ? <Button variant="outline" size="sm" disabled>Convite pendente</Button> : <div className={styles.brokerActions}><Button size="sm" disabled={pending} onClick={() => addDirectly(broker.id)}>Adicionar</Button><Button variant="outline" size="sm" disabled={pending || !data.team} onClick={() => invite(broker.id)}>Convidar</Button></div>}
        </motion.li>)}</motion.ul> : <EmptyState title="Não há outros corretores ativos" description="Quando houver corretores disponíveis na sua unidade, eles aparecerão aqui." icon={<AssistantAvatar shape="mochi" hue={150} size={72} state="working" />} />}
      </section> : null}
    </div>
  </motion.div>;
}

const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** Member actions in the sheet: shortcuts first, removal behind a confirmation step. */
function MemberSheetActions({ memberId, memberName, pending, onRemove }: { memberId: string; memberName: string; pending: boolean; onRemove: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const id = encodeURIComponent(memberId);
  return (
    <div className={styles.sheetActions}>
      <nav className={styles.sheetList} aria-label="Atalhos">
        <Link href={`/equipe/${id}`} className={styles.sheetRow}><span>Ver perfil</span><small>Números, leads e notas de {firstNameOf(memberName)}</small></Link>
        <Link href={`/relacionamento?brokerId=${id}`} className={styles.sheetRow}><span>Mandar recado</span><small>Pela Central de relacionamento</small></Link>
        <Link href={`/relacionamento?brokerId=${id}&action=recognition`} className={styles.sheetRow}><span>Reconhecer</span><small>Um elogio que ele recebe no app</small></Link>
      </nav>
      {confirming ? (
        <div className={styles.sheetDanger} role="group" aria-label="Confirmar remoção">
          <p>Tirar {firstNameOf(memberName)} da sua equipe? Ele volta a ficar livre na unidade e o histórico de leads é mantido.</p>
          <div className={styles.sheetDangerActions}>
            <Button variant="ghost" onClick={() => setConfirming(false)}>Voltar</Button>
            <Button variant="destructive" disabled={pending} onClick={onRemove}>Sim, remover</Button>
          </div>
        </div>
      ) : (
        <button type="button" className={styles.sheetRemove} onClick={() => setConfirming(true)}>Remover da equipe</button>
      )}
    </div>
  );
}
