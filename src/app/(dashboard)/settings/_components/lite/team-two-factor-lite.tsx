"use client";

/**
 * "Exigir verificação em duas etapas da equipe" na Segurança do Lite (só o diretor). Escolhe de quem exigir e a
 * carência em dias. Quem está obrigado e ainda não tem 2FA nem chave de acesso vê um aviso durante a carência e,
 * depois dela, só consegue usar as configurações até ativar (regra em features/security/two-factor-policy.ts).
 *
 * Feedback (FEEDBACK.md, nível 1): salvar mostra o envio no botão e confirma no rodapé depois do servidor; a falha
 * mostra a causa, o que continua valendo e "Tentar de novo".
 */
import { useActionState, useRef, useState } from "react";
import { Save } from "lucide-react";

import { LiteSelect } from "@/components/lite/controls";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import styles from "@/components/lite/page/lite-sections.module.css";
import { updateTwoFactorPolicyAction, type TwoFactorPolicyActionState } from "@/features/security/two-factor-policy-actions";
import { MAX_TWO_FACTOR_GRACE_DAYS, MIN_TWO_FACTOR_GRACE_DAYS, type TwoFactorPolicy, type TwoFactorPolicyScope } from "@/features/security/two-factor-policy";

import { ActionNote, BusyLabel, useActionStatus } from "./action-status-lite";

const SCOPE_OPTIONS: { value: TwoFactorPolicyScope; label: string }[] = [
  { value: "off", label: "Não exigir" },
  { value: "team", label: "Corretor e acima (toda a equipe)" },
  { value: "management", label: "Só a gestão (supervisor, gestor e diretor)" },
];

const sinceFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });

export function TeamTwoFactorLite({ policy: initialPolicy }: { policy: TwoFactorPolicy }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [policy, setPolicy] = useState(initialPolicy);
  const [scope, setScope] = useState<TwoFactorPolicyScope>(initialPolicy.scope);
  const { status, confirm, fail } = useActionStatus();
  const [, formAction, isPending] = useActionState(
    async (prev: TwoFactorPolicyActionState, formData: FormData) => {
      let result: TwoFactorPolicyActionState;
      try {
        result = await updateTwoFactorPolicyAction(prev, formData);
      } catch (error) {
        result = { success: false, error: error instanceof Error ? error.message : undefined };
      }
      if (result.success && result.policy) {
        setPolicy(result.policy);
        confirm("save", result.policy.scope === "off" ? "A equipe não é mais obrigada" : "Exigência salva");
      } else {
        fail("save", result.error, { fallback: "Não deu para salvar a exigência agora.", keeps: "A regra anterior continua valendo.", retry: () => formRef.current?.requestSubmit() });
      }
      return result;
    },
    { success: false },
  );

  const active = policy.scope !== "off" && policy.since;

  return (
    <form ref={formRef} action={formAction} className={styles.group} aria-labelledby="team-two-factor-title">
      <div className={styles.row}>
        <div className={styles.rowText}>
          <h3 id="team-two-factor-title" className={styles.rowTitle}>Exigir verificação em duas etapas da equipe</h3>
          <p className={styles.rowDescription}>A corretora lida com CPF e dados de saúde. Chave de acesso também vale como segundo fator.</p>
        </div>
        <span className={page.badge} data-tone={active ? "success" : undefined}>{active ? "Exigido" : "Opcional"}</span>
      </div>
      <div className={styles.formBody}>
        <div className={styles.fields}>
          <input type="hidden" name="scope" value={scope} />
          <LiteSelect label="De quem exigir" value={scope} options={SCOPE_OPTIONS} onChange={(value) => setScope(value as TwoFactorPolicyScope)} />
          <label className={form.field}>
            <span className={form.label}>Carência (dias)</span>
            <input
              name="graceDays"
              type="number"
              inputMode="numeric"
              min={MIN_TWO_FACTOR_GRACE_DAYS}
              max={MAX_TWO_FACTOR_GRACE_DAYS}
              step={1}
              required
              defaultValue={policy.graceDays}
              className={`${form.input} ${page.numeric}`}
            />
            <span className={form.hint}>Durante a carência a pessoa vê um aviso. Depois, só usa o sistema com 2FA ativo.</span>
          </label>
        </div>
        {active ? <p className={styles.note}>Exigido desde <span className={page.numeric}>{sinceFormat.format(new Date(policy.since!))}</span>. Quem entrar depois ganha a carência a partir da entrada.</p> : null}
      </div>
      <div className={styles.footer}>
        <div className={styles.footerEnd}>
          {isPending ? null : <ActionNote status={status.save} />}
          <button type="submit" className={page.button} disabled={isPending} aria-busy={isPending || undefined}>
            <BusyLabel busy={isPending} label="Salvando…"><Save aria-hidden="true" size={16} />Salvar exigência</BusyLabel>
          </button>
        </div>
      </div>
    </form>
  );
}
