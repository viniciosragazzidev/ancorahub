import { eq, isNull, or, type SQLWrapper } from "drizzle-orm";

/** A branchless schedule is global; a lead without a branch can match any schedule. */
export function isDutyScheduleBranchCompatible(scheduleBranchId: string | null, leadBranchId: string | null) {
  return scheduleBranchId === null || leadBranchId === null || scheduleBranchId === leadBranchId;
}

/** SQL counterpart used by the active-duty retry wake query. */
export function dutyScheduleBranchCondition(scheduleBranch: SQLWrapper, leadBranch: SQLWrapper) {
  return or(isNull(scheduleBranch), isNull(leadBranch), eq(scheduleBranch, leadBranch));
}
