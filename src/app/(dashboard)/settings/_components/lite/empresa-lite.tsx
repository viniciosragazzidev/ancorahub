"use client";

/**
 * "Empresa" no visual Lite: dados da corretora (só leitura) e a identidade visual (logo e cor). Mesma Server Action,
 * mesmas mensagens e a mesma regra de edição (`canEdit`) da aba atual.
 */
import { useActionState } from "react";
import { Loader2, Save } from "lucide-react";

import compat from "@/components/lite/page/lite-compat.module.css";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import { toast } from "@/components/ui/sonner";

import { updateTenantBrandingAction } from "../../actions";
import { ColorPicker } from "../color-picker";
import { LogoUpload } from "../logo-upload";
import styles from "@/components/lite/page/lite-sections.module.css";

type Tenant = { name: string; legalName: string | null; cnpj: string | null; logoUrl: string | null; brandColor: string | null };

export function EmpresaLite({ tenant, canEdit }: { tenant: Tenant; canEdit: boolean }) {
  const [state, formAction, isPending] = useActionState(
    async (prev: { success: boolean; error?: string }, formData: FormData) => {
      const result = await updateTenantBrandingAction(prev, formData);
      if (result.success) toast.success("Identidade visual salva!");
      else toast.error(result.error ?? "Erro ao salvar.");
      return result;
    },
    { success: false },
  );

  return (
    <form action={formAction} className={styles.group}>
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
        {state.error ? <p className={styles.error} role="alert">{state.error}</p> : null}
      </div>
      <div className={styles.footer}>
        {!canEdit ? <p className={styles.note}>A identidade visual pode ser alterada apenas pelo Diretor.</p> : null}
        <div className={styles.footerEnd}>
          <button type="submit" className={page.primaryButton} disabled={isPending || !canEdit}>
            {isPending ? <Loader2 aria-hidden="true" size={16} className="animate-spin" /> : <Save aria-hidden="true" size={16} />}
            Salvar alterações
          </button>
        </div>
      </div>
    </form>
  );
}
