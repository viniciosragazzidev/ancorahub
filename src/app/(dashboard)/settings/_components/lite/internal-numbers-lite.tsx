"use client";

/**
 * "Números internos" nas configurações Lite (só o diretor): fornecedores, operadoras e família que escrevem no número
 * oficial ou no WhatsApp da empresa. Eles e a equipe ativa não viram lead nem entram na qualificação ou distribuição.
 *
 * Feedback (FEEDBACK.md, nível 1): salvar mostra o envio no botão e confirma na seção depois do servidor; a falha
 * mostra a causa, o que continua valendo e "Tentar de novo". Aviso de número de lead fica à vista, sem bloquear.
 */
import { useState } from "react";
import { Save } from "lucide-react";

import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import styles from "@/components/lite/page/lite-sections.module.css";
import { saveInternalNumbersAction } from "@/features/internal-contacts/actions";
import { MAX_INTERNAL_NUMBERS } from "@/features/internal-contacts/decision";

import { ActionNote, BusyLabel, useActionStatus } from "./action-status-lite";

export function InternalNumbersLite({ initialText, teamCount, save = saveInternalNumbersAction }: { initialText: string; teamCount: number; save?: typeof saveInternalNumbersAction }) {
  const [text, setText] = useState(initialText);
  const [warnings, setWarnings] = useState<string[]>([]);
  const { status, run, busy } = useActionStatus();
  const pending = busy("save");

  const submit = () => void run("save", async () => {
    const result = await save(text);
    if (result.success) setWarnings(result.warnings);
    return result;
  }, { done: "Números internos salvos", fallback: "Não deu para salvar os números internos agora.", keeps: "A lista anterior continua valendo." });

  return (
    <form className={styles.group} onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <div className={styles.formBody}>
        <div className={styles.fields}>
          <label className={form.field}>
            <span className={form.label}>Números internos</span>
            <textarea
              name="internalNumbers"
              value={text}
              onChange={(event) => setText(event.target.value)}
              className={form.textarea}
              inputMode="tel"
              placeholder={"(21) 99999-0000 Fornecedor\n(11) 3333-4444 Operadora"}
              aria-describedby="internal-numbers-hint"
            />
            <span id="internal-numbers-hint" className={form.hint}>
              Um por linha, com quem é depois do número. Quem está aqui e os {teamCount.toLocaleString("pt-BR")} da equipe ativa não viram lead nem falam com a IA. Até {MAX_INTERNAL_NUMBERS} números.
            </span>
          </label>
          {warnings.length ? (
            <div role="status" className={form.hint}>
              {warnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          ) : null}
        </div>
      </div>
      <div className={styles.footer}>
        <div className={styles.footerEnd}>
          {pending ? null : <ActionNote status={status.save} />}
          <button type="submit" className={page.primaryButton} disabled={pending} aria-busy={pending || undefined}>
            <BusyLabel busy={pending} label="Salvando…"><Save aria-hidden="true" size={16} />Salvar números</BusyLabel>
          </button>
        </div>
      </div>
    </form>
  );
}
