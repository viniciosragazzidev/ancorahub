"use client";

import { Warning } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogPopup, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { FOLLOW_UP_OPTIONS } from "@/features/broker-workspace/follow-up-options";
import { MOTIVOS_PERDA, MOTIVO_PERDA_LABELS } from "@/features/leads/lead-status-constants";
import { STEP_OPTIONS, type LightLeadDetailData } from "./types";
import type { LeadDetailController } from "./use-lead-detail";

export function UpdateStepDialog({ lead, c }: { lead: LightLeadDetailData; c: LeadDetailController }) {
  const { showUpdateSheet, setShowUpdateSheet, selectedStep, setSelectedStep, followupOption, setFollowupOption, customFollowupDate, setCustomFollowupDate, observation, setObservation, lossReason, setLossReason, regressionJustification, setRegressionJustification, updatingStep, potentialSaleCheck, isSelectedStepRegression, handleSaveStep, currentStepOption } = c;
  return (
    <>
        {/* Update Step Sheet / Dialog */}
        <Dialog open={showUpdateSheet} onOpenChange={setShowUpdateSheet}>
          <DialogPopup className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Como está o atendimento?</DialogTitle>
              <DialogDescription className="text-xs">
                Selecione a etapa atual do atendimento para manter seu acompanhamento em dia.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STEP_OPTIONS.map((opt) => (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => setSelectedStep(opt.id)}
                    className={cn(
                      "flex flex-col text-left rounded-xl border p-3 text-xs transition-colors cursor-pointer",
                      selectedStep === opt.id
                        ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary shadow-xs"
                        : "border-border/70 hover:bg-muted/40 text-muted-foreground",
                    )}
                  >
                    <span className="font-semibold text-foreground">{opt.label}</span>
                    <span className="text-[11px] text-muted-foreground mt-0.5">{opt.description}</span>
                  </button>
                ))}
              </div>

              {/* Aviso para finalizações */}
              {(selectedStep === "no_interest" || selectedStep === "no_contact") && (
                <div className="rounded-xl border border-muted bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
                  ℹ️ Este atendimento será marcado como finalizado.
                </div>
              )}

              {/* Conditional Follow-up date pickers */}
              {selectedStep === "no_contact" && (
                <div className="mt-2 rounded-xl border border-primary/20 bg-muted/20 p-3 space-y-2 text-xs">
                  <span className="font-semibold text-foreground block">
                    Quando deseja tentar novamente?
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {FOLLOW_UP_OPTIONS.no_contact.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFollowupOption(opt.value)}
                        className={cn(
                          "rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors text-center cursor-pointer",
                          followupOption === opt.value
                            ? "border-primary bg-primary text-primary-foreground font-semibold"
                            : "border-border bg-card text-muted-foreground",
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {followupOption === "custom" && (
                    <label className="mt-2 grid gap-1.5 text-[11px] font-medium text-foreground" htmlFor="broker-followup-date-no-contact">
                      Data do próximo acompanhamento
                      <Input
                        id="broker-followup-date-no-contact"
                        type="date"
                        value={customFollowupDate}
                        min={new Date().toISOString().slice(0, 10)}
                        onChange={(event) => setCustomFollowupDate(event.target.value)}
                        className="h-9 bg-card text-xs"
                      />
                    </label>
                  )}
                </div>
              )}

              {selectedStep === "quote_sent" && (
                <div className="mt-2 rounded-xl border border-primary/20 bg-muted/20 p-3 space-y-2 text-xs">
                  <span className="font-semibold text-foreground block">
                    Quando deseja acompanhar novamente?
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {FOLLOW_UP_OPTIONS.quote_sent.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFollowupOption(opt.value)}
                        className={cn(
                          "rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors text-center cursor-pointer",
                          followupOption === opt.value
                            ? "border-primary bg-primary text-primary-foreground font-semibold"
                            : "border-border bg-card text-muted-foreground",
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {followupOption === "custom" && (
                    <label className="mt-2 grid gap-1.5 text-[11px] font-medium text-foreground" htmlFor="broker-followup-date-quote">
                      Data do próximo acompanhamento
                      <Input
                        id="broker-followup-date-quote"
                        type="date"
                        value={customFollowupDate}
                        min={new Date().toISOString().slice(0, 10)}
                        onChange={(event) => setCustomFollowupDate(event.target.value)}
                        className="h-9 bg-card text-xs"
                      />
                    </label>
                  )}
                </div>
              )}

              {selectedStep === "negotiation" && (
                <div className="mt-2 space-y-1.5 text-xs">
                  <span className="font-semibold text-foreground block">
                    Deseja registrar uma observação? (Opcional)
                  </span>
                  <input
                    type="text"
                    placeholder="Ex: Cliente está comparando duas opções de operadoras"
                    value={observation}
                    onChange={(e) => setObservation(e.target.value)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs"
                  />
                </div>
              )}

              {selectedStep === "no_interest" && (
                <div className="mt-2 space-y-1.5 text-xs">
                  <label htmlFor="loss-reason-select" className="font-semibold text-foreground block">
                    Por que o cliente não seguiu?
                  </label>
                  <select
                    id="loss-reason-select"
                    value={lossReason}
                    onChange={(e) => setLossReason(e.target.value)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs"
                  >
                    {MOTIVOS_PERDA.map((motivo) => (
                      <option key={motivo} value={motivo}>{MOTIVO_PERDA_LABELS[motivo]}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Proteção de Regressão IA */}
              {potentialSaleCheck.isPotentialSale && isSelectedStepRegression && (
                <div className="mt-3 space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400">
                    <Warning className="size-4 shrink-0" />
                    Proteção de Regressão IA
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    A IA identificou este atendimento como uma potencial venda (
                    <span className="text-amber-700 dark:text-amber-300 font-medium">
                      {potentialSaleCheck.reason}
                    </span>
                    ). Para recuar a etapa ou descartar, é obrigatório registrar uma justificativa detalhada para a supervisão:
                  </p>
                  <textarea
                    rows={3}
                    placeholder="Explique detalhadamente por que este lead está recuando/sendo perdido (mínimo 15 caracteres)..."
                    value={regressionJustification}
                    onChange={(e) => setRegressionJustification(e.target.value)}
                    className="w-full rounded-lg border border-border bg-card p-2 text-xs focus:ring-1 focus:ring-primary"
                  />
                  {regressionJustification.trim().length > 0 &&
                    regressionJustification.trim().length < 15 && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 block font-medium">
                        Faltam {15 - regressionJustification.trim().length} caracteres para o mínimo exigido.
                      </span>
                    )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={updatingStep}
                onClick={() => setShowUpdateSheet(false)}
                className="flex-1 text-xs"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={updatingStep}
                onClick={handleSaveStep}
                className="flex-1 text-xs font-bold bg-primary text-primary-foreground"
              >
                {updatingStep ? "Salvando..." : `SALVAR · ${currentStepOption?.label || "ETAPA"}`}
              </Button>
            </div>
          </DialogPopup>
        </Dialog>
    </>
  );
}
