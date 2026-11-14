"use client";

/**
 * "Empresa" no visual Lite: dados da corretora (só leitura) e a identidade visual (logo e cor). Mesma Server Action,
 * mesmas mensagens e a mesma regra de edição (`canEdit`) da aba atual.
 *
 * Feedback (FEEDBACK.md, nível 1): salvar mostra o envio no botão e confirma no rodapé depois do servidor; a falha
 * mostra a causa, o que continua valendo e "Tentar de novo". Sem toast.
 */
import { useActionState, useRef } from "react";
import { Save } from "lucide-react";

import compat from "@/components/lite/page/lite-compat.module.css";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";

import { updateTenantBrandingAction } from "../../actions";
import { ColorPicker } from "../color-picker";
import { LogoUpload } from "../logo-upload";
import styles from "@/components/lite/page/lite-sections.module.css";

import { ActionNote, BusyLabel, useActionStatus } from "./action-status-lite";

type Tenant = { name: string; legalName: string | null; cnpj: string | null; logoUrl: string | null; brandColor: string | null };

export function EmpresaLite({ tenant, canEdit }: { tenant: Tenant; canEdit: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const { status, confirm, fail } = useActionStatus();
  const [, formAction, isPending] = useActionState(
    async (prev: { success: boolean; error?: string }, formData: FormData) => {
      let result: Awaited<ReturnType<typeof updateTenantBrandingAction>>;
      try {
        result = await updateTenantBrandingAction(prev, formData);
      } catch (error) {
        result = { success: false, error: error instanceof Error ? error.message : undefined };
      }
      if (result.success) confirm("save", "Identidade visual salva");
      else fail("save", result.error, { fallback: "Não deu para salvar a identidade visual agora.", keeps: "O logo e a cor anteriores continuam valendo.", retry: () => formRef.current?.requestSubmit() });
      return result;
    },
    { success: false },
  );

  return (
    <form ref={formRef} action={formAction} className={styles.group}>
      <div className={styles.formBody}>
        <div className={styles.fields}>
          <label className={form.field}>
            <span className={form.label}>Nome da corretora</span>
            <input className={form.input} defaultValue={tenant.name} disabled />
          </label>
          <label className={form.field}>
            <span className={form.label}>CNPJ</span>
            <input className={form.input} defaultValue={tenant.cnpj ?? "Não informado"} disabled />
          </label>
          <label className={form.field}>
            <span className={form.label}>Razão social</span>
            <input className={form.input} defaultValue={tenant.legalName ?? "Não informada"} disabled />
          </label>
        </div>
      </div>
      <div className={styles.formBody}>
        <div className={styles.fields}>
          <div className={form.field}>
            <span className={form.label}>Logo da corretora</span>
            <div className={compat.compat}>
              <LogoUpload defaultValue={tenant.logoUrl} name="logoUrl" disabled={!canEdit} />
            </div>
          </div>
          <div className={form.field}>
            <span className={form.label}>Cor da marca</span>
            <div className={compat.compat}>
              <ColorPicker defaultValue={tenant.brandColor} name="brandColor" disabled={!canEdit} />
            </div>
          </div>
        </div>
      </div>
      <div className={styles.footer}>
        {!canEdit ? <p className={styles.note}>A identidade visual pode ser alterada apenas pelo Diretor.</p> : null}
        <div className={styles.footerEnd}>
          {isPending ? null : <ActionNote status={status.save} />}
          <button type="submit" className={page.primaryButton} disabled={isPending || !canEdit} aria-busy={isPending || undefined}>
            <BusyLabel busy={isPending} label="Salvando…"><Save aria-hidden="true" size={16} />Salvar alterações</BusyLabel>
          </button>
        </div>
      </div>
    </form>
  );
}
