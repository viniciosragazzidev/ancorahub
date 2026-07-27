"use client";

import { CheckCircle } from "@/components/huge-icons";

const STAGES = [
  { key: "received", label: "Recebido" },
  { key: "contact", label: "Em contato" },
  { key: "quote", label: "Cotação" },
  { key: "negotiation", label: "Negociação" },
  { key: "closed", label: "Fechamento" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

function statusToStageIndex(status: string): number {
  switch (status) {
    case "new":
    case "distributed":
      return 0;
    case "in_contact":
      return 1;
    case "quote_sent":
      return 2;
    case "negotiation":
    case "documentation_pending":
    case "under_analysis":
      return 3;
    case "converted":
      return 4;
    default:
      return 0;
  }
}

export function LeadProgressStepper({ status }: { status: string }) {
  const currentIndex = statusToStageIndex(status);
  const isLost = status === "lost";

  // For lost, show up to current stage but mark as lost
    if (isLost) return null;

  return (
    <div className="w-full" role="progressbar" aria-label="Progresso do atendimento" aria-valuenow={currentIndex + 1} aria-valuemin={0} aria-valuemax={STAGES.length}>
      {/* Desktop: horizontal steps */}
      <div className="hidden sm:flex items-center justify-between">
        {STAGES.map((stage, i) => {
          const isCompleted = i < currentIndex;
          const isCurrent = i === currentIndex;
          const isFuture = i > currentIndex;

          return (
            <div key={stage.key} className="flex flex-1 items-center">
              {/* Step indicator + label */}
              <div className={`flex flex-col items-center gap-1.5 ${isFuture ? "opacity-40" : ""}`}>
                {/* Circle */}
                <div
                  className={`flex size-7 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-300 ${
                    isCompleted
                      ? "border-success bg-success text-success-foreground"
                      : isCurrent
                        ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                        : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle className="size-4" />
                  ) : isCurrent ? (
                    <span className="size-2 rounded-full bg-current animate-pulse" />
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium leading-tight text-center max-w-16 ${
                    isCompleted
                      ? "text-success"
                      : isCurrent
                        ? "text-primary font-semibold"
                        : "text-muted-foreground"
                  }`}
                >
                  {stage.label}
                </span>
              </div>

              {/* Connector line */}
              {i < STAGES.length - 1 && (
                <div className={`mx-2 flex-1 h-px transition-colors duration-300 ${
                  i < currentIndex ? "bg-success" : "bg-border"
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: compact dots */}
      <div className="flex sm:hidden items-center gap-1">
        <span className="text-[10px] font-medium text-muted-foreground mr-1 whitespace-nowrap">
          {STAGES[currentIndex].label}
        </span>
        <div className="flex items-center gap-1 flex-1">
          {STAGES.map((stage, i) => {
            const isCompleted = i < currentIndex;
            const isCurrent = i === currentIndex;
            return (
              <div
                key={stage.key}
                className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
                  isCompleted
                    ? "bg-success"
                    : isCurrent
                      ? "bg-primary shadow-sm shadow-primary/40"
                      : "bg-muted"
                }`}
                title={stage.label}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
