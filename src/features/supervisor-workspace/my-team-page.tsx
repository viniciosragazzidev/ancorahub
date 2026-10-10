"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useTransition, type ChangeEvent, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { addBrokerToMyTeamAction } from "./actions";
import { cancelMyTeamInviteAction, inviteBrokerToMyTeamAction, removeBrokerFromMyTeamAction, saveMySupervisorTeamAction } from "./my-team-actions";
import type { SupervisorTeamPageData } from "./my-team-queries";
import styles from "./my-team-page.module.css";

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("pt-BR") ?? "").join("");
}

async function resizeImage(file: File): Promise<string> {
  const image = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Seu navegador não conseguiu preparar a imagem.");
  const scale = Math.min(256 / image.width, 256 / image.height);
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  context.drawImage(image, (256 - width) / 2, (256 - height) / 2, width, height);
  image.close();
  return canvas.toDataURL("image/webp", 0.82);
}

export function MyTeamPage({ initialData }: { initialData: SupervisorTeamPageData }) {
  const [data, setData] = useState(initialData);
  const [editing, setEditing] = useState(!initialData.team);
  const [name, setName] = useState(initialData.team?.name ?? "");
  const [description, setDescription] = useState(initialData.team?.description ?? "");
  const [imageUrl, setImageUrl] = useState(initialData.team?.imageUrl ?? null);
  const [feedback, setFeedback] = useState("");
  const [pending, startTransition] = useTransition();

  function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFeedback("Escolha uma imagem para o perfil da equipe.");
      return;
    }
    void resizeImage(file).then((value) => {
      if (new TextEncoder().encode(value).byteLength > 204800) {
        setFeedback("A imagem ficou acima de 200 KB. Escolha uma imagem menor.");
        return;
      }
      setImageUrl(value);
      setFeedback("");
    }).catch(() => setFeedback("Não consegui preparar essa imagem."));
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");
    startTransition(async () => {
      const result = await saveMySupervisorTeamAction({ name, description, imageUrl });
      setFeedback(result.message);
      if (result.ok) {
        setData((current) => ({ ...current, team: { name: name.trim(), description: description.trim(), imageUrl } }));
        setEditing(false);
      }
    });
  }

  function invite(brokerId: string) {
    setFeedback("");
    startTransition(async () => {
      const result = await inviteBrokerToMyTeamAction({ brokerId });
      setFeedback(result.message);
      if (result.ok) window.location.reload();
    });
  }

  function addDirectly(brokerId: string) {
    setFeedback("");
    startTransition(async () => {
      const result = await addBrokerToMyTeamAction(brokerId);
      setFeedback(result.message);
      if (result.ok) window.location.reload();
    });
  }

  function cancelInvite(inviteId: string) {
    setFeedback("");
    startTransition(async () => {
      const result = await cancelMyTeamInviteAction(inviteId);
      setFeedback(result.message);
      if (result.ok) setData((current) => ({ ...current, invites: current.invites.filter((item) => item.id !== inviteId), brokers: current.brokers.map((item) => item.inviteId === inviteId ? { ...item, inviteId: null } : item) }));
    });
  }

  function removeMember(brokerId: string, brokerName: string) {
    if (!window.confirm(`Remover ${brokerName} da equipe? O corretor poderá ser convidado novamente.`)) return;
    setFeedback("");
    startTransition(async () => {
      const result = await removeBrokerFromMyTeamAction(brokerId);
      setFeedback(result.message);
      if (result.ok) window.location.reload();
    });
  }

  return (
    <section className={`arc-venancor ${styles.page}`} aria-labelledby="my-team-title">
      <div className={styles.inner}>
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>Sua unidade</p>
            <h1 id="my-team-title">Minha equipe</h1>
            <p className={styles.muted}>Cuide do perfil e adicione ou convide corretores livres da sua unidade.</p>
          </div>
          {data.team && !editing ? <Button variant="outline" onClick={() => setEditing(true)}>Editar perfil</Button> : null}
        </header>

        {editing ? (
          <form className={styles.profile} onSubmit={save}>
            <div className={styles.profilePreview}>
              {imageUrl ? <Image src={imageUrl} alt="" width={256} height={256} unoptimized /> : <span aria-hidden="true">{initials(name || "Equipe")}</span>}
            </div>
            <div className={styles.formFields}>
              <h2>{data.team ? "Editar perfil" : "Crie sua equipe"}</h2>
              <label htmlFor="team-name">Nome da equipe</label>
              <Input id="team-name" value={name} onChange={(event) => setName(event.currentTarget.value)} minLength={2} maxLength={60} required />
              <label htmlFor="team-description">Descrição</label>
              <Textarea id="team-description" value={description} onChange={(event) => setDescription(event.currentTarget.value)} maxLength={280} rows={3} />
              <label className={styles.fileLabel} htmlFor="team-image">Imagem da equipe</label>
              <input id="team-image" type="file" accept="image/png,image/jpeg,image/webp" onChange={selectImage} />
              <p className={styles.hint}>A imagem será redimensionada para 256 × 256 px e salva em WebP. Limite de 200 KB.</p>
              <div className={styles.actions}>
                <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar perfil"}</Button>
                {data.team ? <Button type="button" variant="outline" onClick={() => { setName(data.team!.name); setDescription(data.team!.description); setImageUrl(data.team!.imageUrl); setEditing(false); }}>Cancelar</Button> : null}
              </div>
            </div>
          </form>
        ) : null}

        {data.team ? (
          <section className={styles.teamIdentity} aria-label="Perfil da equipe">
            <div className={styles.teamImage}>{data.team.imageUrl ? <Image src={data.team.imageUrl} alt="" width={88} height={88} unoptimized /> : <span>{initials(data.team.name)}</span>}</div>
            <div><h2>{data.team.name}</h2><p>{data.team.description || "Sem descrição."}</p></div>
          </section>
        ) : null}

        {feedback ? <p className={styles.feedback} role="status">{feedback}</p> : null}

        <section className={styles.section} aria-labelledby="team-members-title">
          <div className={styles.sectionTitle}><h2 id="team-members-title">Membros</h2><span>{data.members.length}</span></div>
          {data.members.length ? <ul className={styles.list}>{data.members.map((member) => (
            <li key={member.id} className={styles.row}>
              <Link className={styles.memberLink} href={`/equipe/${encodeURIComponent(member.id)}`}>
                <span className={styles.avatar}>{member.imageUrl ? <Image src={member.imageUrl} alt="" width={40} height={40} unoptimized /> : initials(member.name)}</span>
                <span>{member.name}</span>
              </Link>
              <Button variant="outline" size="sm" disabled={pending} onClick={() => removeMember(member.id, member.name)}>Remover da equipe</Button>
            </li>
          ))}</ul> : <p className={styles.empty}>Sua equipe ainda não tem membros.</p>}
        </section>

        <section className={styles.section} aria-labelledby="team-invites-title">
          <div className={styles.sectionTitle}><h2 id="team-invites-title">Convites pendentes</h2><span>{data.invites.length}</span></div>
          {data.invites.length ? <ul className={styles.list}>{data.invites.map((invite) => (
            <li key={invite.id} className={styles.row}>
              <span>{invite.brokerName}<small>Enviado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(invite.createdAt))}</small></span>
              <Button variant="outline" size="sm" disabled={pending} onClick={() => cancelInvite(invite.id)}>Cancelar convite</Button>
            </li>
          ))}</ul> : <p className={styles.empty}>Nenhum convite aguardando resposta.</p>}
        </section>

        <section className={styles.section} aria-labelledby="team-brokers-title">
          <div className={styles.sectionTitle}><h2 id="team-brokers-title">Corretores da sua unidade</h2></div>
          {data.brokers.length ? <ul className={styles.list}>{data.brokers.map((broker) => (
            <li key={broker.id} className={styles.row}>
              <span className={styles.memberLink}><span className={styles.avatar}>{broker.imageUrl ? <Image src={broker.imageUrl} alt="" width={40} height={40} unoptimized /> : initials(broker.name)}</span><span>{broker.name}<small>{broker.supervisorName ? `Equipe de ${broker.supervisorName}` : "Livre para entrar na equipe"}</small></span></span>
              {broker.supervisorId ? <Link className={styles.textLink} href="/equipe/transferencia">Pedir transferência</Link> : broker.inviteId ? <Button variant="outline" size="sm" disabled>Convite pendente</Button> : <div className={styles.brokerActions}>
                <Button size="sm" disabled={pending} onClick={() => addDirectly(broker.id)}>Adicionar</Button>
                <Button variant="outline" size="sm" disabled={pending || !data.team} onClick={() => invite(broker.id)}>Convidar</Button>
              </div>}
            </li>
          ))}</ul> : <p className={styles.empty}>Não há outros corretores ativos na sua unidade.</p>}
        </section>
      </div>
    </section>
  );
}
