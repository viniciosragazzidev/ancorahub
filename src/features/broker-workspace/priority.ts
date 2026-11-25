import { IMPORTED_FIRST_CONTACT_HOURS, importedFirstContactDueAt, isTeamListLead } from "./imported-first-contact";

export type BrokerWorkspaceActionKind =
  | "awaiting_response"
  | "sla_overdue"
  | "sla_risk"
  | "task_overdue"
  | "return_due"
  | "new_lead"
  | "proposal_pending"
  | "document_pending"
  | "follow_up_stalled";

export type BrokerWorkspaceSeverity = "critical" | "warning" | "normal";

export type BrokerWorkspacePriorityLead = {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  assignedAt: Date | null;
  firstContactAt: Date | null;
  stageEnteredAt: Date | null;
  sourceChannel?: string | null;
  hasAnyMessage?: boolean;
  lastIncomingAt: Date | null;
  hasPendingQuote: boolean;
  pendingDocumentCount: number;
  /**
   * Lead da lista interna da equipe (importado pelo supervisor): o prazo do primeiro contato, em horas, escolhido
   * na importação. Dentro dele o lead não é pendência; o SLA da empresa vale só para lead quente. Vazio: lead quente.
   */
  importedFirstContactHours?: number | null;
};

export type BrokerWorkspacePriorityTask = {
  id: string;
  leadId: string;
  title: string;
  dueAt: Date | null;
  priority: "low" | "normal" | "urgent";
  createdAt: Date;
};

export type BrokerWorkspacePriority = {
  kind: BrokerWorkspaceActionKind;
  severity: BrokerWorkspaceSeverity;
  leadId: string;
  taskId?: string;
  dueAt: Date | null;
  referenceAt: Date;
  title: string;
  description: string;
  href: string;
};

export type BrokerWorkspacePriorityInput = {
  leads: BrokerWorkspacePriorityLead[];
  tasks: BrokerWorkspacePriorityTask[];
  now?: Date;
  slaFirstContactMinutes: number;
  stagnantDays?: number;
};

export const BROKER_WORKSPACE_ACTIVE_LEAD_STATUSES = [
  "new",
  "distributed",
  "in_contact",
  "contacted",
  "quote_sent",
  "negotiation",
  "documentation_pending",
  "under_analysis",
  "awaiting_reply",
] as const;

const activeLeadStatuses = new Set<string>(BROKER_WORKSPACE_ACTIVE_LEAD_STATUSES);

export type FirstContactSlaInput = {
  status: string;
  sourceChannel?: string | null;
  importedFirstContactHours?: number | null;
  assignedAt: Date | null;
  firstContactAt: Date | null;
  stageEnteredAt: Date | null;
  hasAnyMessage?: boolean;
  slaFirstContactMinutes: number;
  now?: Date;
};

/** Single source of truth for broker and supervisor first-contact pendencies. */
export function resolveFirstContactSla(input: FirstContactSlaInput): { state: "overdue" | "risk"; dueAt: Date; imported: boolean } | null {
  if (!activeLeadStatuses.has(input.status) || input.firstContactAt || !input.assignedAt) return null;
  const now = input.now ?? new Date();
  const imported = isTeamListLead(input.sourceChannel) || input.importedFirstContactHours != null;

  if (imported) {
    const hours = input.importedFirstContactHours ?? IMPORTED_FIRST_CONTACT_HOURS;
    const dueAt = importedFirstContactDueAt(input.assignedAt, hours);
    const advancedFromInitialStage = input.status !== "in_contact" && input.stageEnteredAt !== null;
    if (input.hasAnyMessage || advancedFromInitialStage || !dueAt || dueAt.getTime() > now.getTime()) return null;
    return { state: "overdue", dueAt, imported: true };
  }

  const safeSlaMinutes = Math.max(1, input.slaFirstContactMinutes);
  const dueAt = new Date(input.assignedAt.getTime() + safeSlaMinutes * 60_000);
  if (dueAt.getTime() <= now.getTime()) return { state: "overdue", dueAt, imported: false };
  const riskMs = Math.max(10 * 60_000, Math.round(safeSlaMinutes * 0.2) * 60_000);
  return dueAt.getTime() - now.getTime() <= riskMs ? { state: "risk", dueAt, imported: false } : null;
}

export function isFirstContactOverdue(input: FirstContactSlaInput) {
  return resolveFirstContactSla(input)?.state === "overdue";
}

const kindOrder: Record<BrokerWorkspaceActionKind, number> = {
  awaiting_response: 0,
  sla_overdue: 1,
  sla_risk: 2,
  task_overdue: 3,
  return_due: 4,
  new_lead: 5,
  proposal_pending: 6,
  document_pending: 7,
  follow_up_stalled: 8,
};

function isReturnTask(task: BrokerWorkspacePriorityTask) {
  return /\b(retorn|follow[ -]?up)\b/i.test(task.title);
}

function addLeadPriority(
  priorities: BrokerWorkspacePriority[],
  lead: BrokerWorkspacePriorityLead,
  kind: BrokerWorkspaceActionKind,
  severity: BrokerWorkspaceSeverity,
  referenceAt: Date,
  dueAt: Date | null,
  description: string,
) {
  priorities.push({
    kind,
    severity,
    leadId: lead.id,
    dueAt,
    referenceAt,
    title: lead.name,
    description,
    href: `/leads/${lead.id}`,
  });
}

/**
 * Produces the broker's action queue from persisted operational facts only.
 * The result never invokes AI or uses client-supplied scope.
 */
export function prioritizeBrokerWorkspace(input: BrokerWorkspacePriorityInput): BrokerWorkspacePriority[] {
  const now = input.now ?? new Date();
  const stagnantMs = (input.stagnantDays ?? 3) * 24 * 60 * 60 * 1000;
  const safeSlaMinutes = Math.max(1, input.slaFirstContactMinutes);
  const priorities: BrokerWorkspacePriority[] = [];
  const leadsById = new Map(input.leads.map((lead) => [lead.id, lead]));

  for (const lead of input.leads) {
    if (!activeLeadStatuses.has(lead.status)) continue;

    if (lead.lastIncomingAt) {
      addLeadPriority(priorities, lead, "awaiting_response", "critical", lead.lastIncomingAt, null, "Cliente aguardando resposta.");
    }

    const firstContactSla = resolveFirstContactSla({ ...lead, slaFirstContactMinutes: safeSlaMinutes, now });
    if (firstContactSla?.state === "overdue") {
      addLeadPriority(priorities, lead, "sla_overdue", "critical", lead.assignedAt!, firstContactSla.dueAt, firstContactSla.imported ? "Prazo do primeiro contato da lista venceu." : "SLA de primeiro contato vencido.");
    } else if (firstContactSla?.state === "risk") {
      addLeadPriority(priorities, lead, "sla_risk", "warning", lead.assignedAt!, firstContactSla.dueAt, "SLA de primeiro contato pr\u00f3ximo do limite.");
    }

    if (lead.status === "new" || lead.status === "distributed") {
      addLeadPriority(priorities, lead, "new_lead", "warning", lead.createdAt, null, "Novo lead aguardando o primeiro atendimento.");
    }
    if (lead.hasPendingQuote) {
      addLeadPriority(priorities, lead, "proposal_pending", "normal", lead.createdAt, null, "Cotação enviada aguardando acompanhamento.");
    }
    if (lead.pendingDocumentCount > 0) {
      addLeadPriority(priorities, lead, "document_pending", "normal", lead.createdAt, null, "Há documentos pendentes neste atendimento.");
    }
    if (lead.stageEnteredAt && now.getTime() - lead.stageEnteredAt.getTime() >= stagnantMs) {
      addLeadPriority(priorities, lead, "follow_up_stalled", "warning", lead.stageEnteredAt, null, "Negociação sem avanço na etapa atual.");
    }
  }

  for (const task of input.tasks) {
    const lead = leadsById.get(task.leadId);
    if (!lead || !task.dueAt) continue;
    if (task.dueAt.getTime() < now.getTime()) {
      priorities.push({
        kind: "task_overdue",
        severity: "critical",
        leadId: lead.id,
        taskId: task.id,
        dueAt: task.dueAt,
        referenceAt: task.dueAt,
        title: task.title,
        description: `Tarefa vencida para ${lead.name}.`,
        href: `/leads/${lead.id}#tarefas`,
      });
    } else if (isReturnTask(task)) {
      priorities.push({
        kind: "return_due",
        severity: task.priority === "urgent" ? "warning" : "normal",
        leadId: lead.id,
        taskId: task.id,
        dueAt: task.dueAt,
        referenceAt: task.dueAt,
        title: task.title,
        description: `Retorno agendado para ${lead.name}.`,
        href: `/leads/${lead.id}#tarefas`,
      });
    }
  }

  return priorities.sort((left, right) => {
    const kindDifference = kindOrder[left.kind] - kindOrder[right.kind];
    if (kindDifference !== 0) return kindDifference;
    const leftTime = (left.dueAt ?? left.referenceAt).getTime();
    const rightTime = (right.dueAt ?? right.referenceAt).getTime();
    if (leftTime !== rightTime) return leftTime - rightTime;
    const leadDifference = left.leadId.localeCompare(right.leadId);
    if (leadDifference !== 0) return leadDifference;
    return (left.taskId ?? "").localeCompare(right.taskId ?? "");
  });
}

export function getNextBrokerWorkspaceAction(input: BrokerWorkspacePriorityInput) {
  return prioritizeBrokerWorkspace(input)[0] ?? null;
}

/** Compatibility wrapper for callers that only need the hot-lead window. */
export function resolveSlaFirstContactState(input: {
  firstContactAt: Date | null;
  assignedAt: Date | null;
  slaFirstContactMinutes: number;
  now?: Date;
}): { state: "overdue" | "risk"; slaAt: Date } | null {
  const result = resolveFirstContactSla({ ...input, status: "in_contact", stageEnteredAt: null });
  return result ? { state: result.state, slaAt: result.dueAt } : null;
}
