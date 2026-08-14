"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lightning, ArrowsDownUp, Eye } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  forceCompleteQualificationAction,
  updateLeadTargetQueueAction,
} from "@/features/leads/qualification-tab-actions";

type LeadQueue = { id: string; name: string; branchId: string };

type QualifyingLeadActionsProps = {
  leadId: string;
  leadName: string;
  currentQueueId: string | null;
  currentQueueName: string | null;
  queues: LeadQueue[];
  onOpenDetails: () => void;
};

export function QualifyingLeadActions({
  leadId,
  leadName,
  currentQueueId,
  currentQueueName,
  queues,
  onOpenDetails,
}: QualifyingLeadActionsProps) {
  const router = useRouter();
  const [busyForce, setBusyForce] = useState(false);
  const [openQueueDialog, setOpenQueueDialog] = useState(false);
  const [selectedQueueId, setSelectedQueueId] = useState<string>(currentQueueId ?? "");
  const [busyQueue, setBusyQueue] = useState(false);

  async function handleForceComplete() {
    if (!confirm(`Deseja aprovar e enviar "${leadName}" imediatamente para a fila de distribuição?`)) {
      return;
    }

    setBusyForce(true);
    const res = await forceCompleteQualificationAction({ leadId });
    setBusyForce(false);

    if (res.success) {
      toast.success(`Qualificação de "${leadName}" concluída e enviada para a fila!`);
      router.refresh();
    } else {
      toast.error(res.error ?? "Não foi possível concluir a qualificação.");
    }
  }

  async function handleUpdateQueue(e: React.FormEvent) {
    e.preventDefault();
    setBusyQueue(true);
    const res = await updateLeadTargetQueueAction({
      leadId,
      queueId: selectedQueueId || null,
    });
    setBusyQueue(false);

    if (res.success) {
      toast.success("Fila de destino atualizada com sucesso!");
      setOpenQueueDialog(false);
      router.refresh();
    } else {
      toast.error(res.error ?? "Erro ao alterar a fila de destino.");
    }
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button
        type="button"
        size="xs"
        variant="ghost"
        onClick={onOpenDetails}
        title="Ver detalhes do lead"
        className="gap-1 text-xs"
      >
        <Eye className="size-3.5" />
        <span className="hidden sm:inline">Detalhes</span>
      </Button>

      <Button
        type="button"
        size="xs"
        variant="outline"
        onClick={() => setOpenQueueDialog(true)}
        title="Alterar fila de destino"
        className="gap-1 text-xs"
      >
        <ArrowsDownUp className="size-3.5" />
        <span className="hidden sm:inline">Fila</span>
      </Button>

      <Button
        type="button"
        size="xs"
        variant="default"
        onClick={handleForceComplete}
        disabled={busyForce}
        title="Aprovar e distribuir agora"
        className="gap-1 text-xs font-medium"
      >
        <Lightning className="size-3.5" />
        {busyForce ? "Aprovando…" : "Aprovar & Distribuir"}
      </Button>

      <Dialog open={openQueueDialog} onOpenChange={setOpenQueueDialog}>
        <DialogPopup className="sm:max-w-md">
          <DialogTitle>Alterar Fila de Destino</DialogTitle>
          <DialogDescription>
            Escolha a fila para onde o lead <strong>{leadName}</strong> será encaminhado assim que a qualificação for concluída.
          </DialogDescription>

          <form onSubmit={handleUpdateQueue} className="grid gap-4 mt-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Fila de Distribuição</label>
              <Select value={selectedQueueId} onValueChange={(val) => setSelectedQueueId(val ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Geral da unidade (Padrão)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Geral da unidade (Padrão)</SelectItem>
                  {queues.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      Fila: {q.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <DialogClose render={<Button type="button" variant="ghost">Cancelar</Button>} />
              <Button type="submit" disabled={busyQueue}>
                {busyQueue ? "Salvando…" : "Salvar Fila"}
              </Button>
            </div>
          </form>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
