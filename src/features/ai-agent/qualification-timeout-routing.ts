export type QualificationTimeoutRoute = {
  queueId: string;
  branchId: string | null;
};

/**
 * The intake route is authoritative when qualification times out. A timeout
 * must never replace a campaign/type queue with an unrelated default queue.
 */
export function resolveQualificationTimeoutRoute(input: {
  currentQueueId: string | null;
  currentBranchId: string | null;
  configuredRoute?: QualificationTimeoutRoute | null;
}): QualificationTimeoutRoute {
  if (input.configuredRoute) return input.configuredRoute;

  return {
    queueId: input.currentQueueId ?? "",
    branchId: input.currentBranchId,
  };
}
