"use client";

/**
 * Etapas que a Meta recusou, na gaveta Lite aberta pelo contador "Recusados" (DeskComm: conversões que não foram
 * reportadas). Lead, etapa, motivo em pt-BR e quando; no ⋯, abrir o lead ou tentar de novo. "Tentar de novo" só devolve
 * a etapa para a fila do job (nunca chama a Meta daqui) e confirma depois do servidor, no nível 1 (FEEDBACK.md).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { LiteConfirmDialog, LiteMenu } from "@/components/lite/controls";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import { ActionNoticeLine, useActionNotice } from "@/components/lite/feedback/action-notice";
import { formatLiteDate } from "@/components/lite/format/date";
import page from "@/components/lite/page/lite-page.module.css";
import { listMetaConversionRefusalsAction, retryMetaConversionRefusalsAction } from "../../meta-conversion-actions";
import type { MetaConversionRefusal } from "../../meta-conversion-service";
import styles from "./meta-lite.module.css";

const count = new Intl.NumberFormat("pt-BR");
const dateTime: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" };
const KEEPS = "A etapa continua na lista de recusadas.";

function stepsLabel(total: number) {
  return `${count.format(total)} ${total === 1 ? "etapa" : "etapas"}`;
}

export function MetaConversionRefusalsLite({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const notice = useActionNotice();
  const [refusals, setRefusals] = useState<MetaConversionRefusal[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [retryingAll, setRetryingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await listMetaConversionRefusalsAction();
      if (result.success) setRefusals(result.refusals);
      else setLoadError(result.error);
    } catch {
      setLoadError("Não foi possível carregar as recusas agora.");
    } finally {
      setLoading(false);
    }
  }, []);

  const clearNotice = notice.clear;
  useEffect(() => {
    if (!open) return;
    clearNotice();
    void load();
  }, [open, load, clearNotice]);

  const retryOne = useCallback(async (row: MetaConversionRefusal) => {
    notice.tap();
    setBusyId(row.id);
    try {
      const result = await retryMetaConversionRefusalsAction({ id: row.id });
      if (!result.success) {
        notice.fail(result.error, { keeps: KEEPS, retry: () => void retryOne(row) });
        return;
      }
      notice.succeed(`${row.stageLabel} de ${row.leadName} voltou para a fila de envio.`);
      setRefusals((current) => current?.filter((item) => item.id !== row.id) ?? current);
      router.refresh();
    } catch (error) {
      notice.fail(error, { keeps: KEEPS, fallback: "Não foi possível devolver para a fila agora.", retry: () => void retryOne(row) });
    } finally {
      setBusyId(null);
    }
  }, [notice, router]);

  const rows = refusals ?? [];
  const eligible = rows.filter((row) => row.retry.retryable);

  const retryAll = useCallback(async () => {
    setConfirmAll(false);
    notice.tap();
    setRetryingAll(true);
    try {
      const result = await retryMetaConversionRefusalsAction({ all: true });
      if (!result.success) {
        notice.fail(result.error, { keeps: "As recusas continuam na lista.", retry: () => void retryAll() });
        return;
      }
      const left = result.refused.length;
      notice.succeed(`${stepsLabel(result.requeued)} ${result.requeued === 1 ? "voltou" : "voltaram"} para a fila de envio.${left ? ` ${count.format(left)} ${left === 1 ? "não pode" : "não podem"} voltar.` : ""}`);
      await load();
      router.refresh();
    } catch (error) {
      notice.fail(error, { keeps: "As recusas continuam na lista.", fallback: "Não foi possível devolver para a fila agora.", retry: () => void retryAll() });
    } finally {
      setRetryingAll(false);
    }
  }, [load, notice, router]);

  const columns: LiteColumn<MetaConversionRefusal>[] = [
    {
      id: "lead",
      label: "Lead",
      primary: true,
      render: (row) => <Link href={`/leads/${encodeURIComponent(row.leadId)}`} className={page.cellLink}>{row.leadName}</Link>,
    },
    { id: "stage", label: "Etapa enviada", secondary: true, render: (row) => row.stageLabel },
    {
      id: "reason",
      label: "Motivo",
      render: (row) => (
        <>
          <span className={page.cellTitle}>{row.reason.label}</span>
          <span className={page.cellSub}>{row.reason.hint}</span>
        </>
      ),
    },
    { id: "at", label: "Quando", nowrap: true, render: (row) => <span className={page.numeric}>{formatLiteDate(row.at, dateTime)}</span> },
    {
      id: "actions",
      label: "Ações",
      render: (row) => (
        <LiteMenu
          label={`Ações da etapa ${row.stageLabel} de ${row.leadName}`}
          items={[
            { id: "open", label: "Abrir lead", href: `/leads/${encodeURIComponent(row.leadId)}` },
            { id: "retry", label: busyId === row.id ? "Devolvendo…" : "Tentar de novo", disabled: busyId !== null || retryingAll, onSelect: () => void retryOne(row) },
          ]}
        />
      ),
    },
  ];

  const description = refusals
    ? rows.length
      ? `${stepsLabel(rows.length)} recusadas · ${count.format(eligible.length)} podem voltar para a fila`
      : "Nenhuma etapa recusada"
    : "Etapas que a Meta não aceitou";

  return (
    <LiteSidePanel open={open} onOpenChange={onOpenChange} title="Etapas recusadas pela Meta" description={description}>
      <div className={styles.refusalsPanel}>
        {loading && !refusals ? <p className={page.cellSub} role="status">Carregando as recusas…</p> : null}

        {loadError ? (
          <div role="alert" className={page.cardHead}>
            <p className={page.cardDescription}>{loadError} O envio das outras etapas continua normal.</p>
            <button type="button" className={page.button} onClick={() => void load()} disabled={loading}>Tentar de novo</button>
          </div>
        ) : null}

        {refusals ? (
          <>
            {eligible.length ? (
              <div className={styles.refusalsToolbar}>
                <button type="button" className={page.primaryButton} disabled={retryingAll || busyId !== null} onClick={() => setConfirmAll(true)}>
                  {retryingAll ? "Devolvendo…" : "Tentar todos de novo"}
                </button>
              </div>
            ) : null}
            <ActionNoticeLine notice={notice.notice} />
            <LiteResponsiveData
              caption="Etapas recusadas pela Meta"
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              empty={<p className={page.emptyText}>Nenhuma etapa recusada. Tudo o que saiu foi aceito pela Meta.</p>}
            />
          </>
        ) : null}
      </div>

      <LiteConfirmDialog
        open={confirmAll}
        title={`Tentar de novo ${stepsLabel(eligible.length)}?`}
        description={`${stepsLabel(eligible.length)} voltam para a fila e saem no próximo envio.${rows.length > eligible.length ? ` ${count.format(rows.length - eligible.length)} ficam de fora: passaram dos 7 dias ou não podem voltar.` : ""}`}
        confirmLabel="Tentar de novo"
        onConfirm={() => void retryAll()}
        onCancel={() => setConfirmAll(false)}
      />
    </LiteSidePanel>
  );
}
