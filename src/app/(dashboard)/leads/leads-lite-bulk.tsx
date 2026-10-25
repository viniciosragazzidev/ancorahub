"use client";

/**
 * Ações em lote da lista Lite de /leads (chave do diretor). As mesmas ações da tela atual, com os mesmos diálogos e as
 * mesmas Server Actions: alterar status e gestão em lote (corretor, unidade e devolução para a qualificação) para
 * diretor e gestor, e o "Exportar CSV" da tabela atual para todos. A devolução, que tira o corretor dos leads, pede
 * confirmação no LiteConfirmDialog; as demais seguem nos diálogos de hoje, que já são o passo de confirmação.
 */
import { useCallback, useState, useTransition } from "react";

import { LiteBulkBar, LiteConfirmDialog, type BulkAction } from "@/components/lite/controls";
import { BulkStatusDialog } from "@/components/ui/bulk-status-dialog";
import { BulkReassignDialog, type BulkMode } from "@/components/ui/bulk-reassign-dialog";
import { toast } from "@/components/ui/sonner";

import { bulkChangeLeadStatusAction, bulkRevertToQualificationAction } from "./status-actions";

export type LeadsLiteBulkConfig = {
  role?: string;
  brokers: Array<{ id: string; name: string; branchId: string | null }>;
  branches: Array<{ id: string; name: string }>;
  onStatusCommitted?: (input: { leadIds: string[]; newStatus: string }) => void;
  onReassignCommitted?: (input: { leadIds: string[]; brokerId: string }) => void;
  onBranchCommitted?: (input: { leadIds: string[]; branchId: string }) => void;
  onRevertCommitted?: (input: { leadIds: string[] }) => void;
};

type OpenDialog = null | "status" | BulkMode;

export function LeadsLiteBulk({ selectedIds, onClear, config }: { selectedIds: string[]; onClear: () => void; config: LeadsLiteBulkConfig }) {
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [confirmRevert, setConfirmRevert] = useState(false);
  const [reverting, startRevert] = useTransition();
  const { role, brokers, branches } = config;
  const canManage = role === "director" || role === "manager";
  const count = selectedIds.length;

  const actions: BulkAction[] = [];
  if (canManage) {
    actions.push({ id: "status", label: "Alterar status", shortLabel: "Status", onRun: () => setDialog("status") });
    actions.push({ id: "broker", label: "Trocar corretor", shortLabel: "Corretor", onRun: () => setDialog("broker") });
    if (branches.length > 0) actions.push({ id: "branch", label: "Transferir unidade", shortLabel: "Unidade", onRun: () => setDialog("branch") });
    actions.push({ id: "revert", label: "Devolver para qualificação", shortLabel: "Devolver", tone: "danger", onRun: () => { if (!reverting) setConfirmRevert(true); } });
  }
  // A tabela atual oferece "Exportar CSV" na seleção; a Lite mantém o mesmo comportamento.
  actions.push({ id: "export", label: "Exportar CSV", shortLabel: "Exportar", onRun: () => alert(`Exportando ${count} lead(s)...`) });

  const cancelRevert = useCallback(() => setConfirmRevert(false), []);
  const runRevert = () => {
    setConfirmRevert(false);
    const ids = [...selectedIds];
    startRevert(async () => {
      const formData = new FormData();
      for (const id of ids) formData.append("leadIds", id);
      try {
        const result = await bulkRevertToQualificationAction({}, formData);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success(result.message ?? "Leads devolvidos à fila de qualificação.");
        if (result.changedLeadIds?.length) config.onRevertCommitted?.({ leadIds: result.changedLeadIds });
      } catch {
        // Falha de rede ou do servidor: o mesmo aviso de erro, sem deixar a promessa solta.
        toast.error("Não foi possível devolver os leads para a qualificação. Tente de novo.");
      }
    });
  };

  return (
    <>
      <LiteBulkBar count={count} actions={actions} onClear={onClear} />
      {canManage ? (
        <>
          <BulkStatusDialog
            leadIds={selectedIds}
            role={role ?? ""}
            bulkStatusAction={bulkChangeLeadStatusAction}
            onCommitted={config.onStatusCommitted}
            hideTrigger
            open={dialog === "status"}
            onOpenChange={(open) => setDialog(open ? "status" : null)}
          />
          <BulkReassignDialog
            leadIds={selectedIds}
            brokers={brokers}
            branches={branches}
            role={role}
            onCommitted={config.onReassignCommitted}
            onBranchCommitted={config.onBranchCommitted}
            onRevertCommitted={config.onRevertCommitted}
            hideTrigger
            open={dialog === "broker" || dialog === "branch"}
            initialMode={dialog === "branch" ? "branch" : "broker"}
            onOpenChange={(open) => { if (!open) setDialog(null); }}
          />
          <LiteConfirmDialog
            open={confirmRevert}
            title="Devolver para qualificação?"
            description={`${count === 1 ? "O lead selecionado volta" : `Os ${count} leads selecionados voltam`} para a qualificação: o corretor atual sai e o lead fica livre para novo atendimento por IA ou redistribuição.`}
            confirmLabel="Devolver"
            tone="danger"
            onConfirm={runRevert}
            onCancel={cancelRevert}
          />
        </>
      ) : null}
    </>
  );
}
