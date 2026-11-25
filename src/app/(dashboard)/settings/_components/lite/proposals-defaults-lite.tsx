"use client";

/**
 * "Propostas" nas configurações Lite (só o diretor): validade e condições padrão da corretora. Toda proposta nova já
 * vem com esses valores, e o corretor ainda pode mudar na hora.
 *
 * Feedback (FEEDBACK.md, nível 1): salvar mostra o envio no botão e confirma no rodapé depois do servidor; a falha
 * mostra a causa, o que continua valendo e "Tentar de novo". Sem toast.
 */
import { useActionState, useRef } from "react";
import { Save } from "lucide-react";

import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import styles from "@/components/lite/page/lite-sections.module.css";
import { updateProposalDefaultsAction, type ProposalDefaultsActionState } from "@/features/proposals/defaults-actions";
import { MAX_PROPOSAL_CONDITIONS_LENGTH, MAX_PROPOSAL_VALID_DAYS, MIN_PROPOSAL_VALID_DAYS, type ProposalDefaults } from "@/features/proposals/proposal-rules";

import { ActionNote, BusyLabel, useActionStatus } from "./action-status-lite";

export function ProposalsDefaultsLite({ defaults }: { defaults: ProposalDefaults }) {
  const formRef = useRef<HTMLFormElement>(null);
  const { status, confirm, fail } = useActionStatus();
  const [, formAction, isPending] = useActionState(
    async (prev: ProposalDefaultsActionState, formData: FormData) => {
      let result: ProposalDefaultsActionState;
      try {
        result = await updateProposalDefaultsAction(prev, formData);
      } catch (error) {
        result = { success: false, error: error instanceof Error ? error.message : undefined };
      }
      if (result.success) confirm("save", "Padrões de proposta salvos");
      else fail("save", result.error, { fallback: "Não deu para salvar os padrões de proposta agora.", keeps: "Os padrões anteriores continuam valendo.", retry: () => formRef.current?.requestSubmit() });
      return result;
    },
    { success: false },
  );

  return (
    <form ref={formRef} action={formAction} className={styles.group}>
      <div className={styles.formBody}>
        <div className={styles.fields}>
          <label className={form.field}>
            <span className={form.label}>Validade padrão (dias)</span>
            <input
              name="validDays"
              type="number"
              inputMode="numeric"
              min={MIN_PROPOSAL_VALID_DAYS}
              max={MAX_PROPOSAL_VALID_DAYS}
              step={1}
              required
              defaultValue={defaults.validDays}
              className={`${form.input} ${page.numeric}`}
            />
            <span className={form.hint}>Conta a partir do dia em que a proposta é criada.</span>
          </label>
          <label className={form.field}>
            <span className={form.label}>Condições padrão</span>
            <textarea
              name="conditions"
              maxLength={MAX_PROPOSAL_CONDITIONS_LENGTH}
              defaultValue={defaults.conditions}
              className={form.textarea}
              placeholder="Ex.: Valores sujeitos à análise da operadora. Carências conforme contrato."
            />
            <span className={form.hint}>Entram nas observações de toda proposta nova.</span>
          </label>
        </div>
      </div>
      <div className={styles.footer}>
        <div className={styles.footerEnd}>
          {isPending ? null : <ActionNote status={status.save} />}
          <button type="submit" className={page.primaryButton} disabled={isPending} aria-busy={isPending || undefined}>
            <BusyLabel busy={isPending} label="Salvando…"><Save aria-hidden="true" size={16} />Salvar padrões</BusyLabel>
          </button>
        </div>
      </div>
    </form>
  );
}
