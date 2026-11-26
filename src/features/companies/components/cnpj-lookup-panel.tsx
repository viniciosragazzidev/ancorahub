"use client";

/**
 * "Consultar CNPJ": mostra razão social, situação cadastral, CNAE principal, cidade/UF e porte vindos da Receita
 * (BrasilAPI, consultada no servidor por `onLookup`). Nada é gravado aqui: "Usar estes dados" só aparece quando
 * quem usa passa `onUse`, e só grava quando a pessoa toca nele.
 */
import { useId, useState } from "react";

import { LiteActionButton, type LiteActionOutcome } from "@/components/lite/controls";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import { cnpjSituationWarning, type CnpjLookupData } from "@/features/companies/brasilapi-cnpj";
import { cnpjDigits, cnpjInputProblem, formatCnpj } from "@/features/companies/cnpj";
import type { CnpjLookupResult } from "@/features/companies/cnpj-lookup";

import styles from "./cnpj-lookup-panel.module.css";

export type CnpjLookupPanelProps = {
  initialCnpj?: string | null;
  onLookup: (cnpj: string) => Promise<CnpjLookupResult>;
  onUse?: (data: CnpjLookupData) => Promise<LiteActionOutcome>;
  /** O que "Usar estes dados" faz, em frase curta abaixo do botão. */
  useHint?: string;
  useDoneLabel?: string;
  /** Modo controlado: o CNPJ fica no formulário de quem usa (lead PJ) e o painel só consulta. */
  value?: string;
  onValueChange?: (value: string) => void;
  /** Esconde o campo do painel quando o formulário já tem o seu. */
  hideInput?: boolean;
};

export function CnpjLookupPanel({ initialCnpj, onLookup, onUse, useHint, useDoneLabel = "Dados gravados", value: controlled, onValueChange, hideInput = false }: CnpjLookupPanelProps) {
  const inputId = useId();
  const [own, setOwn] = useState(initialCnpj ? formatCnpj(initialCnpj) : "");
  const value = controlled ?? own;
  const setValue = (next: string | ((current: string) => string)) => {
    const resolved = typeof next === "function" ? next(value) : next;
    if (controlled === undefined) setOwn(resolved);
    onValueChange?.(resolved);
  };
  const [data, setData] = useState<CnpjLookupData | null>(null);
  const digits = cnpjDigits(value);
  const shown = data && cnpjDigits(data.cnpj) === digits ? data : null;
  const warning = shown ? cnpjSituationWarning(shown.situation) : null;

  async function consult(): Promise<LiteActionOutcome> {
    const problem = cnpjInputProblem(value);
    if (problem) return { ok: false, reason: problem, retryable: false };
    const result = await onLookup(digits);
    if (!result.ok) return result;
    setData(result.data);
    setValue(result.data.cnpj);
    return { ok: true };
  }

  const consultButton = (
    <LiteActionButton
      key={digits}
      size="sm"
      tone="secondary"
      busyLabel="Consultando…"
      doneLabel="Consultado"
      errorFallback="Não consegui consultar o CNPJ agora."
      keeps="O cadastro continua como estava."
      onAction={consult}
    >
      Consultar CNPJ
    </LiteActionButton>
  );

  return (
    <div className={styles.root}>
      {hideInput ? (
        <div className={styles.row}>{consultButton}</div>
      ) : (
      <div className={form.field}>
        <label htmlFor={inputId} className={form.label}>CNPJ</label>
        <div className={styles.row}>
          <input
            id={inputId}
            className={form.input}
            inputMode="numeric"
            autoComplete="off"
            placeholder="00.000.000/0000-00"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onBlur={() => setValue((current) => formatCnpj(current))}
          />
          {consultButton}
        </div>
        <p className={form.hint}>Só o CNPJ vai para a consulta da Receita.</p>
      </div>
      )}

      {shown ? (
        <section className={styles.result} aria-label="Dados da Receita">
          {warning ? <p role="alert" className={styles.warning}>{warning}</p> : null}
          <dl className={styles.facts}>
            <dt>Razão social</dt><dd>{shown.legalName}</dd>
            {shown.tradeName ? (<><dt>Nome fantasia</dt><dd>{shown.tradeName}</dd></>) : null}
            <dt>Situação</dt>
            <dd><span className={page.badge} data-tone={shown.active ? "success" : "danger"}>{shown.situationLabel}</span></dd>
            <dt>CNAE principal</dt><dd className={styles.numeric}>{shown.cnae ?? "Não informado"}</dd>
            <dt>Cidade</dt><dd>{shown.city ?? "Não informada"}</dd>
            <dt>Porte</dt><dd>{shown.size}</dd>
          </dl>
          {onUse ? (
            <div className={form.field}>
              <LiteActionButton
                key={shown.cnpj}
                size="sm"
                busyLabel="Gravando…"
                doneLabel={useDoneLabel}
                keeps="O cadastro continua como estava."
                onAction={() => onUse(shown)}
              >
                Usar estes dados
              </LiteActionButton>
              {useHint ? <p className={styles.hint}>{useHint}</p> : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
