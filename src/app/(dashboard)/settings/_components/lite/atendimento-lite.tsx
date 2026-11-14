"use client";

/**
 * "Atendimento" no visual Lite: lembretes de feedback e limite da distribuição (mesma Server Action e mesmos campos do
 * formulário atual, com a mesma regra `canEdit`) e a escolha da etapa do lead pela IA (mesma ação, com volta ao valor
 * anterior se falhar).
 *
 * Feedback (FEEDBACK.md, nível 1): salvar e trocar a etapa pela IA confirmam na própria seção depois do servidor; a
 * falha mostra a causa, o que continua valendo e "Tentar de novo". Sem toast.
 */
import { useActionState, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { BadgeCheck, Save } from "lucide-react";

import { RadioCards } from "@/components/arc/radio-cards/radio-cards";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import { updateAiStageModeAction } from "@/features/conversation-intelligence/actions";
import type { AiStageMode } from "@/features/conversation-intelligence/stage-mode";

import { updateFeedbackSettingsAction } from "../../feedback-actions";
import styles from "@/components/lite/page/lite-sections.module.css";

import { ActionNote, BusyLabel, useActionStatus } from "./action-status-lite";

type FeedbackProps = {
  feedbackReminderInterval: string;
  feedbackReminderMaxAttempts: number;
  feedbackPushEnabled: boolean;
  feedbackToastEnabled: boolean;
  feedbackRequiredEnabled: boolean;
  maxActiveLeadsLimit: number;
  canEdit: boolean;
};

function CheckRow({ name, title, description, defaultChecked, disabled }: { name: string; title: string; description: string; defaultChecked: boolean; disabled: boolean }) {
  return (
    <label className={styles.check}>
      <input type="checkbox" name={name} value="true" defaultChecked={defaultChecked} disabled={disabled} />
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{title}</span>
        <span className={styles.rowDescription}>{description}</span>
      </span>
    </label>
  );
}

export function FeedbackLite(props: FeedbackProps) {
  const { canEdit } = props;
  const formRef = useRef<HTMLFormElement>(null);
  const { status, confirm, fail } = useActionStatus();
  const [, formAction, isPending] = useActionState(
    async (prev: { success: boolean; error?: string }, formData: FormData) => {
      let result: Awaited<ReturnType<typeof updateFeedbackSettingsAction>>;
      try {
        result = await updateFeedbackSettingsAction(prev, formData);
      } catch (error) {
        result = { success: false, error: error instanceof Error ? error.message : undefined };
      }
      if (result.success) confirm("save", "Configuração salva");
      else fail("save", result.error, { fallback: "Não deu para salvar a configuração agora.", keeps: "A configuração anterior continua valendo.", retry: () => formRef.current?.requestSubmit() });
      return result;
    },
    { success: false },
  );

  return (
    <form ref={formRef} action={formAction} className={styles.group} aria-label="Lembretes de feedback e distribuição">
      <div className={styles.formBody}>
        <div className={styles.fields}>
          <label className={form.field}>
            <span className={form.label}>Intervalo entre lembretes (minutos)</span>
            <input className={form.input} type="number" name="feedbackReminderInterval" defaultValue={props.feedbackReminderInterval} min={1} max={1440} disabled={!canEdit} />
            <span className={form.hint}>Quanto tempo o sistema espera antes do próximo lembrete. De 1 a 1440 (24h).</span>
          </label>
          <label className={form.field}>
            <span className={form.label}>Máximo de tentativas</span>
            <input className={form.input} type="number" name="feedbackReminderMaxAttempts" defaultValue={props.feedbackReminderMaxAttempts} min={1} max={50} disabled={!canEdit} />
            <span className={form.hint}>No limite, o lembrete fica urgente e avisa os supervisores. De 1 a 50.</span>
          </label>
        </div>
      </div>
      <CheckRow name="feedbackToastEnabled" title="Aviso na tela" description="Mostra um aviso persistente no canto da tela com &quot;Registrar agora&quot; e &quot;Lembrar depois&quot;." defaultChecked={props.feedbackToastEnabled} disabled={!canEdit} />
      <CheckRow name="feedbackPushEnabled" title="Notificação push" description="Envia uma notificação ao navegador quando o corretor estiver ausente. A capacidade global precisa estar ativa." defaultChecked={props.feedbackPushEnabled} disabled={!canEdit} />
      <CheckRow name="feedbackRequiredEnabled" title="Feedback obrigatório" description="Exige que o corretor registre o feedback no prazo. Depois do vencimento, o SLA é acionado e o lead pode ser redistribuído." defaultChecked={props.feedbackRequiredEnabled} disabled={!canEdit} />
      <div className={styles.formBody}>
        <p className={styles.rowTitle}>Distribuição automática de leads</p>
        <label className={form.field}>
          <span className={form.label}>Limite de leads pendentes ou ativos</span>
          <input className={form.input} type="number" name="maxActiveLeadsLimit" defaultValue={props.maxActiveLeadsLimit} min={1} max={100} disabled={!canEdit} />
          <span className={form.hint}>Quem tem menos leads ativos ou pendentes que este limite recebe prioridade. Se todos estiverem acima, a distribuição segue normal entre todos.</span>
        </label>
      </div>
      <div className={styles.footer}>
        <Link href="/settings/feedback-templates" className={styles.link}>
          <BadgeCheck aria-hidden="true" size={16} />
          Gerenciar modelos de checklist
        </Link>
        {canEdit ? (
          <div className={styles.footerEnd}>
            {isPending ? null : <ActionNote status={status.save} />}
            <button type="submit" className={page.primaryButton} disabled={isPending} aria-busy={isPending || undefined}>
              <BusyLabel busy={isPending} label="Salvando…"><Save aria-hidden="true" size={16} />Salvar configuração</BusyLabel>
            </button>
          </div>
        ) : null}
      </div>
    </form>
  );
}

const STAGE_OPTIONS: Array<{ value: AiStageMode; label: string; description: string }> = [
  { value: "auto", label: "Automático", description: "A IA lê a conversa e avança a etapa sozinha quando tem certeza. O corretor pode desfazer em até 24h. Perdido e voltar etapa ficam como sugestão." },
  { value: "suggest", label: "Só sugerir", description: "A IA mostra \"Mover para\" no lead e o corretor decide se aceita ou recusa." },
  { value: "off", label: "Desligado", description: "A IA não muda nem sugere etapa. O diagnóstico da conversa continua aparecendo no lead." },
];

export function StageModeLite({ initialMode }: { initialMode: AiStageMode }) {
  const [mode, setMode] = useState(initialMode);
  const [isPending, startTransition] = useTransition();
  const { status, run } = useActionStatus();

  const choose = (value: string) => {
    const next = value as AiStageMode;
    if (next === mode) return;
    const previous = mode;
    const label = (target: AiStageMode) => STAGE_OPTIONS.find((option) => option.value === target)?.label ?? target;
    setMode(next);
    startTransition(async () => {
      const done = await run("stage", async () => {
        const result = await updateAiStageModeAction(next);
        if (!result.success) return { ok: false as const, error: result.error };
        setMode(next);
        return result;
      }, { done: `Etapa pela IA: ${label(next)}`, fallback: "Não deu para salvar a escolha agora.", keeps: `Continua em ${label(previous)}.` });
      if (!done) setMode(previous);
    });
  };

  return (
    <section className={styles.group} aria-labelledby="stage-mode-title">
      <div className={styles.row}>
        <div className={styles.rowText}>
          <h3 id="stage-mode-title" className={styles.rowTitle}>Etapa do lead pela IA</h3>
          <p className={styles.rowDescription}>A IA lê a conversa de WhatsApp entre o cliente e o corretor e identifica em que etapa o atendimento está.</p>
          {isPending ? <p className={styles.note} role="status">Salvando…</p> : <ActionNote status={status.stage} />}
        </div>
      </div>
      <div className={styles.formBody}>
        <RadioCards aria-label="Etapa do lead pela IA" layout="list" options={STAGE_OPTIONS} value={mode} onValueChange={choose} disabled={isPending} />
      </div>
    </section>
  );
}
