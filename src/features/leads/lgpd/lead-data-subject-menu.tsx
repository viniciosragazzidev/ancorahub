"use client";

/**
 * Pedido do titular (LGPD) no ⋯ do perfil do lead, só para o diretor: "Exportar dados do titular" baixa um JSON e
 * "Anonimizar titular" pede ANONIMIZAR e o motivo antes de apagar o dado pessoal (vendas e números ficam).
 *
 * Feedback (FEEDBACK.md): exportar é nível 1, o arquivo só baixa depois do servidor e a linha ao lado confirma;
 * anonimizar é nível 1 no LiteActionButton, com a causa e "Tentar de novo" na falha. Sem toast.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { LiteActionButton, LiteMenu } from "@/components/lite/controls";
import controls from "@/components/lite/controls/controls.module.css";
import form from "@/components/lite/page/lite-form.module.css";
import { actionErrorMessage, normalizeActionError } from "@/lib/feedback/action-error";
import { useFeedback } from "@/lib/feedback/use-feedback";

import { ANONYMIZE_CONFIRMATION_WORD, MAX_ANONYMIZE_REASON_LENGTH, validateAnonymizeRequest } from "./data-subject";
import { anonymizeLeadDataSubjectAction, exportLeadDataSubjectAction } from "./data-subject-actions";
import styles from "./lead-data-subject-menu.module.css";

type ExportStatus = { state: "busy" } | { state: "done" } | { state: "error"; message: string } | null;

function download(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function LeadDataSubjectMenu({ leadId, anonymized = false }: { leadId: string; anonymized?: boolean }) {
  const fire = useFeedback();
  const router = useRouter();
  const [exportStatus, setExportStatus] = useState<ExportStatus>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const runExport = useCallback(async () => {
    setExportStatus({ state: "busy" });
    fire("tap");
    const result = await exportLeadDataSubjectAction(leadId).catch(() => ({ ok: false as const, error: "Não deu para gerar o arquivo agora." }));
    if (!result.ok) {
      fire("error");
      setExportStatus({ state: "error", message: actionErrorMessage(normalizeActionError(result.error, "Não deu para gerar o arquivo agora."), "Os dados do lead continuam como estavam.") });
      return;
    }
    download(result.filename, result.content);
    fire("confirm");
    setExportStatus({ state: "done" });
  }, [fire, leadId]);

  return (
    <div className={styles.wrap}>
      {exportStatus?.state === "busy" ? <p className={styles.status} role="status">Gerando arquivo…</p> : null}
      {exportStatus?.state === "done" ? <p className={styles.status} role="status">Arquivo do titular baixado</p> : null}
      {exportStatus?.state === "error" ? (
        <>
          <p className={styles.status} data-tone="danger" role="alert">{exportStatus.message}</p>
          <button type="button" className={styles.retry} onClick={() => void runExport()}>Tentar de novo</button>
        </>
      ) : null}
      <LiteMenu
        label="Pedido do titular (LGPD)"
        items={[
          { id: "exportar", label: "Exportar dados do titular", onSelect: () => void runExport(), disabled: exportStatus?.state === "busy" },
          { id: "anonimizar", label: anonymized ? "Titular já anonimizado" : "Anonimizar titular", tone: "danger", onSelect: () => setDialogOpen(true), disabled: anonymized },
        ]}
      />
      {dialogOpen ? (
        <AnonymizeDialog
          onCancel={() => setDialogOpen(false)}
          onAnonymize={async (confirmation, reason) => {
            const result = await anonymizeLeadDataSubjectAction({ leadId, confirmation, reason });
            if (!result.ok) return { ok: false, error: result.error };
            return { ok: true };
          }}
          onDone={() => {
            setDialogOpen(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function AnonymizeDialog({ onCancel, onAnonymize, onDone }: {
  onCancel: () => void;
  onAnonymize: (confirmation: string, reason: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  onDone: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const valid = validateAnonymizeRequest({ confirmation, reason }).ok;

  // Só ao abrir: foco em "Cancelar", Esc cancela e o foco volta ao ⋯ ao fechar (o onCancel do pai muda a cada render).
  const cancelHandler = useRef(onCancel);
  useEffect(() => { cancelHandler.current = onCancel; }, [onCancel]);
  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") cancelHandler.current(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      returnTo?.focus?.();
    };
  }, []);

  return (
    <div className={controls.scrim}>
      <div role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className={controls.dialog}>
        <h2 id={titleId} className={controls.dialogTitle}>Anonimizar este titular?</h2>
        <div id={descriptionId} className={controls.dialogDescription}>
          Nome vira &quot;Titular anonimizado&quot;. Telefone, e-mail, CPF, nascimento, anotações, mensagens, conversas da IA, cotações, propostas e documentos enviados perdem o dado pessoal. Valores, número da apólice, comissão e números do relatório continuam. Não dá para desfazer.
        </div>
        <div className={styles.fields}>
          <label className={form.field}>
            <span className={form.label}>Motivo do pedido</span>
            <textarea className={form.textarea} value={reason} maxLength={MAX_ANONYMIZE_REASON_LENGTH} onChange={(event) => setReason(event.target.value)} placeholder="Ex.: pedido do titular por e-mail em 26/11" />
          </label>
          <label className={form.field}>
            <span className={form.label}>Digite {ANONYMIZE_CONFIRMATION_WORD} para confirmar</span>
            <input className={form.input} value={confirmation} autoComplete="off" autoCapitalize="characters" spellCheck={false} onChange={(event) => setConfirmation(event.target.value)} />
          </label>
        </div>
        <div className={controls.dialogActions}>
          <button ref={cancelRef} type="button" className={controls.dialogButton} onClick={onCancel}>Cancelar</button>
          <LiteActionButton
            busyLabel="Anonimizando…"
            doneLabel="Titular anonimizado"
            disabled={!valid}
            keeps="Os dados do titular continuam como estavam."
            errorFallback="Não deu para anonimizar agora."
            onAction={async () => {
              const result = await onAnonymize(confirmation, reason);
              return result.ok ? { ok: true } : { ok: false, error: result.error };
            }}
            onDone={() => onDone()}
          >
            Anonimizar titular
          </LiteActionButton>
        </div>
      </div>
    </div>
  );
}
