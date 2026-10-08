"use client";

import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { Button } from "@/components/arc/button/button";
import { ChipGroup } from "@/components/arc/chip-group/chip-group";
import { DatePicker } from "@/components/arc/date-picker/date-picker";
import { Input } from "@/components/arc/input/input";
import { RadioCards } from "@/components/arc/radio-cards/radio-cards";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Textarea } from "@/components/arc/textarea/textarea";
import { FOLLOW_UP_OPTIONS, type FollowUpOptionValue } from "@/features/broker-workspace/follow-up-options";
import { MOTIVOS_PERDA, MOTIVO_PERDA_LABELS } from "@/features/leads/lead-status-constants";

import { toLocalDateKey } from "./format";
import type { LeadDetailController } from "./use-lead-detail";

const STEP_SEGMENTS = [
  { value: "quote_sent", label: "Cotação" },
  { value: "negotiation", label: "Negociação" },
  { value: "no_contact", label: "Sem contato" },
  { value: "no_interest", label: "Sem interesse" },
];

const MIN_JUSTIFICATION = 15;

/** Register the stage of the attendance: follow-up reminder, loss reason and the AI regression protection. */
export function StepSheet({ c }: { c: LeadDetailController }) {
  const {
    showUpdateSheet,
    setShowUpdateSheet,
    selectedStep,
    setSelectedStep,
    currentStepOption,
    followupOption,
    setFollowupOption,
    customFollowupDate,
    setCustomFollowupDate,
    observation,
    setObservation,
    lossReason,
    setLossReason,
    regressionJustification,
    setRegressionJustification,
    potentialSaleCheck,
    isSelectedStepRegression,
    updatingStep,
    handleSaveStep,
  } = c;

  const followUpOptions =
    selectedStep === "no_contact" ? FOLLOW_UP_OPTIONS.no_contact : selectedStep === "quote_sent" ? FOLLOW_UP_OPTIONS.quote_sent : null;
  const justificationLength = regressionJustification.trim().length;
  const showRegressionGuard = potentialSaleCheck.isPotentialSale && isSelectedStepRegression;

  return (
    <BottomSheet
      open={showUpdateSheet}
      onOpenChange={setShowUpdateSheet}
      title="Como está o atendimento?"
      description="Registre a etapa para manter seu acompanhamento em dia."
      detents={[0.9]}
      closeLabel="Fechar"
      className="arc-venancor"
    >
      <div className="flex flex-col gap-5 pb-2">
        <div className="flex flex-col gap-2">
          <SegmentedControl label="Etapa do atendimento" options={STEP_SEGMENTS} value={selectedStep} onValueChange={setSelectedStep} />
          {currentStepOption ? <p className="text-sm text-(--text-secondary)">{currentStepOption.description}</p> : null}
          {selectedStep === "no_interest" || selectedStep === "no_contact" ? (
            <p className="text-sm text-(--text-secondary)">Este atendimento será marcado como finalizado.</p>
          ) : null}
        </div>

        {followUpOptions ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-(--foreground)">
              {selectedStep === "no_contact" ? "Quando deseja tentar novamente?" : "Quando deseja acompanhar novamente?"}
            </p>
            <ChipGroup
              label="Próximo acompanhamento"
              multiple={false}
              options={followUpOptions.map((option) => ({ value: option.value, label: option.label }))}
              value={[followupOption]}
              onValueChange={(next) => {
                if (next[0]) setFollowupOption(next[0] as FollowUpOptionValue);
              }}
            />
            {followupOption === "custom" ? (
              <DatePicker
                label="Data do próximo acompanhamento"
                locale="pt-BR"
                placeholder="Escolher data"
                minDate={new Date()}
                value={customFollowupDate ? new Date(`${customFollowupDate}T12:00:00`) : undefined}
                onChange={(date) => setCustomFollowupDate(date ? toLocalDateKey(date) : "")}
              />
            ) : null}
          </div>
        ) : null}

        {selectedStep === "negotiation" ? (
          <Input
            label="Observação (opcional)"
            placeholder="Ex.: cliente está comparando duas operadoras"
            value={observation}
            onChange={(event) => setObservation(event.target.value)}
          />
        ) : null}

        {selectedStep === "no_interest" ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-(--foreground)">Por que o cliente não seguiu?</p>
            <RadioCards
              aria-label="Motivo da perda"
              layout="list"
              options={MOTIVOS_PERDA.map((motivo) => ({ value: motivo, label: MOTIVO_PERDA_LABELS[motivo] }))}
              value={lossReason}
              onValueChange={setLossReason}
            />
          </div>
        ) : null}

        {showRegressionGuard ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-(--surface-muted) p-4">
            <p className="text-sm font-medium text-(--foreground)">Proteção de regressão da IA</p>
            <p className="text-sm text-(--text-secondary)">
              A IA identificou uma potencial venda ({potentialSaleCheck.reason}). Para recuar a etapa ou descartar, registre uma
              justificativa para a supervisão.
            </p>
            <Textarea
              label="Justificativa para a supervisão"
              description={`Mínimo de ${MIN_JUSTIFICATION} caracteres.`}
              rows={3}
              value={regressionJustification}
              error={
                justificationLength > 0 && justificationLength < MIN_JUSTIFICATION
                  ? `Faltam ${MIN_JUSTIFICATION - justificationLength} caracteres para o mínimo exigido.`
                  : undefined
              }
              onChange={(event) => setRegressionJustification(event.target.value)}
            />
          </div>
        ) : null}

        <Button size="lg" loading={updatingStep} disabled={updatingStep} onClick={handleSaveStep}>
          Salvar etapa
        </Button>
      </div>
    </BottomSheet>
  );
}
