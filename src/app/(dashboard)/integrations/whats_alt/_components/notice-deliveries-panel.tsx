"use client";

/**
 * "Últimos envios" e "Enviar teste" de um aviso da equipe (DeskComm 7.1). Gaveta Lite com a tabela dos envios do
 * aviso (Quando, Para só com os 4 últimos dígitos, Situação com texto e Motivo em pt-BR) e o teste pelo canal
 * escolhido. Feedback (FEEDBACK.md, nível 1): o botão mostra o envio e só confirma depois do servidor; a falha
 * mostra a causa e "Tentar de novo".
 */
import { useCallback, useEffect, useState } from "react";

import { LiteActionButton } from "@/components/lite/controls";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import { formatLiteDate } from "@/components/lite/format/date";
import page from "@/components/lite/page/lite-page.module.css";
import { MAX_NOTICE_TESTS_PER_HOUR, NOTICE_DELIVERY_WINDOW_DAYS, SITUATION_LABEL, type NoticeDeliverySituation, type NoticeDeliveryView } from "@/features/team-notices/deliveries";

import { listTeamNoticeDeliveriesAction, sendTeamNoticeTestAction } from "../actions";
import styles from "../../whatsapp/whatsapp-lite.module.css";

export type NoticeDeliveriesTarget = {
  key: string;
  label: string;
  testable: boolean;
  enabled: boolean;
  /** Números próprios do aviso, já formatados; sem eles o teste vai para o celular de quem testa. */
  recipientPhones?: string[];
};

export type NoticeDeliveriesServices = {
  list: typeof listTeamNoticeDeliveriesAction;
  test: typeof sendTeamNoticeTestAction;
};

const defaultServices: NoticeDeliveriesServices = { list: listTeamNoticeDeliveriesAction, test: sendTeamNoticeTestAction };

const TONE: Record<NoticeDeliverySituation, "success" | "danger" | undefined> = { sent: "success", not_sent: "danger", queued: undefined };

function Situation({ value }: { value: NoticeDeliverySituation }) {
  return <span className={page.badge} data-tone={TONE[value]}>{SITUATION_LABEL[value]}</span>;
}

function when(value: string) {
  return formatLiteDate(value, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const columns: LiteColumn<NoticeDeliveryView>[] = [
  { id: "quando", label: "Quando", primary: true, nowrap: true, render: (row) => <span className={page.numeric}>{when(row.at)}{row.test ? " · teste" : ""}</span> },
  { id: "para", label: "Para", nowrap: true, render: (row) => <span className={page.numeric}>{row.to}</span> },
  { id: "situacao", label: "Situação", nowrap: true, render: (row) => <Situation value={row.situation} /> },
  { id: "motivo", label: "Motivo", secondary: true, render: (row) => row.reason },
];

type TestLine = { to: string; situation: NoticeDeliverySituation; reason: string };

export function NoticeDeliveriesPanel({ target, onClose, services = defaultServices }: { target: NoticeDeliveriesTarget | null; onClose: () => void; services?: NoticeDeliveriesServices }) {
  const [rows, setRows] = useState<NoticeDeliveryView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [testLines, setTestLines] = useState<TestLine[]>([]);
  const key = target?.key ?? null;

  const load = useCallback(async (noticeKey: string) => {
    setLoadError(null);
    const result = await services.list(noticeKey).catch(() => null);
    if (!result || !result.success) {
      setRows(null);
      setLoadError(result && !result.success ? result.error : "Não deu para carregar os envios agora.");
      return;
    }
    setRows(result.rows);
  }, [services]);

  useEffect(() => {
    setRows(null);
    setTestLines([]);
    if (key) void load(key);
  }, [key, load]);

  const test = async () => {
    if (!target) return;
    const result = await services.test(target.key);
    if (!result.success) throw new Error(result.error);
    setTestLines(result.results);
    void load(target.key);
    if (result.results.every((line) => line.situation === "not_sent")) throw new Error(result.results[0]?.reason ?? "O teste não saiu.");
  };

  const destination = target?.recipientPhones?.filter(Boolean).length
    ? `Vai para ${target.recipientPhones.filter(Boolean).join(", ")}.`
    : "Vai para o celular do seu cadastro.";

  return (
    <LiteSidePanel
      open={Boolean(target)}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={target ? `Envios · ${target.label}` : "Envios"}
      description={`Os últimos envios dos últimos ${NOTICE_DELIVERY_WINDOW_DAYS} dias. Só da sua empresa.`}
    >
      {target ? (
        <div className={styles.drawerBody}>
          {target.testable ? (
            <div className={styles.drawerBlock}>
              <h3 className={styles.drawerTitle}>Enviar teste</h3>
              <p className={styles.drawerText}>
                {target.enabled
                  ? `Sai pelo canal escolhido, com valores de exemplo. ${destination} Até ${MAX_NOTICE_TESTS_PER_HOUR} testes por hora.`
                  : "O aviso está desligado. Ligue e salve para testar."}
              </p>
              <div className={styles.drawerActions}>
                <LiteActionButton key={target.key} tone="secondary" busyLabel="Enviando…" doneLabel="Teste enviado" errorFallback="Não deu para enviar o teste agora." disabled={!target.enabled} onAction={test}>
                  Enviar teste
                </LiteActionButton>
              </div>
              {testLines.length ? (
                <ul className={styles.drawerList}>
                  {testLines.map((line, index) => (
                    <li key={`${line.to}-${index}`}>
                      <span className={page.numeric}>{line.to}</span>
                      <span>{SITUATION_LABEL[line.situation]}. {line.reason}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          <div className={styles.drawerBlock}>
            <h3 className={styles.drawerTitle}>Últimos envios</h3>
            {loadError ? (
              <div className={styles.drawerActions}>
                <p role="alert" className={styles.drawerText}>{loadError}</p>
                <button type="button" className={page.button} onClick={() => void load(target.key)}>Tentar de novo</button>
              </div>
            ) : rows === null ? (
              <p className={styles.drawerText}>Carregando os envios…</p>
            ) : (
              <LiteResponsiveData
                caption={`Últimos envios de ${target.label}`}
                columns={columns}
                rows={rows}
                rowKey={(row) => row.id}
                empty={<p className={page.emptyText}>Nenhum envio deste aviso nos últimos {NOTICE_DELIVERY_WINDOW_DAYS} dias. Quando ele sair, aparece aqui com a situação e o motivo.</p>}
              />
            )}
          </div>
        </div>
      ) : null}
    </LiteSidePanel>
  );
}
