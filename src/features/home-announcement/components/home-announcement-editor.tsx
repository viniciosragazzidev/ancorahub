"use client";

/**
 * Editor do aviso do Início (Relacionamento, diretor, 15/11/2026). Título, texto, botão com link, personagem, cor e
 * até quando fica no ar, com a prévia do banner ao vivo. Publicar põe no ar para todos os corretores da empresa;
 * "Tirar do ar" volta o banner padrão do Início. Sucesso só depois da confirmação do servidor (FEEDBACK.md).
 */
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { CaptainBanner } from "@/components/lite/banner/captain-banner";
import { LiteActionButton } from "@/components/lite/controls";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";

import { saveHomeAnnouncementAction } from "../actions";
import {
  ANNOUNCEMENT_ART_IDS, ANNOUNCEMENT_ARTS, ANNOUNCEMENT_TONES, EMPTY_ANNOUNCEMENT, announcementArt, isAnnouncementLive,
  type AnnouncementTone, type HomeAnnouncement, type HomeAnnouncementInput,
} from "../announcement";
import styles from "./home-announcement-editor.module.css";

const TONE_IDS = Object.keys(ANNOUNCEMENT_TONES) as AnnouncementTone[];
const DATE = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

export function HomeAnnouncementEditor({ initial, today }: { initial: HomeAnnouncement | null; today: string }) {
  const router = useRouter();
  const id = useId();
  const [draft, setDraft] = useState<HomeAnnouncementInput>(() => initial ? { ...EMPTY_ANNOUNCEMENT, ...initial } : EMPTY_ANNOUNCEMENT);
  const [withButton, setWithButton] = useState(Boolean(initial?.button));
  const [buttonLabel, setButtonLabel] = useState(initial?.button?.label ?? "");
  const [buttonHref, setButtonHref] = useState(initial?.button?.href ?? "");
  const [saved, setSaved] = useState<HomeAnnouncement | null>(initial);
  const [offError, setOffError] = useState<string | null>(null);
  const [offPending, startOff] = useTransition();

  const live = isAnnouncementLive(saved, today);
  const set = <K extends keyof HomeAnnouncementInput>(key: K, value: HomeAnnouncementInput[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const payload = (active: boolean): HomeAnnouncementInput => ({
    ...draft,
    active,
    button: withButton ? { label: buttonLabel, href: buttonHref } : null,
    endsOn: draft.endsOn || null,
  });

  async function publish() {
    const result = await saveHomeAnnouncementAction(payload(true));
    if (!result.ok) return { ok: false as const, message: result.error };
    setSaved(result.data);
    router.refresh();
    return { ok: true as const };
  }

  function takeDown() {
    setOffError(null);
    startOff(async () => {
      const result = await saveHomeAnnouncementAction({ ...payload(false), title: draft.title || saved?.title || "Aviso" });
      if (!result.ok) { setOffError(result.error); return; }
      setSaved(result.data);
      router.refresh();
    });
  }

  const previewTitle = draft.title.trim() || "Título do aviso";
  const previewBody = draft.body.trim() || "O texto do aviso aparece aqui, logo abaixo do título.";

  return (
    <section className={page.card} aria-labelledby={`${id}-title`}>
      <div className={page.cardHead}>
        <div>
          <h2 id={`${id}-title`} className={page.cardTitle}>Aviso do Início</h2>
          <p className={page.cardDescription}>O banner do capitão no Início de todos os corretores. Escreva, escolha o personagem e a cor e publique.</p>
        </div>
        <span className={styles.status} data-live={live || undefined}>
          <span className={styles.statusDot} aria-hidden="true" />
          {live ? (saved?.endsOn ? `No ar até ${DATE.format(new Date(`${saved.endsOn}T12:00:00Z`))}` : "No ar") : "Fora do ar"}
        </span>
      </div>

      <div className={styles.preview} aria-label="Prévia do banner">
        <p className={styles.previewLabel}>Prévia</p>
        <CaptainBanner
          className={styles.previewBanner}
          label="Prévia do aviso"
          title={previewTitle}
          subtitle={previewBody}
          art={announcementArt(draft.art)}
          tone={draft.tone}
          actionSlot={withButton ? (className) => <span className={className} aria-hidden="true">{buttonLabel.trim() || "Texto do botão"}</span> : () => null}
        />
      </div>

      <div className={form.form}>
        <div className={form.field}>
          <label className={form.label} htmlFor={`${id}-t`}>Título</label>
          <input id={`${id}-t`} className={form.input} value={draft.title} maxLength={80} placeholder="Ex.: Campanha de novembro no ar!" onChange={(event) => set("title", event.target.value)} />
          <p className={form.hint}>{draft.title.length}/80</p>
        </div>
        <div className={form.field}>
          <label className={form.label} htmlFor={`${id}-b`}>Texto</label>
          <textarea id={`${id}-b`} className={form.textarea} value={draft.body} maxLength={240} placeholder="Uma ou duas frases com o que o corretor precisa saber." onChange={(event) => set("body", event.target.value)} />
          <p className={form.hint}>{draft.body.length}/240</p>
        </div>

        <label className={styles.toggle}>
          <input type="checkbox" checked={withButton} onChange={(event) => setWithButton(event.target.checked)} />
          <span>Mostrar um botão com link</span>
        </label>
        {withButton ? (
          <div className={`${form.row} ${styles.alignTop}`}>
            <div className={form.field}>
              <label className={form.label} htmlFor={`${id}-bl`}>Texto do botão</label>
              <input id={`${id}-bl`} className={form.input} value={buttonLabel} maxLength={30} placeholder="Ex.: Ver a campanha" onChange={(event) => setButtonLabel(event.target.value)} />
            </div>
            <div className={form.field}>
              <label className={form.label} htmlFor={`${id}-bh`}>Link</label>
              <input id={`${id}-bh`} className={form.input} value={buttonHref} maxLength={500} placeholder="/jornada ou https://…" inputMode="url" onChange={(event) => setButtonHref(event.target.value)} />
              <p className={form.hint}>Uma tela do sistema (começando com /) ou um endereço https://.</p>
            </div>
          </div>
        ) : null}

        <fieldset className={styles.group}>
          <legend className={form.label}>Personagem</legend>
          <div className={styles.arts}>
            {ANNOUNCEMENT_ART_IDS.map((artId) => {
              const option = ANNOUNCEMENT_ARTS[artId];
              return (
                <label key={artId} className={styles.art} data-selected={draft.art === artId || undefined}>
                  <input type="radio" name={`${id}-art`} value={artId} checked={draft.art === artId} onChange={() => set("art", artId)} className={styles.srOnly} />
                  {/* eslint-disable-next-line @next/next/no-img-element -- arte local do mascote */}
                  <img src={option.art.src} alt="" width={option.art.width} height={option.art.height} draggable={false} />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className={`${form.row} ${styles.alignTop}`}>
          <fieldset className={styles.group}>
            <legend className={form.label}>Cor do banner</legend>
            <div className={styles.tones}>
              {TONE_IDS.map((tone) => (
                <label key={tone} className={styles.tone} data-selected={draft.tone === tone || undefined}>
                  <input type="radio" name={`${id}-tone`} value={tone} checked={draft.tone === tone} onChange={() => set("tone", tone)} className={styles.srOnly} />
                  <span className={styles.swatch} data-tone={tone} aria-hidden="true" />
                  {ANNOUNCEMENT_TONES[tone]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className={form.field}>
            <label className={form.label} htmlFor={`${id}-e`}>No ar até (opcional)</label>
            <input id={`${id}-e`} type="date" className={form.input} min={today} value={draft.endsOn ?? ""} onChange={(event) => set("endsOn", event.target.value || null)} />
            <p className={form.hint}>Vazio: fica no ar até você tirar.</p>
          </div>
        </div>

        <div className={form.actions}>
          {offError ? <p className={styles.error} role="alert">{offError} O aviso continua no ar.</p> : null}
          {live ? <button type="button" className={page.button} onClick={takeDown} disabled={offPending}>{offPending ? "Tirando do ar…" : "Tirar do ar"}</button> : null}
          <LiteActionButton busyLabel="Publicando…" doneLabel="Publicado" onAction={publish} keeps="O aviso anterior continua como estava." errorFallback="Não deu para publicar agora">
            {live ? "Atualizar aviso" : "Publicar para os corretores"}
          </LiteActionButton>
        </div>
      </div>
    </section>
  );
}
