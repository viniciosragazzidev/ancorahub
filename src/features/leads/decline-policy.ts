export function buildDeclinedLeadReleaseUpdate(now: Date) {
  return {
    corretorId: null,
    status: "distributed" as const,
    distributionStatus: "queued" as const,
    assignmentSource: "redistribution" as const,
    distributionUpdatedAt: now,
    stageEnteredAt: now,
    assignedAt: null,
    updatedAt: now,
  };
}
