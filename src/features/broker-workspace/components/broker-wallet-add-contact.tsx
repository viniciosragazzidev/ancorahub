"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { Textarea } from "@/components/arc/textarea/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import type { BrokerWalletContactField, BrokerWalletContactResult } from "@/features/customers/broker-wallet-contact";

import styles from "./broker-my-wallet.module.css";

type Draft = { nome: string; telefone: string; email: string; observacao: string };
const EMPTY: Draft = { nome: "", telefone: "", email: "", observacao: "" };

type Duplicate = Extract<BrokerWalletContactResult, { duplicate: unknown }>["duplicate"];

export type BrokerWalletAddContactAction = (input: Draft & { consentimentoLgpd: boolean; duplicateConfirmed?: boolean }) => Promise<BrokerWalletContactResult>;

/**
 * "Adicionar contato" da Minha carteira. Nesta etapa só existe **Novo interessado** (cadastro manual existente);
 * "Cliente que já possuo" depende do modelo da etapa 4b e não aparece. O que foi digitado fica no painel quando
 * há erro ou aviso de duplicidade.
 */
export function BrokerWalletAddContact({ action }: { action: BrokerWalletAddContactAction }) {
  const router = useRouter();
  const consentId = useId();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [consent, setConsent] = useState(false);
  const [duplicate, setDuplicate] = useState<Duplicate | null>(null);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<BrokerWalletContactField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ leadId: string; name: string; noteSaved: boolean; withNote: boolean } | null>(null);

  function reset() {
    setDraft(EMPTY);
    setConsent(false);
    setDuplicate(null);
    setConfirmDuplicate(false);
    setFieldErrors({});
    setError(null);
    setCreated(null);
  }

  function update(field: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    // Outro telefone pede uma nova checagem de duplicidade.
    if (field === "telefone") {
      setDuplicate(null);
      setConfirmDuplicate(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      let result: BrokerWalletContactResult;
      try {
        result = await action({ ...draft, consentimentoLgpd: consent, ...(duplicate && confirmDuplicate ? { duplicateConfirmed: true } : {}) });
      } catch {
        setError("Sem conexão com o servidor. Confira a internet e tente de novo.");
        return;
      }
      if (result.ok) {
        setCreated({ leadId: result.leadId, name: draft.nome.trim(), noteSaved: result.noteSaved, withNote: Boolean(draft.observacao.trim()) });
        router.refresh();
        return;
      }
      if ("duplicate" in result) {
        setDuplicate(result.duplicate);
        setConfirmDuplicate(false);
        return;
      }
      setFieldErrors(result.fieldErrors ?? {});
      setError(result.error);
    });
  }

  return (
    <BottomSheet
      className="arc-venancor"
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next && created) reset();
      }}
      trigger={<Button variant="primary" className={styles.addButton}><Plus aria-hidden="true" className={styles.addIcon} />Adicionar contato</Button>}
      title="Adicionar contato"
      description={created ? undefined : "Novo interessado: entra em Em negociação com você como responsável."}
      closeLabel="Fechar"
      detents={[0.92]}
    >
      {created ? (
        <div className={styles.sheetBody} role="status">
          <p className={styles.successTitle}>{created.name} foi cadastrado.</p>
          <p className={styles.sheetText}>
            O contato está em Em negociação, com você como responsável.
            {created.withNote && !created.noteSaved ? " A observação não foi salva; registre-a na conversa do lead." : ""}
          </p>
          <div className={styles.sheetButtons}>
            <Link className={styles.primaryLink} href={`/leads/${encodeURIComponent(created.leadId)}`}>Abrir conversa</Link>
            <Button variant="secondary" onClick={reset}>Adicionar outro</Button>
          </div>
        </div>
      ) : (
        <form className={styles.sheetBody} onSubmit={submit} noValidate>
          <h3 className={styles.kind}>Novo interessado</h3>
          <Input label="Nome" name="nome" autoComplete="name" value={draft.nome} onChange={(event) => update("nome", event.target.value)} error={fieldErrors.nome} required maxLength={120} />
          <Input label="Telefone" name="telefone" type="tel" inputMode="tel" autoComplete="tel" placeholder="11 99999-9999" value={draft.telefone} onChange={(event) => update("telefone", event.target.value)} error={fieldErrors.telefone} required />
          <Input label="E-mail (opcional)" name="email" type="email" inputMode="email" autoComplete="email" value={draft.email} onChange={(event) => update("email", event.target.value)} error={fieldErrors.email} maxLength={254} />
          <div className={styles.readonlyField}>
            <span className={styles.readonlyLabel}>Origem</span>
            <span>Cadastro manual</span>
          </div>
          <Textarea label="Observação (opcional)" name="observacao" value={draft.observacao} onChange={(event) => update("observacao", event.target.value)} error={fieldErrors.observacao} maxLength={2000} rows={3} description="Fica como primeira nota da conversa." />

          <div className={styles.consent} data-invalid={fieldErrors.consentimentoLgpd ? "true" : undefined}>
            <Checkbox id={consentId} checked={consent} onCheckedChange={(checked) => { setConsent(checked === true); setFieldErrors((current) => ({ ...current, consentimentoLgpd: undefined })); }} aria-invalid={fieldErrors.consentimentoLgpd ? true : undefined} />
            <label htmlFor={consentId}>
              <strong>Consentimento LGPD</strong>
              <span>O contato autorizou o uso dos dados para a contratação de plano de saúde.</span>
            </label>
          </div>
          {fieldErrors.consentimentoLgpd ? <p className={styles.fieldError} role="alert">{fieldErrors.consentimentoLgpd}</p> : null}

          {duplicate ? (
            <div className={styles.duplicate} role="alert">
              {duplicate.mine ? (
                <p>Você já tem <strong>{duplicate.name}</strong> com este telefone. <Link href={`/leads/${encodeURIComponent(duplicate.leadId)}`}>Abrir o contato</Link></p>
              ) : (
                <p>Este telefone já está cadastrado na corretora. Se for outra pessoa, confirme abaixo; em caso de dúvida, fale com a gestão.</p>
              )}
              <label className={styles.duplicateConfirm}>
                <Checkbox checked={confirmDuplicate} onCheckedChange={(checked) => setConfirmDuplicate(checked === true)} />
                <span>Confirmo que é um novo contato</span>
              </label>
            </div>
          ) : null}

          {error ? <p className={styles.fieldError} role="alert">{error}</p> : null}
          <Button type="submit" size="lg" loading={pending} disabled={pending || Boolean(duplicate && !confirmDuplicate)}>
            Cadastrar interessado
          </Button>
        </form>
      )}
    </BottomSheet>
  );
}
