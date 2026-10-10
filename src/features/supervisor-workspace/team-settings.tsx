"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/arc/input/input";
import { Textarea } from "@/components/arc/textarea/textarea";
import { FileDropzone } from "@/components/arc/file-dropzone/file-dropzone";
import { Avatar } from "@/components/arc/avatar/avatar";
import { ActionButton } from "@/components/arc/action-button/action-button";
import { motionTokens } from "@/components/arc/lib/motion-tokens";

import { saveMySupervisorTeamAction } from "./my-team-actions";
import { teamAvatarHue } from "./my-team-page";
import styles from "./team-settings.module.css";

type TeamProfile = { name: string; description: string; imageUrl: string | null } | null;

async function resizeImage(file: File): Promise<string> {
  const image = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Seu navegador não conseguiu preparar a imagem.");
  const scale = Math.min(256 / image.width, 256 / image.height);
  const width = Math.round(image.width * scale); const height = Math.round(image.height * scale);
  context.drawImage(image, (256 - width) / 2, (256 - height) / 2, width, height);
  image.close();
  return canvas.toDataURL("image/webp", 0.82);
}

export function SupervisorTeamSettings({ initialTeam }: { initialTeam: TeamProfile }) {
  const reduce = useReducedMotion();
  const [name, setName] = useState(initialTeam?.name ?? "");
  const [description, setDescription] = useState(initialTeam?.description ?? "");
  const [imageUrl, setImageUrl] = useState(initialTeam?.imageUrl ?? null);
  const [feedback, setFeedback] = useState("");
  const [dropKey, setDropKey] = useState(0);

  async function selectPhoto(files: File[]) {
    const file = files[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImage(file);
      if (new TextEncoder().encode(dataUrl).byteLength > 204800) throw new Error("A foto ainda ficou grande. Escolha outra imagem.");
      setImageUrl(dataUrl); setFeedback("");
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Não consegui preparar a foto."); }
  }

  async function save() {
    setFeedback("");
    const result = await saveMySupervisorTeamAction({ name, description, imageUrl });
    setFeedback(result.message);
    if (!result.ok) throw new Error(result.message);
  }

  return <motion.div className={`arc-venancor ${styles.page}`} initial={reduce ? false : { opacity: 0, y: 8 }} animate={reduce ? false : { opacity: 1, y: 0 }} transition={reduce ? { duration: motionTokens.duration.instant } : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }} aria-labelledby="team-settings-title">
    <div className={styles.inner}>
      <Link href="/equipe/minha" className={styles.back}>Minha equipe</Link>
      <header><h1 id="team-settings-title">Configuração da equipe</h1><p>Atualize o perfil que os corretores veem.</p></header>
      <section className={styles.preview} aria-label="Prévia do cartão da equipe">
        <Avatar name={name || "Equipe"} src={imageUrl ?? undefined} size="xl" className={styles.avatar} style={{ "--team-hue": teamAvatarHue(name || "Equipe") } as React.CSSProperties} />
        <div className={styles.previewText}><strong>{name.trim() || "Nome da equipe"}</strong><p>{description.trim() || "A descrição aparece aqui."}</p></div>
      </section>
      <div className={styles.fields}>
        <Input label="Nome da equipe" id="supervisor-team-name" value={name} minLength={2} maxLength={60} required onChange={(event) => setName(event.currentTarget.value)} />
        <Textarea label="Descrição" id="supervisor-team-description" value={description} maxLength={280} rows={3} onChange={(event) => setDescription(event.currentTarget.value)} aria-describedby="team-description-count" />
        <p id="team-description-count" className={styles.counter}>{description.length}/280 caracteres</p>
      </div>
      <div className={styles.photoSection}>
        <div className={styles.photoPreview}><Avatar name={name || "Equipe"} src={imageUrl ?? undefined} size="xl" className={styles.avatar} style={{ "--team-hue": teamAvatarHue(name || "Equipe") } as React.CSSProperties} /><span><strong>Foto da equipe</strong><small>Mostrada ao corretor quando ele recebe um convite.</small></span></div>
        <FileDropzone key={dropKey} accept="image/png,image/jpeg,image/webp" maxFiles={1} maxSize={8 * 1024 * 1024} multiple={false} onFilesChange={(files) => { void selectPhoto(files); }} label={imageUrl ? "Trocar foto" : "Adicionar foto"} description="Escolha ou solte uma foto da equipe" note="PNG, JPEG ou WebP" />
        {imageUrl ? <Button type="button" variant="outline" onClick={() => { setImageUrl(null); setDropKey((key) => key + 1); }}>Remover foto</Button> : null}
      </div>
      {feedback ? <p className={styles.feedback} role="status" aria-live="polite">{feedback}</p> : null}
      <div className={styles.actions}><ActionButton label="Salvar alterações" pendingLabel="Salvando" successLabel="Perfil salvo" onAction={save} onActionError={(error) => setFeedback(error instanceof Error ? error.message : "Não foi possível salvar o perfil.")} /> <Button variant="outline" render={<Link href="/equipe/minha" />}>Cancelar</Button></div>
    </div>
  </motion.div>;
}
