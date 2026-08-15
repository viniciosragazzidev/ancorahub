"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lightning, ArrowsDownUp, Eye, Sparkle } from "@/components/huge-icons";
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
  manuallyChangeQualificationStageAction,
  startManualQualificationAction,
  updateLeadTargetQueueAction,
} from "@/features/leads/qualification-tab-actions";

type LeadQueue = { id: string; name: string; branchId: string | null };

export function StartQualificationButton({
  leadId,
  leadName,
  qualificationStatus,
  alreadyStarted,
  variant = "outline",
  size = "xs",
  className = "",
}: {
  leadId: string;
  leadName?: string;
  qualificationStatus?: string | null;
  alreadyStarted?: boolean;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "xs" | "icon";
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const isStarted = Boolean(alreadyStarted || (qualificationStatus && qualificationStatus !== "pending"));

  if (isStarted) {
    return (
      <span
        title="A qualificação por IA deste lead já foi iniciada"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 ${className}`}
      >
        <Sparkle className="size-3.5 text-emerald-500" />
        Qualificação Iniciada
      </span>
    );
  }

  async function handleStart() {
    setBusy(true);
    const res = await startManualQualificationAction({ leadId });
    setBusy(false);

    if (res.success) {
      toast.success(`Qualificação por IA iniciada para "${leadName || "o lead"}"! Primeira mensagem enviada.`);
      router.refresh();
    } else {
      toast.error(res.error ?? "Erro ao iniciar qualificação por IA.");
    }
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={handleStart}
      disabled={busy}
      title="Disparar primeira mensagem do robô de qualificação IA"
      className={`gap-1 font-medium ${className}`}
    >
      <Sparkle className="size-3.5 text-amber-500" />
      {busy ? "Iniciando…" : "Iniciar Qualificação IA"}
    </Button>
  );
}

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
      <StartQualificationButton leadId={leadId} leadName={leadName} />

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
