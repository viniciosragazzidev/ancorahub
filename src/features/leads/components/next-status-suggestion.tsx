"use client";

import React from "react";
import { MagicWand, ArrowRight } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";

type NextStatusSuggestionProps = {
  currentStatus: string;
  onSelectStatus: (nextStatus: string) => void;
  disabled?: boolean;
};

const SUGGESTED_NEXT_MAP: Record<string, string> = {
  new: "in_contact",
  distributed: "in_contact",
  in_contact: "quote_sent",
  quote_sent: "negotiation",
  negotiation: "documentation_pending",
  documentation_pending: "under_analysis",
  under_analysis: "converted",
};

export function NextStatusSuggestion({
  currentStatus,
  onSelectStatus,
  disabled = false,
}: NextStatusSuggestionProps) {
  const suggestedStatus = SUGGESTED_NEXT_MAP[currentStatus];

  if (!suggestedStatus) {
    return null;
  }

  const label = (LEAD_STATUS_LABELS as Record<string, string>)[suggestedStatus] ?? suggestedStatus;

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={disabled}
      onClick={() => onSelectStatus(suggestedStatus)}
      className="h-8 gap-1.5 text-xs border-primary/40 bg-primary/5 text-primary hover:bg-primary/15 hover:border-primary transition-all font-medium shadow-xs"
      title={`Sugestão de progresso do pipeline: ${label}`}
    >
      <MagicWand className="size-3.5 text-primary animate-pulse" />
      <span>Sugerido: Avançar para <strong>{label}</strong></span>
      <ArrowRight className="size-3 text-primary" />
    </Button>
  );
}
