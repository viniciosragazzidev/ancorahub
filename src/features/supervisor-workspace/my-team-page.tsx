"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { AssistantAvatar } from "@/components/chat/assistant-avatar";
import { Avatar } from "@/components/arc/avatar/avatar";
import { Badge } from "@/components/arc/badge/badge";
import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";

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

  return <div className={`arc-venancor ${styles.page}`} aria-labelledby="my-team-title">
    <div className={styles.inner}>
      <header className={styles.pageHeader}><h1 id="my-team-title">Minha equipe</h1></header>
      {data.team ? <section className={styles.teamHero} aria-label="Perfil da equipe" style={{ "--team-hue": `${teamAvatarHue(data.team.name)}` } as React.CSSProperties}>
        <Avatar name={data.team.name} src={data.team.imageUrl ?? undefined} size="xl" className={styles.teamImage} />
        <div className={styles.heroText}><h2>{data.team.name}</h2><p>{data.team.description || "Sua equipe de atendimento."}</p><Button variant="outline" size="sm" render={<Link href="/equipe/minha/configurar" />}>Configurar equipe</Button></div>
        <div className={styles.overview}><span><strong>{data.overview.brokers}</strong> corretores</span><span><strong>{data.overview.inService}</strong> em atendimento</span><span data-alert={data.overview.late > 0}><strong>{data.overview.late || "·"}</strong> atrasados</span></div>
      </section> : <EmptyState label="Equipe ainda não criada" title="Sua equipe começa com um bom plano" description="Crie o perfil da equipe e convide corretores da sua unidade." icon={<AssistantAvatar shape="mochi" hue={150} size={72} state="working" />} action={<Button render={<Link href="/equipe/minha/configurar" />}>Criar minha equipe</Button>} />}

      <SegmentedControl label="Seções da equipe" value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} options={[{ value: "members", label: "Membros", accessory: <Badge size="sm">{data.members.length}</Badge> }, { value: "invites", label: "Convites", accessory: <Badge size="sm">{data.invites.length}</Badge> }, { value: "unit", label: "Unidade", accessory: <Badge size="sm">{data.brokers.length}</Badge> }]} />
      {feedback ? <p className={styles.feedback} role="status" aria-live="polite">{feedback}</p> : null}

      {activeTab === "members" ? <section className={styles.section} aria-labelledby="team-members-title"><div className={styles.sectionTitle}><h2 id="team-members-title">Membros</h2></div>
        {data.members.length ? <ul className={styles.list}>{data.members.map((member) => <li key={member.id} className={styles.memberCard} data-attention={member.late > 0}>
          <Link className={styles.memberLink} href={`/equipe/${encodeURIComponent(member.id)}`}><Avatar name={member.name} src={member.imageUrl ?? undefined} size="lg" status={member.availability === "available" ? "online" : "offline"} className={`${styles.avatar} ${member.late ? styles.avatarAlert : ""}`} style={{ "--team-hue": `${teamAvatarHue(member.name)}` } as React.CSSProperties} /><span>{member.name}<small><Badge tone={member.availability === "available" ? "success" : "neutral"} size="sm">{member.availability === "available" ? "Disponível" : member.availability === "paused" ? "Pausado" : "Fora do ar"}</Badge></small></span></Link>
          <div className={styles.memberNumbers}><span><strong>{member.receivedToday || "·"}</strong> hoje</span><span><strong>{member.inService || "·"}</strong> em atendimento</span>{member.late ? <Badge tone="danger" size="sm">Precisa de você · {member.late}</Badge> : null}</div>
          <BottomSheet className="arc-venancor" trigger={<button type="button" className={styles.memberMenuTrigger} aria-label={`Ações de ${member.name}`}>•••</button>} title={`Ações de ${member.name}`} description="Escolha uma ação para este membro." closeLabel="Fechar" detents={[0.38, 0.7]}>
            <MemberSheetActions memberId={member.id} memberName={member.name} pending={pending} onRemove={() => removeMember(member.id)} />
          </BottomSheet>
        </li>)}</ul> : <EmptyState title="Sua equipe ainda não tem membros" description="Adicione alguém da sua unidade ou envie um convite." action={<Button variant="outline" onClick={() => setActiveTab("unit")}>Ver corretores da unidade</Button>} />}
      </section> : null}

      {activeTab === "invites" ? <section className={styles.section} aria-labelledby="team-invites-title"><div className={styles.sectionTitle}><h2 id="team-invites-title">Convites pendentes</h2></div>
        {data.invites.length ? <ul className={styles.list}>{data.invites.map((invite) => <li key={invite.id} className={styles.row}><span>{invite.brokerName}<small>Enviado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(invite.createdAt))}</small></span><Button variant="outline" size="sm" disabled={pending} onClick={() => cancelInvite(invite.id)}>Cancelar convite</Button></li>)}</ul> : <EmptyState title="Nenhum convite pendente" description="Os convites enviados para corretores aparecem aqui." />}
      </section> : null}

      {activeTab === "unit" ? <section className={styles.section} aria-labelledby="team-brokers-title"><div className={styles.sectionTitle}><h2 id="team-brokers-title">Corretores da sua unidade</h2></div>
        {data.brokers.length ? <ul className={styles.list}>{data.brokers.map((broker) => <li key={broker.id} className={styles.row}><span className={styles.memberLink}><Avatar name={broker.name} src={broker.imageUrl ?? undefined} size="md" className={styles.avatar} style={{ "--team-hue": `${teamAvatarHue(broker.name)}` } as React.CSSProperties} /><span>{broker.name}<small>{broker.supervisorName ? `Equipe de ${broker.supervisorName}` : "Livre para entrar na equipe"}</small></span></span>
          {broker.supervisorId ? <Link className={styles.textLink} href="/equipe/transferencia">Pedir transferência</Link> : broker.inviteId ? <Button variant="outline" size="sm" disabled>Convite pendente</Button> : <div className={styles.brokerActions}><Button size="sm" disabled={pending} onClick={() => addDirectly(broker.id)}>Adicionar</Button><Button variant="outline" size="sm" disabled={pending || !data.team} onClick={() => invite(broker.id)}>Convidar</Button></div>}
        </li>)}</ul> : <EmptyState title="Não há outros corretores ativos" description="Quando houver corretores disponíveis na sua unidade, eles aparecerão aqui." />}
      </section> : null}
    </div>
  </div>;
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
