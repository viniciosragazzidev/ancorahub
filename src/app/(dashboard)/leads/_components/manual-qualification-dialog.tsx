"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";
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

  const defaultMsgTemplate = `Olá, ${leadName || "Cliente"}! Recebemos todas as suas informações com sucesso. Em breve um de nossos consultores especializados entrará em contato para enviar uma cotação perfeita para a sua necessidade!`;

  const [sendMessage, setSendMessage] = useState<boolean>(true);
  const [customMessage, setCustomMessage] = useState<string>(defaultMsgTemplate);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    const isQualified = rating !== "not_qualified";
    const res = await manuallyChangeQualificationStageAction({
      leadId,
      targetStage: isQualified ? "qualificado" : "humano",
      brokerId: targetBrokerId || null,
      rating,
      sendMessageToCustomer: isQualified && sendMessage,
      customCustomerMessage: sendMessage ? customMessage : undefined,
    });

    setBusy(false);

    if (res.success) {
      toast.success(`Lead "${leadName}" qualificado com sucesso!`);
      onOpenChange(false);
      setTimeout(() => router.refresh(), 0);
    } else {
      toast.error(res.error ?? "Erro ao qualificar lead.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup key={open ? "open" : "closed"} className="sm:max-w-md">
        <DialogTitle className="flex items-center gap-2">
          <Sparkle className="size-5 text-primary" />
          Qualificar Lead Manualmente
        </DialogTitle>
        <DialogDescription>
          Defina a classificação, corretor e mensagem enviada para <strong>{leadName}</strong>.
        </DialogDescription>

        <form onSubmit={handleSubmit} className="grid gap-4 mt-3">
          {/* Seletor de Temperatura / Classificação */}
          <div className="grid gap-2">
            <Label className="text-xs font-semibold">Classificação / Temperatura</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRating("hot")}
                className={`flex items-center gap-2 rounded-lg border p-2.5 text-left text-xs font-medium transition-colors ${
                  rating === "hot" || rating === "qualified"
                    ? "border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-300 font-semibold"
                    : "border-border/70 hover:bg-muted/40"
                }`}
              >
                <Flame aria-hidden="true" className="size-4 text-rose-500" />
                <span>Quente (Urgente)</span>
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

          {/* Mensagem Padrão para o Cliente no WhatsApp */}
          {rating !== "not_qualified" && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 grid gap-2.5">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="send-whatsapp-msg"
                  checked={sendMessage}
                  onChange={(e) => setSendMessage(e.target.checked)}
                  className="size-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
                />
                <Label htmlFor="send-whatsapp-msg" className="text-xs font-semibold cursor-pointer select-none">
                  Enviar mensagem de confirmação no WhatsApp do cliente
                </Label>
              </div>

              {sendMessage && (
                <div className="grid gap-2 mt-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-medium text-muted-foreground">Modelo de Mensagem:</Label>
                    <button
                      type="button"
                      onClick={() => setCustomMessage(defaultMsgTemplate)}
                      className="text-[11px] text-primary hover:underline"
                    >
                      Restaurar Padrão
                    </button>
                  </div>
                  <textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-border bg-background p-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="Digite ou edite a mensagem enviada..."
                  />
                </div>
              )}
            </div>
          )}

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
