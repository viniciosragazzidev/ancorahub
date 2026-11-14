"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { Textarea } from "@/components/arc/textarea/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { PRIOR_CONTRACTS_MAX, type PriorClientInput, type PriorClientResult } from "@/features/customers/prior-portfolio-input";
import { useCampoMascarado } from "@/shared/input/use-campo-mascarado";

import styles from "./broker-my-wallet.module.css";
import { contractErrors, EMPTY_PRIOR_CONTRACT, PriorContractFields, type PriorContractDraft } from "./prior-contract-fields";

export type PriorClientAction = (input: PriorClientInput) => Promise<PriorClientResult>;

type Draft = { nome: string; telefone: string; email: string; observacao: string };
const EMPTY: Draft = { nome: "", telefone: "", email: "", observacao: "" };
type Duplicate = Extract<PriorClientResult, { duplicate: unknown }>["duplicate"];

/**
 * Cliente que já possuo (DEC-187): nome, telefone, e-mail e observação opcionais, e contratos anteriores
 * opcionais. Não cria lead nem venda; o que não for informado fica pendente no perfil.
 */
export function PriorClientForm({ action, onCreatedChange }: { action: PriorClientAction; onCreatedChange: (created: boolean) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [contracts, setContracts] = useState<PriorContractDraft[]>([]);
  const [duplicate, setDuplicate] = useState<Duplicate | null>(null);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ clientId: string; name: string } | null>(null);
  const telefone = useCampoMascarado("telefone", draft.telefone, (valor) => update("telefone", valor));

  function reset() {
    setDraft(EMPTY);
    setContracts([]);
    setDuplicate(null);
    setConfirmDuplicate(false);
    setFieldErrors({});
    setError(null);
    setCreated(null);
    onCreatedChange(false);
  }

  function update(field: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    if (field === "telefone") {
      setDuplicate(null);
      setConfirmDuplicate(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      let result: PriorClientResult;
      try {
        result = await action({ ...draft, contracts, ...(duplicate && confirmDuplicate ? { duplicateConfirmed: true } : {}) } as PriorClientInput);
      } catch {
        setError("Sem conexão com o servidor. Confira a internet e tente de novo.");
        return;
      }
      if (result.ok) {
        setCreated({ clientId: result.clientId, name: draft.nome.trim() });
        onCreatedChange(true);
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

  if (created) {
    return (
      <div className={styles.sheetBody} role="status">
        <p className={styles.successTitle}>{created.name} está na sua carteira.</p>
        <p className={styles.sheetText}>Aparece em Clientes com o selo Carteira anterior. Nenhuma venda, comissão ou ponto foi gerado.</p>
        <div className={styles.sheetButtons}>
          <Link className={styles.primaryLink} href={`/clientes/${encodeURIComponent(created.clientId)}`}>Abrir perfil</Link>
          <Button variant="secondary" onClick={reset}>Adicionar outro</Button>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.sheetBody} onSubmit={submit} noValidate>
      <Input label="Nome" autoComplete="name" value={draft.nome} onChange={(event) => update("nome", event.target.value)} error={fieldErrors.nome} required maxLength={120} />
      <Input label="Telefone" type="tel" autoComplete="tel" placeholder="(11) 99999-9999" {...telefone} error={fieldErrors.telefone} required />
      <Input label="E-mail (opcional)" type="email" inputMode="email" autoComplete="email" value={draft.email} onChange={(event) => update("email", event.target.value)} error={fieldErrors.email} maxLength={254} />
      <Textarea label="Observação (opcional)" value={draft.observacao} onChange={(event) => update("observacao", event.target.value)} error={fieldErrors.observacao} maxLength={2000} rows={3} description="Por exemplo, de onde veio o cliente." />

      {contracts.map((contract, index) => (
        <div key={index} className={styles.contractBlock}>
          <PriorContractFields
            label={`Contrato ${index + 1}`}
            value={contract}
            errors={contractErrors(fieldErrors, `contracts.${index}`)}
            onChange={(next) => setContracts((current) => current.map((item, position) => position === index ? next : item))}
          />
          <Button type="button" variant="secondary" onClick={() => setContracts((current) => current.filter((_, position) => position !== index))}>Tirar contrato {index + 1}</Button>
        </div>
      ))}
      {contracts.length < PRIOR_CONTRACTS_MAX ? (
        <Button type="button" variant="secondary" onClick={() => setContracts((current) => [...current, EMPTY_PRIOR_CONTRACT])}>
          {contracts.length ? "Adicionar outro contrato" : "Adicionar contrato (opcional)"}
        </Button>
      ) : null}
      {fieldErrors.contracts ? <p className={styles.fieldError} role="alert">{fieldErrors.contracts}</p> : null}

      {duplicate ? (
        <div className={styles.duplicate} role="alert">
          {duplicate.mine ? (
            <p>Você já tem <strong>{duplicate.name}</strong> com este telefone. <Link href={duplicate.href}>Abrir o registro</Link></p>
          ) : (
            <p>Este telefone já está cadastrado na corretora. Se for outra pessoa, confirme abaixo; em caso de dúvida, fale com a gestão.</p>
          )}
          <label className={styles.duplicateConfirm}>
            <Checkbox checked={confirmDuplicate} onCheckedChange={(checked) => setConfirmDuplicate(checked === true)} />
            <span>Confirmo que é outro cliente</span>
          </label>
        </div>
      ) : null}

      {error ? <p className={styles.fieldError} role="alert">{error}</p> : null}
      <Button type="submit" size="lg" loading={pending} disabled={pending || Boolean(duplicate && !confirmDuplicate)}>
        Cadastrar cliente
      </Button>
    </form>
  );
}
