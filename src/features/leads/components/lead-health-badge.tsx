"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type LeadHealth =
  | { type: "critical-unworked"; label: "Não trabalhado" }
  | { type: "warning-at-risk"; label: "Em risco" }
  | { type: "warning-stalled"; label: "Estagnado" }
  | { type: "muted-no-broker"; label: "Sem corretor" }
  | { type: "muted-unassigned"; label: "Não iniciado" }
  | { type: "success-healthy"; label: "Saudável" }
  | { type: "info-new"; label: "Novo" };

const HEALTH_VARIANT: Record<
  LeadHealth["type"],
  "destructive" | "warning" | "secondary" | "success" | "info" | "outline"
> = {
  "critical-unworked": "destructive",
  "warning-at-risk": "warning",
  "warning-stalled": "warning",
  "muted-no-broker": "secondary",
  "muted-unassigned": "secondary",
  "success-healthy": "success",
  "info-new": "info",
};

const HEALTH_ICON: Record<LeadHealth["type"], string> = {
  "critical-unworked": "🔴",
  "warning-at-risk": "🟡",
  "warning-stalled": "🟠",
  "muted-no-broker": "⚪",
  "muted-unassigned": "⚪",
  "success-healthy": "🟢",
  "info-new": "🟦",
};

const HEALTH_TOOLTIP: Record<LeadHealth["type"], string> = {
  "critical-unworked":
    "O corretor não iniciou o atendimento dentro do prazo SLA. O lead será redistribuído.",
  "warning-at-risk":
    "O corretor está próximo de estourar o SLA de primeiro contato.",
  "warning-stalled":
    "O lead está estagnado na mesma etapa há vários dias sem avanço.",
  "muted-no-broker":
    "Lead aguardando distribuição para um corretor.",
  "muted-unassigned":
    "Lead distribuído mas o corretor ainda não iniciou o atendimento.",
  "success-healthy":
    "Lead em acompanhamento ativo dentro dos prazos esperados.",
  "info-new":
    "Lead recém-criado, ainda dentro do período inicial.",
};

/**
 * Compute a lead health indicator based on timing data and SLA thresholds.
 *
 * Priority order (first match wins):
 *   1. No broker assigned (any status except new)
 *   2. New — created within last hour
 *   3. Unworked — distributed without first contact, past SLA deadline
 *   4. At risk — distributed without first contact, approaching SLA
 *   5. Non-started — distributed with broker, service not started yet, within SLA
 *   6. Stalled — active status without stage progress for stagnantDays
 *   7. Healthy (everything else)
 */
export function computeLeadHealth(
  lead: {
    status: string;
    createdAt: string;
    assignedAt?: string | null;
    stageEnteredAt?: string | null;
    serviceStartedAt?: string | null;
    firstContactAt?: string | null;
    corretorId?: string | null;
  },
  slaFirstContactMinutes: number,
  slaStagnantDays: number,
): LeadHealth {
  const now = Date.now();

  // 1. No broker assigned — regardless of status
  if (!lead.corretorId) {
    return { type: "muted-no-broker", label: "Sem corretor" };
  }

  // 2. New — created within the last hour
  if (lead.status === "new" && lead.createdAt) {
    const createdTime = new Date(lead.createdAt).getTime();
    const elapsedHours = (now - createdTime) / (60 * 60 * 1000);
    if (elapsedHours < 1) {
      return { type: "info-new", label: "Novo" };
    }
  }

  // 3/4/5. Distributed without first contact → SLA health check
  if (lead.status === "distributed" && !lead.firstContactAt && lead.assignedAt) {
    const assignedTime = new Date(lead.assignedAt).getTime();
    const elapsedMs = now - assignedTime;
    const slaMs = slaFirstContactMinutes * 60_000;

    // 3. Past SLA deadline → critical
    if (elapsedMs >= slaMs) {
      return { type: "critical-unworked", label: "Não trabalhado" };
    }
    // 4. Approaching SLA deadline (70%+ elapsed) → at risk
    if (elapsedMs >= slaMs * 0.7) {
      return { type: "warning-at-risk", label: "Em risco" };
    }
    // 5. Within SLA window, service not started → muted
    if (!lead.serviceStartedAt) {
      return { type: "muted-unassigned", label: "Não iniciado" };
    }
  }

  // Also check distributed leads without assignedAt (unusual edge case)
  if (lead.status === "distributed" && !lead.firstContactAt && !lead.serviceStartedAt) {
    return { type: "muted-unassigned", label: "Não iniciado" };
  }

  // 6. Stalled — active status without stage progress
  const activeStatuses: readonly string[] = [
    "in_contact",
    "quote_sent",
    "negotiation",
    "documentation_pending",
    "under_analysis",
  ];
  if (activeStatuses.includes(lead.status) && lead.stageEnteredAt) {
    const stageTime = new Date(lead.stageEnteredAt).getTime();
    const elapsedDays = (now - stageTime) / (24 * 60 * 60 * 1000);
    if (elapsedDays >= slaStagnantDays) {
      return { type: "warning-stalled", label: "Estagnado" };
    }
  }

  // 7. Default: healthy
  return { type: "success-healthy", label: "Saudável" };
}

export function LeadHealthBadge({
  health,
}: {
  health: LeadHealth;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant={HEALTH_VARIANT[health.type]}
            className="gap-1 px-1.5 py-0 text-[10px] leading-tight"
          >
            <span className="text-[11px]" aria-hidden="true">
              {HEALTH_ICON[health.type]}
            </span>
            {health.label}
          </Badge>
        }
      />
      <TooltipContent side="top" className="max-w-56 text-xs">
        {HEALTH_TOOLTIP[health.type]}
      </TooltipContent>
    </Tooltip>
  );
}
