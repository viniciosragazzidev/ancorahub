"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { motion, useReducedMotionConfig } from "motion/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/arc/input/input";
import { Textarea } from "@/components/arc/textarea/textarea";
import { ActionButton } from "@/components/arc/action-button/action-button";
import { motionTokens } from "@/components/arc/lib/motion-tokens";

import { saveMySupervisorTeamAction } from "./my-team-actions";
import { teamAvatarHue } from "./my-team-page";
import styles from "./team-settings.module.css";

type TeamProfile = { name: string; description: string; imageUrl: string | null } | null;

/** Square 256px WebP, cropped to fill (the team photo is shown in a circle). */
async function resizeImage(file: File): Promise<string> {
  const image = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Seu navegador não conseguiu preparar a imagem.");
  const scale = Math.max(256 / image.width, 256 / image.height);
  const width = Math.round(image.width * scale); const height = Math.round(image.height * scale);
  context.drawImage(image, (256 - width) / 2, (256 - height) / 2, width, height);
  image.close();
  return canvas.toDataURL("image/webp", 0.82);
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "E";
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "")).toUpperCase();
}

function TeamPhoto({ name, imageUrl, size }: { name: string; imageUrl: string | null; size: "lg" | "md" }) {
  return (
    <span className={styles.photo} data-size={size} style={{ "--team-hue": teamAvatarHue(name || "Equipe") } as React.CSSProperties} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview, nothing to optimize */}
      {imageUrl ? <img src={imageUrl} alt="" /> : <span>{initialsOf(name)}</span>}
    </span>
  );
}

const CameraIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3" />
  </svg>
);

export function SupervisorTeamSettings({ initialTeam }: { initialTeam: TeamProfile }) {
  const reduce = useReducedMotionConfig();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialTeam?.name ?? "");
  const [description, setDescription] = useState(initialTeam?.description ?? "");
  const [imageUrl, setImageUrl] = useState(initialTeam?.imageUrl ?? null);
  const [feedback, setFeedback] = useState("");
  const isNew = !initialTeam;

  async function selectPhoto(file: File | undefined) {
    if (!file) return;
    try {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Use uma foto PNG, JPEG ou WebP.");
      const dataUrl = await resizeImage(file);
      if (new TextEncoder().encode(dataUrl).byteLength > 204800) throw new Error("A foto ainda ficou grande. Escolha outra imagem.");
      setImageUrl(dataUrl);
      setFeedback("");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não consegui preparar a foto.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function save() {
    setFeedback("");
    const result = await saveMySupervisorTeamAction({ name, description, imageUrl });
    if (!result.ok) {
      setFeedback(result.message);
      throw new Error(result.message);
    }
  }

  const pickPhoto = () => fileInput.current?.click();

  return (
    <motion.div
      className={`arc-venancor ${styles.page}`}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: motionTokens.duration.instant } : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }}
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <h1>{isNew ? "Crie sua equipe" : "Perfil da equipe"}</h1>
          <p>É assim que os corretores veem sua equipe nos convites e no perfil deles.</p>
        </header>

        <section className={styles.preview} style={{ "--team-hue": teamAvatarHue(name || "Equipe") } as React.CSSProperties} aria-label="Prévia do cartão da equipe">
          <TeamPhoto name={name} imageUrl={imageUrl} size="lg" />
          <div className={styles.previewText}>
            <strong>{name.trim() || "Nome da equipe"}</strong>
            <p data-empty={!description.trim()}>{description.trim() || "Uma frase sobre o jeito da sua equipe trabalhar."}</p>
          </div>
        </section>

        <form className={styles.card} onSubmit={(event) => event.preventDefault()}>
          <div className={styles.photoRow}>
            <button type="button" className={styles.photoButton} onClick={pickPhoto} aria-label={imageUrl ? "Trocar foto da equipe" : "Adicionar foto da equipe"}>
              <TeamPhoto name={name} imageUrl={imageUrl} size="md" />
              <span className={styles.photoBadge}><CameraIcon /></span>
            </button>
            <div className={styles.photoText}>
              <strong>Foto da equipe</strong>
              <span>Um logo, uma foto do time ou o que representar vocês.</span>
              <div className={styles.photoActions}>
                <Button type="button" variant="outline" size="sm" onClick={pickPhoto}>{imageUrl ? "Trocar foto" : "Escolher foto"}</Button>
                {imageUrl ? <Button type="button" variant="ghost" size="sm" onClick={() => setImageUrl(null)}>Remover</Button> : null}
              </div>
            </div>
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className={styles.hiddenInput} tabIndex={-1} aria-hidden="true" onChange={(event) => { void selectPhoto(event.currentTarget.files?.[0]); }} />
          </div>

          <div className={styles.divider} />

          <Input label="Nome da equipe" id="supervisor-team-name" value={name} minLength={2} maxLength={60} required placeholder="Ex.: Time Barra" onChange={(event) => setName(event.currentTarget.value)} />
          <div className={styles.textareaWrap}>
            <Textarea label="Descrição" id="supervisor-team-description" value={description} maxLength={280} rows={3} placeholder="O que move a equipe, como vocês atendem, a meta do mês..." onChange={(event) => setDescription(event.currentTarget.value)} aria-describedby="team-description-count" />
            <span id="team-description-count" className={styles.counter} data-near={description.length > 250}>{description.length}/280</span>
          </div>
        </form>

        {feedback ? <p className={styles.feedback} role="status" aria-live="polite">{feedback}</p> : null}

        <div className={styles.actions}>
          <Button variant="ghost" render={<Link href="/equipe/minha" />}>Cancelar</Button>
          <ActionButton
            label={isNew ? "Criar equipe" : "Salvar alterações"}
            pendingLabel="Salvando"
            successLabel={isNew ? "Equipe criada" : "Perfil salvo"}
            onAction={save}
            onActionError={(error) => setFeedback(error instanceof Error ? error.message : "Não foi possível salvar o perfil.")}
          />
        </div>
      </div>
    </motion.div>
  );
}
