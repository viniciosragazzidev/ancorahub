"use client";

/**
 * Privacidade em /settings no visual Lite (26/11), só o diretor, junto dos pedidos do titular:
 * - Encarregado de dados: nome, e-mail e telefone; nome e e-mail aparecem no rodapé do formulário público e dos termos.
 * - Retenção de mídia: por quanto tempo guardar áudio, imagem, vídeo e documento das conversas de leads perdidos ou
 *   arquivados. Antes de salvar, mostra quantos arquivos a próxima limpeza remove. Padrão: Sempre.
 *
 * Feedback (FEEDBACK.md, nível 1): salvar confirma no botão só depois do servidor; a falha mostra a causa, o que
 * continua valendo e "Tentar de novo".
 */
import { useEffect, useRef, useState } from "react";

import { LiteActionButton, LiteSelect } from "@/components/lite/controls";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import styles from "@/components/lite/page/lite-sections.module.css";
import { dpoFooterText, validateDpoInput, type DataProtectionOfficer } from "@/features/leads/lgpd/dpo";
import {
  describeMediaRetentionPreview,
  MEDIA_RETENTION_OPTIONS,
  MEDIA_RETENTION_REMOVED_TEXT,
  mediaRetentionLabel,
  type MediaRetentionOption,
} from "@/features/leads/lgpd/media-retention";
import { previewMediaRetentionAction, saveDpoAction, saveMediaRetentionAction } from "@/features/leads/lgpd/privacy-actions";

export function DpoLite({ initial }: { initial: DataProtectionOfficer | null }) {
  const [saved, setSaved] = useState(initial);
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const empty = !name.trim() && !email.trim() && !phone.trim();
  const check = empty ? null : validateDpoInput({ name, email, phone });
  const changed = name !== (saved?.name ?? "") || email !== (saved?.email ?? "") || phone !== (saved?.phone ?? "");
  const preview = check?.ok ? dpoFooterText(check.dpo) : null;

  return (
    <section className={styles.group} aria-labelledby="dpo-title">
      <div className={styles.row}>
        <div className={styles.rowText}>
          <h3 id="dpo-title" className={styles.rowTitle}>Encarregado de dados</h3>
          <p className={styles.rowDescription}>Quem responde pelos dados pessoais na corretora. Nome e e-mail aparecem no formulário público e nos termos.</p>
        </div>
        <span className={page.badge} data-tone={saved ? "success" : undefined}>{saved ? "Cadastrado" : "Sem cadastro"}</span>
      </div>
      <div className={styles.formBody}>
        <div className={styles.fields}>
          <label className={form.field}>
            <span className={form.label}>Nome</span>
            <input className={form.input} value={name} maxLength={120} autoComplete="name" onChange={(event) => setName(event.target.value)} />
          </label>
          <label className={form.field}>
            <span className={form.label}>E-mail</span>
            <input className={form.input} type="email" inputMode="email" value={email} maxLength={160} autoComplete="email" onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className={form.field}>
            <span className={form.label}>Telefone (opcional)</span>
            <input className={form.input} type="tel" inputMode="tel" value={phone} maxLength={20} autoComplete="tel" onChange={(event) => setPhone(event.target.value)} />
          </label>
        </div>
        {check && !check.ok ? <p className={form.hint}>{check.error}</p> : null}
        {preview ? <p className={styles.note}>No rodapé: {preview}</p> : null}
        {empty && saved ? <p className={styles.note}>Salvar vazio tira o rodapé das páginas públicas.</p> : null}
      </div>
      <div className={styles.footer}>
        <div className={styles.footerEnd}>
          <LiteActionButton
            tone="secondary"
            busyLabel="Salvando…"
            doneLabel="Salvo"
            disabled={!changed || (check !== null && !check.ok)}
            keeps="O cadastro anterior continua valendo."
            errorFallback="Não deu para salvar o encarregado agora."
            onAction={async () => {
              const result = await saveDpoAction({ name, email, phone });
              if (!result.ok) return { ok: false, message: result.error };
              setSaved(result.dpo);
              setName(result.dpo?.name ?? "");
              setEmail(result.dpo?.email ?? "");
              setPhone(result.dpo?.phone ?? "");
              return { ok: true };
            }}
          >
            Salvar encarregado
          </LiteActionButton>
        </div>
      </div>
    </section>
  );
}

type Preview = { option: MediaRetentionOption; count: number | null };

export function MediaRetentionLite({ initial }: { initial: MediaRetentionOption }) {
  const [saved, setSaved] = useState(initial);
  const [option, setOption] = useState(initial);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [counting, setCounting] = useState(false);
  const request = useRef(0);

  useEffect(() => {
    if (option === "always") { setPreview({ option, count: 0 }); return; }
    const id = ++request.current;
    setCounting(true);
    previewMediaRetentionAction(option)
      .catch(() => ({ ok: false as const, error: "" }))
      .then((result) => {
        if (id !== request.current) return;
        setCounting(false);
        setPreview({ option, count: result.ok ? result.count : null });
      });
  }, [option]);

  const current = preview?.option === option ? preview : null;
  const changed = option !== saved;

  return (
    <section className={styles.group} aria-labelledby="media-retention-title">
      <div className={styles.row}>
        <div className={styles.rowText}>
          <h3 id="media-retention-title" className={styles.rowTitle}>Retenção de mídia</h3>
          <p className={styles.rowDescription}>
            Áudio, imagem, vídeo e documento das conversas de leads perdidos ou arquivados. As mensagens e os dados do lead ficam.
          </p>
        </div>
        <span className={page.badge}>{mediaRetentionLabel(saved)}</span>
      </div>
      <div className={styles.formBody}>
        <div className={styles.fields}>
          <LiteSelect
            label="Guardar por"
            value={option}
            options={MEDIA_RETENTION_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
            onChange={(value) => setOption(value as MediaRetentionOption)}
          />
        </div>
        <p className={styles.note} role="status" aria-live="polite">
          {counting || !current ? "Contando os arquivos…" : describeMediaRetentionPreview(option, current.count)}
        </p>
        {option !== "always" ? (
          <p className={form.hint}>
            O prazo conta da última data entre a mensagem, a perda e o arquivamento. Lead convertido ou cliente nunca perde mídia. No lugar do arquivo fica &quot;{MEDIA_RETENTION_REMOVED_TEXT}&quot;.
          </p>
        ) : null}
      </div>
      <div className={styles.footer}>
        <div className={styles.footerEnd}>
          <LiteActionButton
            tone="secondary"
            busyLabel="Salvando…"
            doneLabel="Salvo"
            disabled={!changed}
            keeps="O prazo anterior continua valendo."
            errorFallback="Não deu para salvar a retenção agora."
            onAction={async () => {
              const result = await saveMediaRetentionAction(option);
              if (!result.ok) return { ok: false, message: result.error };
              setSaved(result.policy.option);
              return { ok: true };
            }}
          >
            Salvar retenção
          </LiteActionButton>
        </div>
      </div>
    </section>
  );
}
