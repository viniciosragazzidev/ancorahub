"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import { AssistantAvatar } from "@/components/chat/assistant-avatar";
import { Avatar } from "@/components/arc/avatar/avatar";
import { Badge } from "@/components/arc/badge/badge";
import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { SearchField } from "@/components/arc/search-field/search-field";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { resendInviteAction, revokeInviteAction, updateLiteBrokerContactAction } from "@/app/(dashboard)/equipe/actions";
import { Input } from "@/components/ui/input";
import { TeamInviteLiteSheet } from "@/features/team/team-invite-lite-sheet";
import { ActionNoticeLine, useActionNotice } from "@/components/lite/feedback/action-notice";

import { addBrokerToMyTeamAction } from "./actions";
import { cancelMyTeamInviteAction, inviteBrokerToMyTeamAction, removeBrokerFromMyTeamAction } from "./my-team-actions";
import { PendingBrokerEditSheet } from "./pending-broker-edit-sheet";
import type { SupervisorTeamPageData } from "./my-team-queries";
import { TeamOnDutyList } from "./team-on-duty-list";
import { PeopleRow, PeopleSection } from "@/components/light/people-list/people-list";
import styles from "./my-team-page.module.css";

const shortDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });

export function teamAvatarHue(name: string) {
  let hash = 0;
  for (const character of name.trim().toLocaleLowerCase("pt-BR")) hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  return hash % 360;
}

export function MyTeamPage({ initialData, initialTab = "members" }: { initialData: SupervisorTeamPageData; initialTab?: "members" | "invites" | "unit" }) {
  const [data, setData] = useState(initialData);
  // Depois de router.refresh() o servidor manda os dados novos: a lista passa a refletir o que ele confirmou.
  const [seenData, setSeenData] = useState(initialData);
  if (initialData !== seenData) { setSeenData(initialData); setData(initialData); }
  const [activeTab, setActiveTab] = useState<"members" | "invites" | "unit">(initialTab);
  const [unitSearch, setUnitSearch] = useState("");
  // Feedback nível 1 (docs/design-system/FEEDBACK.md): toque vibra, o botão da linha diz "…ando", o item muda
  // só depois do servidor e a linha de resultado confirma com check; erro com causa e "Tentar de novo".
  const notice = useActionNotice();
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const reducedMotion = useReducedMotion() ?? false;
  const normalizeName = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");
  const unitQuery = normalizeName(unitSearch.trim());
  const unitBrokers = data.brokers.filter((broker) => normalizeName(broker.name).includes(unitQuery));
  const unitPending = data.pendingAccessInvites.filter((invite) => normalizeName(invite.brokerName).includes(unitQuery));

  function runAction(key: string, action: () => Promise<{ ok: boolean; message: string }>, options: { keeps: string; fallback: string; retry: () => void; onSuccess?: () => void }) {
    notice.tap();
    notice.clear();
    setBusyKey(key);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          options.onSuccess?.();
          notice.succeed(result.message);
          router.refresh();
        } else notice.fail(result, { keeps: options.keeps, fallback: options.fallback, retry: options.retry });
      } catch (error) {
        notice.fail(error, { keeps: options.keeps, fallback: options.fallback, retry: options.retry });
      } finally {
        setBusyKey(null);
      }
    });
  }
  function removeMember(brokerId: string) {
    const name = data.members.find((member) => member.id === brokerId)?.name;
    runAction(`remove:${brokerId}`, () => removeBrokerFromMyTeamAction(brokerId), {
      keeps: name ? `${firstNameOf(name)} continua na equipe` : "O corretor continua na equipe",
      fallback: "Não consegui remover agora",
      retry: () => removeMember(brokerId),
      onSuccess: () => setData((current) => ({ ...current, members: current.members.filter((member) => member.id !== brokerId), brokers: current.brokers.map((item) => item.id === brokerId ? { ...item, supervisorId: null, supervisorName: null } : item) })),
    });
  }
  function invite(brokerId: string) {
    runAction(`invite:${brokerId}`, () => inviteBrokerToMyTeamAction({ brokerId }), {
      keeps: "Nenhum convite foi enviado",
      fallback: "Não consegui enviar o convite agora",
      retry: () => invite(brokerId),
      onSuccess: () => setData((current) => ({ ...current, brokers: current.brokers.map((item) => item.id === brokerId ? { ...item, inviteId: item.inviteId ?? `pending:${brokerId}` } : item) })),
    });
  }
  function addDirectly(brokerId: string) {
    runAction(`add:${brokerId}`, () => addBrokerToMyTeamAction(brokerId), {
      keeps: "O corretor continua livre na unidade",
      fallback: "Não consegui adicionar agora",
      retry: () => addDirectly(brokerId),
    });
  }
  function cancelInvite(inviteId: string) {
    runAction(`cancel:${inviteId}`, () => cancelMyTeamInviteAction(inviteId), {
      keeps: "O convite continua pendente",
      fallback: "Não consegui cancelar agora",
      retry: () => cancelInvite(inviteId),
      onSuccess: () => setData((current) => ({ ...current, invites: current.invites.filter((item) => item.id !== inviteId), brokers: current.brokers.map((item) => item.inviteId === inviteId ? { ...item, inviteId: null } : item) })),
    });
  }
  function manageAccessInvite(action: typeof resendInviteAction | typeof revokeInviteAction, invitationId: string) {
    const resend = action === resendInviteAction;
    const formData = new FormData();
    formData.set("invitationId", invitationId);
    runAction(`${resend ? "resend" : "revoke"}:${invitationId}`, async () => {
      const result = await action({}, formData);
      return result.success === true
        ? { ok: true, message: resend ? "Convite reenviado." : "Convite cancelado." }
        : { ok: false, message: result.error ?? "" };
    }, {
      keeps: resend ? "O convite anterior continua valendo" : "O convite continua pendente",
      fallback: "Não consegui atualizar o convite agora",
      retry: () => manageAccessInvite(action, invitationId),
      onSuccess: resend ? undefined : () => setData((current) => ({ ...current, pendingAccessInvites: current.pendingAccessInvites.filter((item) => item.id !== invitationId) })),
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
      <div aria-live="polite"><ActionNoticeLine notice={notice.notice} /></div>

      {activeTab === "members" ? <TeamOnDutyList duty={initialData.onDuty ?? []} /> : null}
      {activeTab === "members" ? (data.members.length || data.pendingAccessInvites.length ? <PeopleSection id="team-members-title" title="Membros" count={data.members.length + data.pendingAccessInvites.length}>
        {data.members.map((member, index) => <PeopleRow
          key={member.id}
          index={index}
          href={`/equipe/${encodeURIComponent(member.id)}`}
          name={member.name}
          avatar={member.imageUrl ? <Avatar name={member.name} src={member.imageUrl} size="lg" status={member.availability === "available" ? "online" : "offline"} /> : undefined}
          chip={<Badge tone={member.availability === "available" ? "success" : "neutral"} size="sm">{member.availability === "available" ? "Disponível" : member.availability === "paused" ? "Pausado" : "Fora do ar"}</Badge>}
          preview={[`${member.receivedToday} hoje`, `${member.inService} em atendimento`, member.late ? (member.late === 1 ? "1 atrasado" : `${member.late} atrasados`) : null].filter(Boolean).join(" · ")}
          previewTone={member.late ? "alert" : "muted"}
          dot={member.late ? "alert" : null}
          dotLabel={member.late ? "Tem lead atrasado" : undefined}
          action={<BottomSheet className="arc-venancor" trigger={<button type="button" className={styles.memberMenuTrigger} aria-label={`Ações de ${member.name}`}>•••</button>} title={`Ações de ${member.name}`} description="Escolha uma ação para este membro." closeLabel="Fechar" detents={[0.38, 0.7]}>
            <MemberSheetActions memberId={member.id} memberName={member.name} registration={{ name: member.name, email: member.email ?? "", phone: member.phone ?? "", cpf: member.cpf ?? "", brokerCode: member.brokerCode ?? "" }} pending={pending} removing={busyKey === `remove:${member.id}`} onRemove={() => removeMember(member.id)} />
          </BottomSheet>}
        />)}
        {data.pendingAccessInvites.map((invite, index) => <PeopleRow key={`pending-${invite.id}`} index={data.members.length + index} name={invite.brokerName} chip={<Badge tone="neutral" size="sm">Aguardando aceite</Badge>} preview={invite.email ?? "sem e-mail"} action={<PendingBrokerEditSheet broker={{ brokerProfileId: invite.brokerProfileId, brokerName: invite.brokerName, email: invite.email, phone: invite.phone, cpf: invite.cpf, brokerCode: invite.brokerCode }} />} />)}
      </PeopleSection> : <EmptyState title="Sua equipe ainda não tem membros" description="Adicione alguém da sua unidade ou envie um convite." icon={<AssistantAvatar shape="mochi" hue={150} size={72} state="working" />} action={<Button variant="outline" onClick={() => setActiveTab("unit")}>Ver corretores da unidade</Button>} />) : null}

      {activeTab === "invites" ? (data.invites.length || data.pendingAccessInvites.length ? <PeopleSection id="team-invites-title" title="Convites pendentes" count={data.invites.length + data.pendingAccessInvites.length}>
        {data.pendingAccessInvites.map((invite, index) => <PeopleRow key={invite.id} index={index} name={invite.brokerName} chip="Primeiro acesso" preview={`${invite.email ?? "sem e-mail"} · ${shortDate.format(new Date(invite.createdAt))}`} action={<div className={styles.brokerActions}><PendingBrokerEditSheet broker={{ brokerProfileId: invite.brokerProfileId, brokerName: invite.brokerName, email: invite.email, phone: invite.phone, cpf: invite.cpf, brokerCode: invite.brokerCode }} /><Button variant="outline" size="sm" disabled={pending} aria-busy={busyKey === `resend:${invite.id}` || undefined} onClick={() => manageAccessInvite(resendInviteAction, invite.id)}>{busyKey === `resend:${invite.id}` ? "Reenviando…" : "Reenviar"}</Button><Button variant="ghost" size="sm" disabled={pending} aria-busy={busyKey === `revoke:${invite.id}` || undefined} onClick={() => manageAccessInvite(revokeInviteAction, invite.id)}>{busyKey === `revoke:${invite.id}` ? "Cancelando…" : "Cancelar"}</Button></div>} />)}
        {data.invites.map((invite, index) => <PeopleRow key={invite.id} index={data.pendingAccessInvites.length + index} name={invite.brokerName} chip="Convite para a equipe" preview={shortDate.format(new Date(invite.createdAt))} action={<Button variant="outline" size="sm" disabled={pending} aria-busy={busyKey === `cancel:${invite.id}` || undefined} onClick={() => cancelInvite(invite.id)}>{busyKey === `cancel:${invite.id}` ? "Cancelando…" : "Cancelar convite"}</Button>} />)}
      </PeopleSection> : <EmptyState title="Nenhum convite pendente" description="Os convites enviados para corretores aparecem aqui." icon={<AssistantAvatar shape="mochi" hue={150} size={72} state="working" />} />) : null}

      {activeTab === "unit" ? <>
        <SearchField label="Buscar corretor da sua unidade" placeholder="Digite o nome do corretor" value={unitSearch} onValueChange={setUnitSearch} clearLabel="Limpar busca" />
        {unitBrokers.length || unitPending.length ? <PeopleSection id="team-brokers-title" title="Corretores da sua unidade" count={unitBrokers.length + unitPending.length}>
        {unitBrokers.map((broker, index) => <PeopleRow
          key={broker.id}
          index={index}
          name={broker.name}
          avatar={broker.imageUrl ? <Avatar name={broker.name} src={broker.imageUrl} size="lg" /> : undefined}
          preview={broker.supervisorName ? `Equipe de ${broker.supervisorName}` : "Livre para entrar na equipe"}
          action={broker.supervisorId ? <Link className={styles.textLink} href="/equipe/transferencia">Pedir transferência</Link> : broker.inviteId ? <Button variant="outline" size="sm" disabled>Convite pendente</Button> : <div className={styles.brokerActions}><Button size="sm" disabled={pending} aria-busy={busyKey === `add:${broker.id}` || undefined} onClick={() => addDirectly(broker.id)}>{busyKey === `add:${broker.id}` ? "Adicionando…" : "Adicionar"}</Button><Button variant="outline" size="sm" disabled={pending || !data.team} aria-busy={busyKey === `invite:${broker.id}` || undefined} onClick={() => invite(broker.id)}>{busyKey === `invite:${broker.id}` ? "Convidando…" : "Convidar"}</Button></div>}
        />)}
        {unitPending.map((invite, index) => <PeopleRow key={`unit-pending-${invite.id}`} index={unitBrokers.length + index} name={invite.brokerName} chip={<Badge tone="neutral" size="sm">Aguardando aceite</Badge>} preview={invite.email ?? "sem e-mail"} action={<PendingBrokerEditSheet broker={{ brokerProfileId: invite.brokerProfileId, brokerName: invite.brokerName, email: invite.email, phone: invite.phone, cpf: invite.cpf, brokerCode: invite.brokerCode }} />} />)}
      </PeopleSection> : <EmptyState title={unitQuery ? "Nenhum corretor encontrado" : "Não há outros corretores ativos"} description={unitQuery ? "Tente outro nome ou limpe a busca para ver os corretores da sua unidade." : "Quando houver corretores disponíveis na sua unidade, eles aparecerão aqui."} icon={<AssistantAvatar shape="mochi" hue={150} size={72} state="working" />} />}
      </> : null}
    </div>
  </motion.div>;
}

const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** Member actions in the sheet: shortcuts first, removal behind a confirmation step. */
type MemberRegistration = { name: string; email: string; phone: string; cpf: string; brokerCode: string };

/** Cadastro do corretor da equipe: nome, e-mail, telefone, CPF e código, pelo mesmo caminho do perfil. */
function MemberRegistrationForm({ memberId, registration, onBack }: { memberId: string; registration: MemberRegistration; onBack: () => void }) {
  const router = useRouter();
  const [saving, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [, setFailed] = useState(false);

  function save(formData: FormData) {
    setMessage("");
    startTransition(async () => {
      const result = await updateLiteBrokerContactAction({
        userId: memberId,
        name: formData.get("name"),
        email: formData.get("email"),
        phone: formData.get("phone"),
        cpf: formData.get("cpf") ?? "",
        brokerCode: formData.get("brokerCode") ?? "",
      });
      setFailed(!result.success);
      setMessage(result.success ? "Cadastro atualizado." : result.error ?? "Não consegui salvar agora.");
      if (result.success) router.refresh();
    });
  }

  return (
    <form action={save} className={styles.sheetActions} aria-label="Editar cadastro">
      <Input name="name" aria-label="Nome" defaultValue={registration.name} required minLength={2} maxLength={120} />
      <Input name="email" type="email" aria-label="E-mail" defaultValue={registration.email} required maxLength={254} />
      <Input name="phone" type="tel" aria-label="Telefone" defaultValue={registration.phone} required minLength={8} maxLength={30} />
      <Input name="cpf" inputMode="numeric" aria-label="CPF" placeholder="CPF (11 dígitos)" defaultValue={registration.cpf} maxLength={20} />
      <Input name="brokerCode" aria-label="Código do corretor" placeholder="Código do corretor" defaultValue={registration.brokerCode} maxLength={40} />
      <div className={styles.sheetDangerActions}>
        <Button variant="ghost" type="button" onClick={onBack}>Voltar</Button>
        <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar cadastro"}</Button>
      </div>
      {message ? <p role="status" className="text-sm">{message}</p> : null}
      
    </form>
  );
}

function MemberSheetActions({ memberId, memberName, registration, pending, removing = false, onRemove }: { memberId: string; memberName: string; registration: MemberRegistration; pending: boolean; removing?: boolean; onRemove: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  if (editing) return <MemberRegistrationForm memberId={memberId} registration={registration} onBack={() => setEditing(false)} />;
  const id = encodeURIComponent(memberId);
  return (
    <div className={styles.sheetActions}>
      <nav className={styles.sheetList} aria-label="Atalhos">
        <Link href={`/equipe/${id}`} className={styles.sheetRow}><span>Ver perfil</span><small>Números, leads e notas de {firstNameOf(memberName)}</small></Link>
        <Link href={`/relacionamento?brokerId=${id}`} className={styles.sheetRow}><span>Mandar recado</span><small>Pela Central de relacionamento</small></Link>
        <Link href={`/relacionamento?brokerId=${id}&action=recognition`} className={styles.sheetRow}><span>Reconhecer</span><small>Um elogio que ele recebe no app</small></Link>
        <button type="button" className={styles.sheetRow} onClick={() => setEditing(true)}><span>Editar cadastro</span><small>Nome, e-mail, telefone, CPF e código</small></button>
      </nav>
      {confirming ? (
        <div className={styles.sheetDanger} role="group" aria-label="Confirmar remoção">
          <p>Tirar {firstNameOf(memberName)} da sua equipe? Ele volta a ficar livre na unidade e o histórico de leads é mantido.</p>
          <div className={styles.sheetDangerActions}>
            <Button variant="ghost" onClick={() => setConfirming(false)}>Voltar</Button>
            <Button variant="destructive" disabled={pending} aria-busy={removing || undefined} onClick={onRemove}>{removing ? "Removendo…" : "Sim, remover"}</Button>
          </div>
        </div>
      ) : (
        <button type="button" className={styles.sheetRemove} onClick={() => setConfirming(true)}>Remover da equipe</button>
      )}
    </div>
  );
}
