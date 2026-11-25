"use client";

/**
 * "Recebidos" de uma fonte de captura: as últimas 50 entregas do webhook, com a situação (Entrou, Não entrou,
 * Duplicado), o motivo em português e o link do lead. A consulta é no servidor, já limitada à empresa da sessão.
 *
 * Feedback (FEEDBACK.md, nível 0): abrir e filtrar só carregam. A falha mostra a causa, o que continua valendo e
 * "Tentar de novo".
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { LiteFilterChips } from "@/components/lite/controls";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import page from "@/components/lite/page/lite-page.module.css";
import styles from "@/components/lite/page/lite-sections.module.css";
import { WEBHOOK_DELIVERY_SITUATION_LABEL, type WebhookDeliverySituation } from "@/features/leads/webhooks/utils/webhook-delivery-view";

import { listIntegrationDeliveriesAction, type IntegrationDeliveriesState } from "../../integrations-actions";

type Delivery = Extract<IntegrationDeliveriesState, { success: true }>["deliveries"][number];

const SITUATION_TONE: Record<WebhookDeliverySituation, "success" | "danger" | undefined> = {
  entered: "success",
  not_entered: "danger",
  duplicate: undefined,
};

const PROBLEMS_CHIP = "problemas";

function formatWhen(value: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

const columns: LiteColumn<Delivery>[] = [
  { id: "when", label: "Quando", primary: true, nowrap: true, render: (row) => <span className={page.numeric}>{formatWhen(row.receivedAt)}</span> },
  { id: "situation", label: "Situação", nowrap: true, render: (row) => <span className={page.badge} data-tone={SITUATION_TONE[row.situation]}>{WEBHOOK_DELIVERY_SITUATION_LABEL[row.situation]}</span> },
  { id: "reason", label: "Motivo", render: (row) => row.reason ?? "" },
  { id: "lead", label: "Lead", nowrap: true, render: (row) => (row.leadId ? <Link href={`/leads/${row.leadId}`} className={styles.link}>Abrir lead</Link> : "") },
];

export function IntegrationDeliveriesLite({ credentialId }: { credentialId: string }) {
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [state, setState] = useState<{ status: "loading" } | { status: "ready"; deliveries: Delivery[] } | { status: "error"; message: string }>({ status: "loading" });

  const load = useCallback(async (problems: boolean) => {
    setState({ status: "loading" });
    const result = await listIntegrationDeliveriesAction({ id: credentialId, onlyProblems: problems }).catch(() => ({ success: false as const, error: "Sem conexão com o servidor." }));
    setState(result.success ? { status: "ready", deliveries: result.deliveries } : { status: "error", message: result.error });
  }, [credentialId]);

  useEffect(() => {
    void load(onlyProblems);
  }, [load, onlyProblems]);

  return (
    <div className={styles.formBody} style={{ padding: 0 }}>
      <LiteFilterChips
        label="Filtro dos recebidos"
        chips={[{ id: PROBLEMS_CHIP, label: "Só problemas" }]}
        active={onlyProblems ? [PROBLEMS_CHIP] : []}
        onToggle={() => setOnlyProblems((value) => !value)}
      />
      {state.status === "loading" ? <p className={styles.note} role="status">Carregando recebidos…</p> : null}
      {state.status === "error" ? (
        <div className={styles.notice} data-tone="danger" role="alert">
          <p className={styles.noticeTitle} data-tone="danger">{state.message}</p>
          <p className={styles.note}>A fonte continua recebendo leads normalmente.</p>
          <div>
            <button type="button" className={page.button} onClick={() => void load(onlyProblems)}>Tentar de novo</button>
          </div>
        </div>
      ) : null}
      {state.status === "ready" ? (
        <LiteResponsiveData
          caption="Últimos envios recebidos"
          columns={columns}
          rows={state.deliveries}
          rowKey={(row) => row.id}
          empty={<p className={page.emptyText}>{onlyProblems ? "Nenhum problema nos últimos envios." : "Esta fonte ainda não recebeu envios."}</p>}
        />
      ) : null}
    </div>
  );
}
