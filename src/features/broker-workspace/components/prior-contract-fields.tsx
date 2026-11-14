"use client";

import { Input } from "@/components/arc/input/input";
import { AppSelect } from "@/components/ui/select";
import {
  PRIOR_CONTRACT_PRODUCTS,
  PRIOR_CONTRACT_STATUSES,
  PRIOR_PRODUCT_LABELS,
  PRIOR_STATUS_LABELS,
} from "@/features/customers/prior-portfolio-input";

import walletStyles from "./broker-client-wallet.module.css";
import styles from "./broker-my-wallet.module.css";

export type PriorContractDraft = {
  productType: string;
  carrierName: string;
  coverageStartDate: string;
  renewalDate: string;
  status: string;
};

export const EMPTY_PRIOR_CONTRACT: PriorContractDraft = { productType: "unknown", carrierName: "", coverageStartDate: "", renewalDate: "", status: "unknown" };

/**
 * Campos de um contrato anterior (DEC-187). Tudo é opcional: o que ficar em "Não informado" ou vazio aparece
 * como pendente no perfil. Não há valor nem comissão.
 */
export function PriorContractFields({
  value,
  onChange,
  errors = {},
  label,
}: {
  value: PriorContractDraft;
  onChange: (next: PriorContractDraft) => void;
  /** Erros por campo (`productType`, `carrierName`, `coverageStartDate`, `renewalDate`, `status`). */
  errors?: Record<string, string | undefined>;
  label: string;
}) {
  const set = (field: keyof PriorContractDraft, next: string) => onChange({ ...value, [field]: next });
  return (
    <fieldset className={styles.contractFields}>
      <legend className={styles.contractLegend}>{label}</legend>
      <div className={walletStyles.field}>
        <span>Produto</span>
        <AppSelect
          aria-label={`Produto (${label})`}
          value={value.productType}
          onValueChange={(next) => set("productType", next)}
          options={PRIOR_CONTRACT_PRODUCTS.map((product) => ({ value: product, label: PRIOR_PRODUCT_LABELS[product] }))}
          triggerClassName={walletStyles.selectTrigger}
        />
      </div>
      <Input label="Operadora" value={value.carrierName} onChange={(event) => set("carrierName", event.target.value)} error={errors.carrierName} maxLength={120} placeholder="Opcional" />
      <div className={styles.dateRow}>
        <Input label="Início da vigência" type="date" value={value.coverageStartDate} onChange={(event) => set("coverageStartDate", event.target.value)} error={errors.coverageStartDate} />
        <Input label="Renovação" type="date" value={value.renewalDate} onChange={(event) => set("renewalDate", event.target.value)} error={errors.renewalDate} />
      </div>
      <div className={walletStyles.field}>
        <span>Situação</span>
        <AppSelect
          aria-label={`Situação (${label})`}
          value={value.status}
          onValueChange={(next) => set("status", next)}
          options={PRIOR_CONTRACT_STATUSES.map((status) => ({ value: status, label: PRIOR_STATUS_LABELS[status] }))}
          triggerClassName={walletStyles.selectTrigger}
        />
      </div>
    </fieldset>
  );
}

/** Erros de um contrato a partir das chaves `contracts.<i>.<campo>` (ou `contract.<campo>`) devolvidas pelo servidor. */
export function contractErrors(fieldErrors: Record<string, string>, prefix: string) {
  const errors: Record<string, string> = {};
  for (const [key, message] of Object.entries(fieldErrors)) {
    if (key.startsWith(`${prefix}.`)) errors[key.slice(prefix.length + 1)] = message;
  }
  return errors;
}
