"use client";

import React, { useEffect, useState } from "react";
import { Sparkles, Send, Users, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogPopup,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  getCandidateLeadsForBulkQualification,
  triggerBulkQualificationAction,
} from "../bulk-qualification-actions";

type BulkQualificationDialogProps = {
  trigger?: React.ReactElement;
  onSuccess?: () => void;
};

export function BulkQualificationDialog({ trigger, onSuccess }: BulkQualificationDialogProps) {
  const [open, setOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>("all_unqualified");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [candidates, setCandidates] = useState<Array<{ id: string; nome: string; telefone: string; status: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (open) {
      loadPreview(filterType);
    }
  }, [open, filterType]);

  async function loadPreview(type: string) {
    setLoadingPreview(true);
    setResultMessage(null);
    try {
      const res = await getCandidateLeadsForBulkQualification(type);
      setCandidates(res);
    } catch (err) {
      console.error("[BulkQualificationDialog] Failed to load preview:", err);
      setCandidates([]);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleSendBulk() {
    if (candidates.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setResultMessage(null);

    try {
      const res = await triggerBulkQualificationAction({
        filterType: filterType as any,
        leadIds: candidates.map((c) => c.id),
      });

      if (res.success) {
        setResultMessage({
          type: "success",
          text: `Sucesso! Mensagens de qualificação disparadas para ${res.successCount} lead(s).`,
        });
        if (onSuccess) onSuccess();
      } else {
        setResultMessage({
          type: "error",
          text: res.error ?? "Erro ao realizar disparo em massa.",
        });
      }
    } catch {
      setResultMessage({
        type: "error",
        text: "Erro inesperado ao realizar disparo.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const triggerElement = trigger ?? (
    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5">
      <Sparkles className="size-4" />
      Qualificação em Massa
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={triggerElement} />
      <DialogPopup className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-5 text-emerald-500" />
            Disparo de Qualificação por IA em Massa
          </DialogTitle>
          <DialogDescription className="text-xs">
            Envie ou retome mensagens automáticas de qualificação para múltiplos leads de uma só vez.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Grupo de Leads Alvo</label>
            <Select value={filterType} onValueChange={(val) => val && setFilterType(val)}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder="Selecione o filtro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_unqualified">Todos os Leads Não Qualificados (Novos / Em Contato)</SelectItem>
                <SelectItem value="new_leads">Apenas Leads Novos Sem Atendimento</SelectItem>
                <SelectItem value="unresponsive_24h">Leads Sem Resposta Há Mais de 24 Horas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Users className="size-3.5" /> Leads selecionados para disparo
              </span>
              {loadingPreview ? (
                <RefreshCw className="size-3.5 animate-spin text-muted-foreground" />
              ) : (
                <Badge variant="secondary" className="font-semibold tabular-nums">
                  {candidates.length} lead(s)
                </Badge>
              )}
            </div>

            {candidates.length > 0 ? (
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                {candidates.slice(0, 10).map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-card border border-border/50">
                    <span className="font-medium truncate max-w-[200px]">{c.nome}</span>
                    <span className="text-[11px] text-muted-foreground font-mono">{c.telefone}</span>
                  </div>
                ))}
                {candidates.length > 10 && (
                  <p className="text-[11px] text-center text-muted-foreground pt-1">
                    ...e mais {candidates.length - 10} lead(s)
                  </p>
                )}
              </div>
            ) : !loadingPreview ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                Nenhum lead encontrado para este filtro.
              </p>
            ) : null}
          </div>

          {resultMessage && (
            <div className={`p-3 rounded-lg text-xs flex items-start gap-2 ${resultMessage.type === "success" ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400" : "bg-destructive/10 border border-destructive/30 text-destructive"}`}>
              {resultMessage.type === "success" ? (
                <CheckCircle className="size-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
              )}
              <span>{resultMessage.text}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSendBulk}
            disabled={candidates.length === 0 || isSubmitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="size-3.5 animate-spin" />
                Disparando...
              </>
            ) : (
              <>
                <Send className="size-3.5" />
                Confirmar Disparo em Massa
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
