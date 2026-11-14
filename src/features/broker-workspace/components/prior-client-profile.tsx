"use client";

import { useState, useTransition, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/arc/badge/badge";
import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { LiteSuccess } from "@/components/lite/motion";
import { Textarea } from "@/components/arc/textarea/textarea";
import { PeopleEmpty, PeoplePage, PeopleSection, peopleHue, peopleInitials } from "@/components/light/people-list/people-list";
import {
  isPriorContractRenewalAttention,
  priorContractPending,
  PRIOR_PRODUCT_LABELS,
  PRIOR_STATUS_LABELS,
  type PriorContractActionResult,
} from "@/features/customers/prior-portfolio-input";
import { buildWhatsAppUrl } from "@/lib/whatsapp-url";

import walletStyles from "./broker-client-wallet.module.css";
import styles from "./broker-my-wallet.module.css";
import { contractErrors, EMPTY_PRIOR_CONTRACT, PriorContractFields, type PriorContractDraft } from "./prior-contract-fields";

export type PriorClientProfileContract = {
  id: string;
  productType: string;
  carrierName: string | null;
  coverageStartDate: string | null;
  renewalDate: string | null;
  status: string;
};

export type PriorClientProfileActions = {
  update: (input: { clientId: string; nome: string; email: string; observacao: string }) => Promise<PriorContractActionResult>;
  saveContract: (input: { clientId: string; contractId?: string; contract: PriorContractDraft }) => Promise<PriorContractActionResult>;
  removeContract: (input: { clientId: string; contractId: string }) => Promise<PriorContractActionResult>;
};

const dateLabel = (value: string | null) => (value ? value.split("-").reverse().join("/") : null);

function toDraft(contract: PriorClientProfileContract): PriorContractDraft {
  return {
    productType: contract.productType,
    carrierName: contract.carrierName ?? "",
    coverageStartDate: contract.coverageStartDate ?? "",
    renewalDate: contract.renewalDate ?? "",
    status: contract.status,
  };
}

/**
 * Perfil de cliente de carteira anterior (DEC-187): dados, selo "Carteira anterior" e contratos anteriores com
 * pendências. Sem lead não há conversa, retorno nem histórico ainda (agenda na etapa 6).
 */
export function PriorClientProfile({
  client,
  contracts,
  todayKey,
  actions,
}: {
  client: { id: string; name: string; phone: string; email: string | null; originNote: string | null };
  contracts: PriorClientProfileContract[];
  todayKey: string;
  actions: PriorClientProfileActions;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sheet, setSheet] = useState<null | { kind: "client" } | { kind: "contract"; contractId?: string }>(null);
  const [clientDraft, setClientDraft] = useState({ nome: client.name, email: client.email ?? "", observacao: client.originNote ?? "" });
  const [contractDraft, setContractDraft] = useState<PriorContractDraft>(EMPTY_PRIOR_CONTRACT);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  // Confirmação no próprio lugar: dados do cliente no cartão de dados, contratos junto de "Adicionar contrato".
  const [feedback, setFeedback] = useState<{ where: "client" | "contracts"; label: string } | null>(null);
  const whatsappUrl = buildWhatsAppUrl(client.phone);

  function open(next: NonNullable<typeof sheet>) {
    setError(null);
    setFieldErrors({});
    setFeedback(null);
    if (next.kind === "client") setClientDraft({ nome: client.name, email: client.email ?? "", observacao: client.originNote ?? "" });
    if (next.kind === "contract") {
      const current = contracts.find((contract) => contract.id === next.contractId);
      setContractDraft(current ? toDraft(current) : EMPTY_PRIOR_CONTRACT);
    }
    setSheet(next);
  }

  function run(task: () => Promise<PriorContractActionResult>, success: NonNullable<typeof feedback>, onDone?: () => void) {
    setError(null);
    setFeedback(null);
    startTransition(async () => {
      let result: PriorContractActionResult;
      try {
        result = await task();
      } catch {
        setError("Sem conexão com o servidor. Confira a internet e tente de novo.");
        return;
      }
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setError(result.error);
        return;
      }
      setFeedback(success);
      onDone?.();
      router.refresh();
    });
  }

  function submitClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(() => actions.update({ clientId: client.id, ...clientDraft }), { where: "client", label: "Dados salvos" }, () => setSheet(null));
  }

  function submitContract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const contractId = sheet?.kind === "contract" ? sheet.contractId : undefined;
    run(() => actions.saveContract({ clientId: client.id, ...(contractId ? { contractId } : {}), contract: contractDraft }), { where: "contracts", label: contractId ? "Contrato atualizado" : "Contrato adicionado" }, () => setSheet(null));
  }

  return (
    <PeoplePage title={client.name} hideTitle className={`${walletStyles.page} ${styles.page}`}>
      <div className={styles.profileHeader}>
        <span className={styles.profileAvatar} style={{ "--hue": peopleHue(client.name) } as CSSProperties} aria-hidden="true">{peopleInitials(client.name)}</span>
        <div className={styles.profileMain}>
          <p className={styles.profileName}>{client.name}</p>
          <Badge tone="info" size="sm">Carteira anterior</Badge>
        </div>
      </div>

      <section className={styles.profileCard} aria-label="Dados do cliente">
        <dl className={styles.profileData}>
          <div><dt>Telefone</dt><dd>{client.phone}</dd></div>
          <div><dt>E-mail</dt><dd>{client.email ?? <span className={styles.pending}>Pendente</span>}</dd></div>
          <div><dt>Observação</dt><dd>{client.originNote ?? <span className={styles.pending}>Sem observação</span>}</dd></div>
        </dl>
        <div className={styles.sheetButtons}>
          {whatsappUrl ? <a className={walletStyles.whatsapp} href={whatsappUrl} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp de ${client.name}`}>WhatsApp</a> : null}
          <Button variant="secondary" onClick={() => open({ kind: "client" })}>Editar dados</Button>
        </div>
        {feedback?.where === "client" ? <LiteSuccess label={feedback.label} className={styles.sheetText} /> : null}
        <p className={styles.sheetText}>Cliente que você já tinha antes do CRM: não gera venda, comissão nem pontos. Retornos para este cliente chegam com a Agenda.</p>
      </section>

      <div className={styles.profileSectionHeader}>
        <Button variant="primary" onClick={() => open({ kind: "contract" })}>Adicionar contrato</Button>
        {feedback?.where === "contracts" ? <LiteSuccess label={feedback.label} className={styles.sheetText} /> : null}
      </div>
      {contracts.length ? (
        <PeopleSection title="Contratos anteriores" id="prior-contracts" count={contracts.length}>
          {contracts.map((contract) => {
            const missing = priorContractPending(contract);
            const renewal = isPriorContractRenewalAttention(contract, todayKey);
            return (
              <li key={contract.id} className={styles.contractItem}>
                <div className={styles.contractTop}>
                  <strong>{PRIOR_PRODUCT_LABELS[contract.productType as keyof typeof PRIOR_PRODUCT_LABELS] ?? contract.productType}{contract.carrierName ? ` · ${contract.carrierName}` : ""}</strong>
                  <Badge tone={contract.status === "active" ? "success" : "neutral"} size="sm">{PRIOR_STATUS_LABELS[contract.status as keyof typeof PRIOR_STATUS_LABELS] ?? contract.status}</Badge>
                  {renewal ? <Badge tone="info" size="sm">Renovação próxima</Badge> : null}
                </div>
                <p className={styles.sheetText}>
                  Vigência: {dateLabel(contract.coverageStartDate) ?? "pendente"} · Renovação: {dateLabel(contract.renewalDate) ?? "pendente"}
                </p>
                {missing.length ? <p className={styles.pending}>Pendente: {missing.join(", ")}</p> : null}
                <div className={styles.sheetButtons}>
                  <Button variant="secondary" onClick={() => open({ kind: "contract", contractId: contract.id })}>Editar</Button>
                  {confirmRemove === contract.id ? (
                    <>
                      <Button variant="secondary" loading={pending} disabled={pending} onClick={() => run(() => actions.removeContract({ clientId: client.id, contractId: contract.id }), { where: "contracts", label: "Contrato removido" }, () => setConfirmRemove(null))}>Confirmar remoção</Button>
                      <Button variant="secondary" onClick={() => setConfirmRemove(null)}>Manter</Button>
                    </>
                  ) : (
                    <Button variant="secondary" onClick={() => setConfirmRemove(contract.id)}>Remover</Button>
                  )}
                </div>
              </li>
            );
          })}
        </PeopleSection>
      ) : (
        <PeopleEmpty title="Nenhum contrato anterior" description="Cadastre o plano que o cliente já tem para acompanhar a renovação em Precisa de atenção." />
      )}
      {error && sheet === null ? <p role="alert" className={styles.fieldError}>{error}</p> : null}

      <BottomSheet
        className="arc-venancor"
        open={sheet !== null}
        onOpenChange={(next) => { if (!next) setSheet(null); }}
        title={sheet?.kind === "client" ? "Editar dados" : sheet?.kind === "contract" && sheet.contractId ? "Editar contrato" : "Adicionar contrato"}
        description={sheet?.kind === "contract" ? "O que você não souber fica como pendente." : undefined}
        closeLabel="Fechar"
        detents={[0.9]}
      >
        {sheet?.kind === "client" ? (
          <form className={styles.sheetBody} onSubmit={submitClient} noValidate>
            <Input label="Nome" value={clientDraft.nome} onChange={(event) => setClientDraft({ ...clientDraft, nome: event.target.value })} error={fieldErrors.nome} maxLength={120} required />
            <Input label="E-mail (opcional)" type="email" value={clientDraft.email} onChange={(event) => setClientDraft({ ...clientDraft, email: event.target.value })} error={fieldErrors.email} maxLength={254} />
            <Textarea label="Observação (opcional)" value={clientDraft.observacao} onChange={(event) => setClientDraft({ ...clientDraft, observacao: event.target.value })} error={fieldErrors.observacao} maxLength={2000} rows={3} />
            {error ? <p className={styles.fieldError} role="alert">{error}</p> : null}
            <Button type="submit" size="lg" loading={pending} disabled={pending}>Salvar</Button>
          </form>
        ) : sheet?.kind === "contract" ? (
          <form className={styles.sheetBody} onSubmit={submitContract} noValidate>
            <PriorContractFields label="Contrato" value={contractDraft} onChange={setContractDraft} errors={contractErrors(fieldErrors, "contract")} />
            {error ? <p className={styles.fieldError} role="alert">{error}</p> : null}
            <Button type="submit" size="lg" loading={pending} disabled={pending}>Salvar contrato</Button>
          </form>
        ) : null}
      </BottomSheet>
    </PeoplePage>
  );
}
