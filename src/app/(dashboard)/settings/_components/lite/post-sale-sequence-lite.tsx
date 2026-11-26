"use client";

/**
 * "Sequência de pós-venda" nas configurações Lite (só o diretor): quando o lead vira venda, o corretor dono ganha as
 * tarefas dos 3 passos, às 9h de São Paulo (domingo vira segunda). Liga e desliga, e ajusta dias e títulos.
 *
 * Feedback (FEEDBACK.md, nível 1): salvar mostra o envio no botão e confirma no rodapé depois do servidor; a falha
 * mostra a causa, o que continua valendo e "Tentar de novo". Sem toast.
 */
import { useActionState, useRef } from "react";
import { Save } from "lucide-react";

import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import styles from "@/components/lite/page/lite-sections.module.css";
import { updatePostSaleSequenceAction, type PostSaleSequenceActionState } from "@/features/leads/post-sale-sequence-actions";
import {
  MAX_POST_SALE_SEQUENCE_DAYS,
  MAX_POST_SALE_SEQUENCE_TITLE,
  MIN_POST_SALE_SEQUENCE_DAYS,
  type PostSaleSequenceSettings,
} from "@/features/leads/post-sale-sequence-core";

import { ActionNote, BusyLabel, useActionStatus } from "./action-status-lite";

export function PostSaleSequenceLite({ settings }: { settings: PostSaleSequenceSettings }) {
  const formRef = useRef<HTMLFormElement>(null);
  const { status, confirm, fail } = useActionStatus();
  const [, formAction, isPending] = useActionState(
    async (prev: PostSaleSequenceActionState, formData: FormData) => {
      let result: PostSaleSequenceActionState;
      try {
        result = await updatePostSaleSequenceAction(prev, formData);
      } catch (error) {
        result = { success: false, error: error instanceof Error ? error.message : undefined };
      }
      if (result.success) confirm("save", result.settings?.enabled === false ? "Sequência desligada" : "Sequência salva");
      else fail("save", result.error, { fallback: "Não deu para salvar a sequência de pós-venda agora.", keeps: "A sequência anterior continua valendo.", retry: () => formRef.current?.requestSubmit() });
      return result;
    },
    { success: false },
  );

  return (
    <form ref={formRef} action={formAction} className={styles.group}>
      <label className={styles.check}>
        <input type="checkbox" name="enabled" value="true" defaultChecked={settings.enabled} />
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>Criar as tarefas a cada venda</span>
          <span className={styles.rowDescription}>Vão para o corretor dono do lead, às 9h. Domingo passa para segunda. Uma vez por lead.</span>
        </span>
      </label>
      <div className={styles.formBody}>
        {settings.steps.map((step, index) => (
          <div key={step.id} className={styles.fields}>
            <label className={form.field}>
              <span className={form.label}>Passo {index + 1}</span>
              <input
                name={`title-${step.id}`}
                required
                minLength={2}
                maxLength={MAX_POST_SALE_SEQUENCE_TITLE}
                defaultValue={step.title}
                className={form.input}
              />
            </label>
            <label className={form.field}>
              <span className={form.label}>Dias depois da venda</span>
              <input
                name={`days-${step.id}`}
                type="number"
                inputMode="numeric"
                min={MIN_POST_SALE_SEQUENCE_DAYS}
                max={MAX_POST_SALE_SEQUENCE_DAYS}
                step={1}
                required
                defaultValue={step.days}
                className={`${form.input} ${page.numeric}`}
              />
            </label>
          </div>
        ))}
        <span className={form.hint}>Vale para as próximas vendas. Tarefas já criadas não mudam.</span>
      </div>
      <div className={styles.footer}>
        <div className={styles.footerEnd}>
          {isPending ? null : <ActionNote status={status.save} />}
          <button type="submit" className={page.primaryButton} disabled={isPending} aria-busy={isPending || undefined}>
            <BusyLabel busy={isPending} label="Salvando…"><Save aria-hidden="true" size={16} />Salvar sequência</BusyLabel>
          </button>
        </div>
      </div>
    </form>
  );
}
