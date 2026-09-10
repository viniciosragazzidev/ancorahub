export type BulkImportQueue = {
  id: string;
  name: string;
  branchId: string | null;
  assignmentMode?: string;
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
  };
}
