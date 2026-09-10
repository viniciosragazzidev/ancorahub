export type BulkImportQueue = {
  id: string;
  name: string;
  branchId: string | null;
  assignmentMode?: string;
  aiQualificationEnabled?: boolean;
};

export function getBulkImportQueuesForBranch(
  queues: BulkImportQueue[],
  branchId: string,
) {
  return queues.filter(
    (queue) => !branchId || queue.branchId === null || queue.branchId === branchId,
  );
}

export function isAutomaticQueueAvailableForBulkImport(
  queue: Pick<BulkImportQueue, "branchId" | "assignmentMode">,
  branchId: string,
) {
  return (
    queue.assignmentMode !== "manual" &&
    (queue.branchId === null || queue.branchId === branchId)
  );
}

export function buildBulkImportDistributionState() {
  return {
    corretorId: null,
    status: "new" as const,
    distributionStatus: "queued" as const,
    assignmentSource: null,
    assignmentStrategy: null,
    assignedAt: null,
    qualificationStatus: "qualified" as const,
    qualificationState: "COMPLETED" as const,
  };
}

export function shouldQualifyBulkImportLead(input: {
  qualificationEngineEnabled: boolean;
  queueAiQualificationEnabled: boolean | null;
}) {
  return (
    input.qualificationEngineEnabled &&
    input.queueAiQualificationEnabled !== false
  );
}

export function getBulkImportDistributionReadiness(branch: {
  acceptingLeads: boolean;
  autoDistribute: boolean;
  isDistributionHub: boolean;
}) {
  if (branch.isDistributionHub) {
    return {
      allowed: false as const,
      activateAutoDistribution: false as const,
      reason: "A Central de redistribuição não recebe distribuição automática.",
    };
  }
  if (!branch.acceptingLeads) {
    return {
      allowed: false as const,
      activateAutoDistribution: false as const,
      reason: "A unidade está com o recebimento de leads pausado.",
    };
  }
  return {
    allowed: true as const,
    activateAutoDistribution: !branch.autoDistribute,
  };
}
