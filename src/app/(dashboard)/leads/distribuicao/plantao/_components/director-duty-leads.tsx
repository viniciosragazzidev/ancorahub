"use client";

import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import { LeadStatusBadge, LeadTemperature } from "@/components/status-badges";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { formatLiteDate } from "@/components/lite/format/date";
import type { LeadWorkspaceItem } from "@/features/leads/components/lead-workspace-types";
import { MessageCircle } from "lucide-react";
import { DutyLeadDetailsTrigger } from "./duty-lead-details-trigger";

export type DutyLeadRecord = {
  lead: LeadWorkspaceItem;
  groupKey: string;
  groupLabel: string;
  createdAt: string;
  assignedAt: string | null;
  brokerName: string | null;
  queueName: string | null;
  distributionLabel: string;
  distributionTone: "success" | "warning" | "info" | "destructive" | "outline" | "secondary";
  whatsappLabel: string | null;
  returnedUnaccepted: boolean;
  coldHeld: boolean;
};

type Broker = { id: string; name: string; branchId: string | null };
type Branch = { id: string; name: string };

function distributionBadgeTone(tone: DutyLeadRecord["distributionTone"]): BadgeTone {
  if (tone === "destructive") return "danger";
  if (tone === "success" || tone === "warning" || tone === "info") return tone;
  return "neutral";
}

export function DirectorDutyLeads({
  groups,
  brokers,
  branches,
  contextRole,
  contextJobTitle,
  contextBranchId,
  manualAssignmentChoiceEnabled,
  slaFirstContactMinutes,
  slaStagnantDays,
  empty,
}: {
  groups: Array<{ key: string; label: string; leads: DutyLeadRecord[] }>;
  brokers: Broker[];
  branches: Branch[];
  contextRole: string;
  contextJobTitle: string | null;
  contextBranchId: string | null;
  manualAssignmentChoiceEnabled: boolean;
  slaFirstContactMinutes: number;
  slaStagnantDays: number;
  empty: string;
}) {
  const columns: LiteColumn<DutyLeadRecord>[] = [
    {
      id: "lead",
      label: "Lead",
      primary: true,
      render: (row) => (
        <div className="flex min-w-0 items-center gap-2">
          <DutyLeadDetailsTrigger
            lead={row.lead}
            contextRole={contextRole}
            contextJobTitle={contextJobTitle}
            contextBranchId={contextBranchId}
            brokers={brokers}
            branches={branches}
            manualAssignmentChoiceEnabled={manualAssignmentChoiceEnabled}
            slaFirstContactMinutes={slaFirstContactMinutes}
            slaStagnantDays={slaStagnantDays}
          />
          {row.whatsappLabel ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted/40 px-2 py-1 text-xs text-muted-foreground" title={row.whatsappLabel}>
              <MessageCircle className="size-3" aria-hidden="true" /> WhatsApp
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "received",
      label: "Recebido",
      secondary: true,
      render: (row) => formatLiteDate(row.createdAt, { dateStyle: "short", timeStyle: "short" }),
    },
    { id: "temperature", label: "Qualificação", render: (row) => <div className="grid justify-items-start gap-1"><LeadTemperature status={row.lead.qualificationStatus} />{row.coldHeld ? <span className="text-xs text-muted-foreground">Frio, retido pela fila</span> : null}</div> },
    { id: "queue", label: "Fila", render: (row) => row.queueName ?? "Sem fila" },
    { id: "broker", label: "Corretor", nowrap: true, render: (row) => row.returnedUnaccepted ? <Badge tone="warning">Devolvido, aguarda novo corretor</Badge> : row.brokerName ?? "Sem corretor" },
    { id: "distribution", label: "Distribuição", render: (row) => <Badge tone={distributionBadgeTone(row.distributionTone)}>{row.distributionLabel}</Badge> },
    { id: "status", label: "Etapa", render: (row) => <LeadStatusBadge status={row.lead.status} /> },
    { id: "assigned", label: "Distribuído", render: (row) => row.assignedAt && row.lead.corretorId ? formatLiteDate(row.assignedAt, { dateStyle: "short", timeStyle: "short" }) : "Ainda não distribuído" },
  ];

  return (
    <div className="grid min-w-0 gap-4">
      {groups.map((group) => (
        <section key={group.key} aria-label={group.label} className="grid min-w-0 gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
            <h3 className="min-w-0 text-sm font-semibold text-foreground">{group.label}</h3>
            <Badge className="shrink-0 tabular-nums">{group.leads.length}</Badge>
          </div>
          <LiteResponsiveData
            caption={group.label}
            columns={columns}
            rows={group.leads}
            rowKey={(row) => row.lead.id}
            empty={<p>{empty}</p>}
          />
        </section>
      ))}
    </div>
  );
}
