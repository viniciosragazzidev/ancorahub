import type { WorkflowDefinition, WorkflowValidationIssue } from "./contracts";
import { validateWorkflowDefinition } from "./validation";

export const WORKFLOW_AUTOMATION_FEATURE = "feature_workflow_automation_enabled";

export type WorkflowPublicationDecision =
  | { allowed: true; issues: [] }
  | { allowed: false; issues: WorkflowValidationIssue[] };

export function assessWorkflowPublication(
  definition: WorkflowDefinition,
  isFeatureEnabled: boolean,
): WorkflowPublicationDecision {
  const issues = validateWorkflowDefinition(definition);
  if (!isFeatureEnabled) {
    issues.unshift({
      code: "feature_disabled",
      message: "O Automation Builder está desativado pela plataforma.",
    });
  }
  return issues.length ? { allowed: false, issues } : { allowed: true, issues: [] };
}
