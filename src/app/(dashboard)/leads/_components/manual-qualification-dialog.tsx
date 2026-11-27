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
import { useArcScopeEnabled } from "@/components/arc/arc-scope-context";
import { LiteActionButton, LiteSelect } from "@/components/lite/controls";
import styles from "./manual-qualification-dialog.module.css";

type Rating = "qualified" | "hot" | "warm" | "cold" | "not_qualified";

const LITE_RATINGS: { value: Rating; name: string; hint: string }[] = [
  { value: "hot", name: "Quente", hint: "Quer fechar logo" },
  { value: "warm", name: "Morno", hint: "Está analisando" },
  { value: "cold", name: "Frio", hint: "Só pesquisando" },
  { value: "not_qualified", name: "Desqualificado", hint: "Sai da fila de venda" },
];

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
  const lite = useArcScopeEnabled();
  const [rating, setRating] = useState<Rating>(lite ? "hot" : "qualified");
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

  // Lite (27/11/2026): mesmo envio, marcação nova; o botão segue o padrão de feedback (repouso, enviando, confirmado, falhou).
  async function submitLite() {
    const isQualified = rating !== "not_qualified";
    const res = await manuallyChangeQualificationStageAction({
      leadId,
      targetStage: isQualified ? "qualificado" : "humano",
      brokerId: targetBrokerId || null,
      rating,
      sendMessageToCustomer: isQualified && sendMessage,
      customCustomerMessage: sendMessage ? customMessage : undefined,
    });
    return res.success ? { ok: true as const } : { ok: false as const, error: res.error ?? "Não deu para qualificar o lead." };
  }

  if (lite) {
    const brokerOptions = [{ value: "", label: "Automático, pela fila da unidade" }, ...brokers.map((b) => ({ value: b.id, label: b.name }))];
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogPopup key={open ? "open" : "closed"} className={styles.popup}>
          <div className={styles.head}>
            <div>
              <DialogTitle className={styles.title}>Qualificar manualmente</DialogTitle>
              <DialogDescription className={styles.description}>Defina como {leadName || "o lead"} segue no atendimento.</DialogDescription>
            </div>
            <DialogClose className={styles.close} aria-label="Fechar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </DialogClose>
          </div>
          <form className={styles.form} onSubmit={(event) => event.preventDefault()}>
            <fieldset className={styles.field}>
              <legend className={styles.label}>Classificação</legend>
              <div className={styles.ratings} role="radiogroup" aria-label="Classificação">
                {LITE_RATINGS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={rating === option.value}
                    className={styles.rating}
                    onClick={() => setRating(option.value)}
                  >
                    <span className={styles.ratingName}>{option.name}</span>
                    <span className={styles.ratingHint}>{option.hint}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <div className={styles.field}>
              {brokers.length ? (
                <LiteSelect label="Corretor" value={targetBrokerId} options={brokerOptions} onChange={setTargetBrokerId} searchPlaceholder="Buscar corretor" />
              ) : (
                <>
                  <span className={styles.label}>Corretor</span>
                  <p className={styles.fixed}>Automático, pela fila da unidade.</p>
                </>
              )}
            </div>
            {rating !== "not_qualified" ? (
              <div className={styles.field}>
                <label className={styles.switchRow}>
                  Enviar confirmação no WhatsApp
                  <button type="button" role="switch" aria-checked={sendMessage} className={styles.switch} onClick={() => setSendMessage((current) => !current)} />
                </label>
                {sendMessage ? (
                  <>
                    <div className={styles.messageHead}>
                      <label htmlFor="manual-qual-message" className={styles.label}>Mensagem</label>
                      <button type="button" className={styles.restore} onClick={() => setCustomMessage(defaultMsgTemplate)}>Restaurar padrão</button>
                    </div>
                    <textarea id="manual-qual-message" className={styles.textarea} value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} rows={4} />
                  </>
                ) : null}
              </div>
            ) : null}
            <div className={styles.foot}>
              <DialogClose className={styles.cancel}>Cancelar</DialogClose>
              <LiteActionButton
                busyLabel="Qualificando…"
                doneLabel="Lead qualificado"
                keeps="O lead continua como estava."
                onAction={submitLite}
                onDone={() => {
                  window.setTimeout(() => {
                    onOpenChange(false);
                    router.refresh();
                  }, 600);
                }}
              >
                Confirmar qualificação
              </LiteActionButton>
            </div>
          </form>
        </DialogPopup>
      </Dialog>
    );
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
                className={`flex items-center gap-2 rounded-full border p-2.5 text-left text-xs font-medium transition-colors ${
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
                className={`flex items-center gap-2 rounded-full border p-2.5 text-left text-xs font-medium transition-colors ${
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
                className={`flex items-center gap-2 rounded-full border p-2.5 text-left text-xs font-medium transition-colors ${
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
                className={`flex items-center gap-2 rounded-full border p-2.5 text-left text-xs font-medium transition-colors ${
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
            <div className="rounded-[var(--radius-card)] border border-primary/20 bg-primary/8 p-3 grid gap-2.5">
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
                    className="w-full rounded-full border border-border bg-background p-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
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
