"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkle, CheckCircle, UserCheck, Flame, ThermometerCold, ShieldX } from "@/components/huge-icons";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { manuallyChangeQualificationStageAction } from "@/features/leads/qualification-tab-actions";

type Broker = { id: string; name: string; branchId: string | null };
type Queue = { id: string; name: string; branchId: string | null };

export function ManualQualificationDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  brokers = [],
  queues = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  brokers?: Broker[];
  queues?: Queue[];
}) {
  const router = useRouter();
  const [rating, setRating] = useState<"qualified" | "hot" | "warm" | "cold" | "not_qualified">("qualified");
  const [targetBrokerId, setTargetBrokerId] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    const isQualified = rating !== "not_qualified";
    const res = await manuallyChangeQualificationStageAction({
      leadId,
      targetStage: isQualified ? "qualificado" : "humano",
      brokerId: targetBrokerId || null,
    });

    setBusy(false);

    if (res.success) {
      toast.success(`Lead "${leadName}" qualificado com sucesso!`);
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error(res.error ?? "Erro ao qualificar lead.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-md">
        <DialogTitle className="flex items-center gap-2">
          <Sparkle className="size-5 text-primary" />
          Qualificar Lead Manualmente
        </DialogTitle>
        <DialogDescription>
          Defina a classificação e os responsáveis para o lead <strong>{leadName}</strong>. Ele será promovido para a etapa de leads qualificados.
        </DialogDescription>

        <form onSubmit={handleSubmit} className="grid gap-4 mt-3">
          {/* Seletor de Temperatura / Classificação */}
          <div className="grid gap-2">
            <Label className="text-xs font-semibold">Classificação / Temperatura</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRating("qualified")}
                className={`flex items-center gap-2 rounded-lg border p-2.5 text-left text-xs font-medium transition-colors ${
                  rating === "qualified" || rating === "hot"
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold"
                    : "border-border/70 hover:bg-muted/40"
                }`}
              >
                <Flame className="size-4 text-emerald-500" />
                <span>Qualificado (Quente)</span>
              </button>

              <button
                type="button"
                onClick={() => setRating("warm")}
                className={`flex items-center gap-2 rounded-lg border p-2.5 text-left text-xs font-medium transition-colors ${
                  rating === "warm"
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold"
                    : "border-border/70 hover:bg-muted/40"
                }`}
              >
                <Sparkle className="size-4 text-amber-500" />
                <span>Morno (Em Análise)</span>
              </button>

              <button
                type="button"
                onClick={() => setRating("cold")}
                className={`flex items-center gap-2 rounded-lg border p-2.5 text-left text-xs font-medium transition-colors ${
                  rating === "cold"
                    ? "border-sky-500/50 bg-sky-500/10 text-sky-700 dark:text-sky-300 font-semibold"
                    : "border-border/70 hover:bg-muted/40"
                }`}
              >
                <ThermometerCold className="size-4 text-sky-500" />
                <span>Frio (Pesquisando)</span>
              </button>

              <button
                type="button"
                onClick={() => setRating("not_qualified")}
                className={`flex items-center gap-2 rounded-lg border p-2.5 text-left text-xs font-medium transition-colors ${
                  rating === "not_qualified"
                    ? "border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-300 font-semibold"
                    : "border-border/70 hover:bg-muted/40"
                }`}
              >
                <ShieldX className="size-4 text-rose-500" />
                <span>Desqualificado</span>
              </button>
            </div>
          </div>

          {/* Atribuição de Corretor */}
          <div className="grid gap-2">
            <Label htmlFor="manual-qual-broker" className="text-xs font-semibold">Corretor Responsável</Label>
            <Select value={targetBrokerId} onValueChange={(val) => setTargetBrokerId(val ?? "")}>
              <SelectTrigger id="manual-qual-broker" className="h-9 text-xs">
                <SelectValue placeholder="Atribuição Automática (Fila)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="" className="text-xs">Atribuição Automática (Fila da Unidade)</SelectItem>
                {brokers.map((b) => (
                  <SelectItem key={b.id} value={b.id} className="text-xs">
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Observação / Auditoria */}
          <div className="grid gap-2">
            <Label htmlFor="manual-qual-note" className="text-xs font-semibold">Observação / Nota Interna (Opcional)</Label>
            <Input
              id="manual-qual-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: Cliente respondeu cotação via telefone"
              className="h-9 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
            <DialogClose render={<Button type="button" variant="ghost" size="sm">Cancelar</Button>} />
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? "Salvando…" : "Confirmar Qualificação"}
            </Button>
          </div>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
