"use client";

/**
 * Andamento da renovação na ficha Lite do cliente: a mesma Server Action (updateCustomerRenewalStatusAction) com os
 * mesmos argumentos, os mesmos avisos e o mesmo recarregamento do CustomerRenewalStatus de hoje. Campos de 44px.
 * Cliente cancelado: tudo travado, como hoje.
 */
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { LiteSelect } from "@/components/lite/controls";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import { toast } from "@/components/ui/sonner";
import { updateCustomerRenewalStatusAction } from "@/features/post-sale/actions";

import styles from "./client-detail-lite.module.css";

const renewalOptions = [
  { value: "pending_window", label: "Acompanhar no prazo" },
  { value: "in_renewal", label: "Renovação em andamento" },
  { value: "renewed", label: "Renovado" },
  { value: "churned", label: "Não renovado" },
] as const;

type RenewalStatus = (typeof renewalOptions)[number]["value"];

export function ClientRenewalLite({ activeCustomerId, initialStatus, initialNotes, disabled = false }: {
  activeCustomerId: string;
  initialStatus: RenewalStatus;
  initialNotes: string | null;
  disabled?: boolean;
}) {
  const router = useRouter();
  const notesId = useId();
  const [status, setStatus] = useState<RenewalStatus>(initialStatus);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await updateCustomerRenewalStatusAction({
        activeCustomerId,
        renewalStatus: status,
        renewalNotes: notes || undefined,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Acompanhamento de renovação atualizado.");
      router.refresh();
    });
  }

  const locked = disabled || pending;
  return (
    <div className={`${form.form} ${styles.divided}`}>
      {disabled ? (
        <div className={form.field}>
          <span className={form.label}>Andamento</span>
          <p className={styles.staticValue}>{renewalOptions.find((option) => option.value === status)?.label ?? status}</p>
        </div>
      ) : (
        <LiteSelect label="Andamento" value={status} options={renewalOptions.map((option) => ({ value: option.value, label: option.label }))} onChange={(value) => setStatus(value as RenewalStatus)} searchPlaceholder="Buscar andamento" />
      )}
      <div className={form.field}>
        <label htmlFor={notesId} className={form.label}>Observação</label>
        <input id={notesId} className={form.input} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: proposta enviada, aguardando retorno" maxLength={1000} disabled={locked} />
      </div>
      <button type="button" className={`${page.primaryButton} ${styles.fullButton}`} onClick={save} disabled={locked}>
        {pending ? "Salvando..." : "Salvar acompanhamento"}
      </button>
    </div>
  );
}
