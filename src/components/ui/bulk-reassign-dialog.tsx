"use client";

import { useActionState, useCallback, useState } from "react";
import { toast } from "@/components/ui/sonner";
import { UserSwitch, Buildings, RotateCcw } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogPopup,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AppSelect } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  bulkReassignLeadsAction,
  bulkReassignBranchAction,
  bulkRevertToQualificationAction,
} from "@/app/(dashboard)/leads/status-actions";
import { useActionDialogLifecycle } from "@/hooks/use-action-dialog-lifecycle";

type BulkMode = "broker" | "branch" | "revert";

export function BulkReassignDialog({
  leadIds,
  brokers = [],
  branches = [],
  role = "manager",
  onCommitted,
  onBranchCommitted,
  onRevertCommitted,
}: {
  leadIds: string[];
  brokers: Array<{ id: string; name: string; branchId: string | null }>;
  branches?: Array<{ id: string; name: string }>;
  role?: string;
  onCommitted?: (input: { leadIds: string[]; brokerId: string }) => void;
  onBranchCommitted?: (input: { leadIds: string[]; branchId: string }) => void;
  onRevertCommitted?: (input: { leadIds: string[] }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<BulkMode>("broker");
  const [selectedBrokerId, setSelectedBrokerId] = useState("");
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [visibleError, setVisibleError] = useState<string | null>(null);

  // Mode 1: Reassign Broker
  const [brokerState, brokerFormAction, brokerPending] = useActionState(
    bulkReassignLeadsAction,
    {},
  );

  // Mode 2: Reassign Branch
  const [branchState, branchFormAction, branchPending] = useActionState(
    bulkReassignBranchAction,
    {},
  );

  // Mode 3: Revert to Qualification
  const [revertState, revertFormAction, revertPending] = useActionState(
    bulkRevertToQualificationAction,
    {},
  );

  const isPending = brokerPending || branchPending || revertPending;

  // Lifecycle for Mode 1
  const handleBrokerSuccess = useCallback(
    (result: typeof brokerState) => {
      toast.success(result.message ?? `Reatribuição concluída para ${leadIds.length} lead(s).`);
      setOpen(false);
      setSelectedBrokerId("");
      if (result.changedLeadIds?.length && result.brokerId) {
        onCommitted?.({ leadIds: result.changedLeadIds, brokerId: result.brokerId });
      }
    },
    [leadIds.length, onCommitted],
  );

  useActionDialogLifecycle({
    state: brokerState,
    pending: brokerPending,
    onSuccess: handleBrokerSuccess,
    onError: (res) => {
      if (res.error) {
        setVisibleError(res.error);
        toast.error(res.error);
      }
    },
  });

  // Lifecycle for Mode 2
  const handleBranchSuccess = useCallback(
    (result: typeof branchState) => {
      toast.success(result.message ?? `Transferência para a unidade concluída.`);
      setOpen(false);
      setSelectedBranchIds([]);
      if (result.changedLeadIds?.length && result.branchId) {
        onBranchCommitted?.({ leadIds: result.changedLeadIds, branchId: result.branchId });
      }
    },
    [onBranchCommitted],
  );

  useActionDialogLifecycle({
    state: branchState,
    pending: branchPending,
    onSuccess: handleBranchSuccess,
    onError: (res) => {
      if (res.error) {
        setVisibleError(res.error);
        toast.error(res.error);
      }
    },
  });

  // Lifecycle for Mode 3
  const handleRevertSuccess = useCallback(
    (result: typeof revertState) => {
      toast.success(result.message ?? `Leads devolvidos à fila de qualificação.`);
      setOpen(false);
      if (result.changedLeadIds?.length) {
        onRevertCommitted?.({ leadIds: result.changedLeadIds });
      }
    },
    [onRevertCommitted],
  );

  useActionDialogLifecycle({
    state: revertState,
    pending: revertPending,
    onSuccess: handleRevertSuccess,
    onError: (res) => {
      if (res.error) {
        setVisibleError(res.error);
        toast.error(res.error);
      }
    },
  });

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen && !isPending) {
        setSelectedBrokerId("");
        setSelectedBranchIds([]);
        setVisibleError(null);
      }
    },
    [isPending],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" variant="outline"><UserSwitch className="size-4" /> Gestão em lote</Button>} />
      <DialogPopup key={open ? "open" : "closed"} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gestão de leads em lote</DialogTitle>
          <DialogDescription>
            {leadIds.length} lead{leadIds.length === 1 ? "" : "s"} selecionado
            {leadIds.length === 1 ? "" : "s"}. Escolha a ação desejada.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Selector */}
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted/50 p-1">
          <Button
            size="sm"
            type="button"
            variant={mode === "broker" ? "secondary" : "ghost"}
            className="h-8 text-xs font-medium gap-1"
            onClick={() => {
              setMode("broker");
              setVisibleError(null);
            }}
          >
            <UserSwitch className="size-3.5" />
            Corretor
          </Button>
          {branches.length > 0 && (
            <Button
              size="sm"
              type="button"
              variant={mode === "branch" ? "secondary" : "ghost"}
              className="h-8 text-xs font-medium gap-1"
              onClick={() => {
                setMode("branch");
                setVisibleError(null);
              }}
            >
              <Buildings className="size-3.5" />
              Unidade
            </Button>
          )}
          <Button
            size="sm"
            type="button"
            variant={mode === "revert" ? "secondary" : "ghost"}
            className="h-8 text-xs font-medium gap-1"
            onClick={() => {
              setMode("revert");
              setVisibleError(null);
            }}
          >
            <RotateCcw className="size-3.5 text-amber-500" />
            Qualificação
          </Button>
        </div>

        {/* Form 1: Reassign Broker */}
        {mode === "broker" && (
          <form action={brokerFormAction} className="space-y-4 pt-2" onSubmit={() => setVisibleError(null)}>
            {leadIds.map((id) => (
              <input key={id} name="leadIds" type="hidden" value={id} />
            ))}
            <input name="brokerId" type="hidden" value={selectedBrokerId} />

            <div className="space-y-2">
              <Label htmlFor="broker-select" className="text-xs">Selecione o novo corretor responsável</Label>
              <AppSelect
                id="broker-select"
                value={selectedBrokerId}
                onValueChange={setSelectedBrokerId}
                placeholder="Selecione um corretor..."
                required
                options={brokers.map((broker) => ({
                  value: broker.id,
                  label: broker.name,
                }))}
              />
            </div>

            {visibleError && (
              <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {visibleError}
              </p>
            )}

            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" disabled={isPending}>Cancelar</Button>} />
              <Button type="submit" disabled={isPending || !selectedBrokerId}>
                {brokerPending ? "Reatribuindo..." : "Confirmar reatribuição"}
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* Form 2: Reassign Branch */}
        {mode === "branch" && (
          <form action={branchFormAction} className="space-y-4 pt-2" onSubmit={() => setVisibleError(null)}>
            {leadIds.map((id) => (
              <input key={id} name="leadIds" type="hidden" value={id} />
            ))}
            <div className="space-y-2">
              <Label className="text-xs">Selecione uma ou mais unidades / filiais</Label>
              <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {branches.map((branch) => {
                  const checked = selectedBranchIds.includes(branch.id);
                  return (
                    <label key={branch.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/60">
                      <input
                        type="checkbox"
                        name="branchIds"
                        value={branch.id}
                        checked={checked}
                        onChange={(event) => setSelectedBranchIds((current) => event.target.checked ? [...current, branch.id] : current.filter((id) => id !== branch.id))}
                        className="size-3.5 accent-primary"
                      />
                      <span>{branch.name}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Os leads serão distribuídos em rodízio entre as unidades selecionadas e enviados aos corretores elegíveis.
              </p>
            </div>

            {visibleError && (
              <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {visibleError}
              </p>
            )}

            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" disabled={isPending}>Cancelar</Button>} />
              <Button type="submit" disabled={isPending || selectedBranchIds.length === 0}>
                {branchPending ? "Transferindo..." : "Transferir unidade"}
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* Form 3: Revert to Qualification */}
        {mode === "revert" && (
          <form action={revertFormAction} className="space-y-4 pt-2" onSubmit={() => setVisibleError(null)}>
            {leadIds.map((id) => (
              <input key={id} name="leadIds" type="hidden" value={id} />
            ))}

            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-1">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Devolução para Qualificação</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Os {leadIds.length} leads selecionados retornarão para o status inicial de qualificação, removendo o corretor atual e permitindo novo atendimento por IA ou redistribuição.
              </p>
            </div>

            {visibleError && (
              <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {visibleError}
              </p>
            )}

            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" disabled={isPending}>Cancelar</Button>} />
              <Button type="submit" variant="default" className="bg-amber-600 hover:bg-amber-700 text-white" disabled={isPending}>
                {revertPending ? "Devolvendo..." : "Devolver p/ Qualificação"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogPopup>
    </Dialog>
  );
}
