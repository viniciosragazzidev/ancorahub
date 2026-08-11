export const workflowNodeKinds = [
  "trigger.lead_created",
  "trigger.lead_updated",
  "trigger.manual",
  "logic.condition",
  "logic.switch",
  "control.delay",
  "crm.create_task",
  "crm.add_tag",
  "crm.notify_manager",
  "ai.classify_lead",
  "channel.whatsapp_send",
] as const;

export type WorkflowNodeKind = (typeof workflowNodeKinds)[number];
export type WorkflowNodeCategory = "trigger" | "logic" | "control" | "crm" | "ai" | "channel";
export type WorkflowNode = {
  id: string;
  kind: WorkflowNodeKind;
  position: { x: number; y: number };
  config: Record<string, unknown>;
};
export type WorkflowPortDirection = "input" | "output";
export type WorkflowPort = {
  id: string;
  label: string;
  direction: WorkflowPortDirection;
  dataType: "workflow-context" | "lead" | "task" | "classification" | "void";
  maxConnections?: number;
};
export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: "default" | "true" | "false" | "error" | string;
  targetHandle?: "default" | string;
};
export type WorkflowDefinition = {
  schemaVersion: 1;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};

export type WorkflowNodeDefinition = {
  kind: WorkflowNodeKind;
  label: string;
  description: string;
  category: WorkflowNodeCategory;
  editableFields: readonly string[];
  requiredConfig?: readonly string[];
  ports: readonly WorkflowPort[];
  requiredPermissions: readonly string[];
  requiresFeatureFlag?: string;
  requiresHumanConfirmation?: boolean;
};

export type WorkflowValidationIssue = {
  code: "missing_trigger" | "multiple_triggers" | "invalid_edge" | "invalid_connection" | "unreachable_node" | "cycle" | "unsupported_node" | "protected_action" | "configuration_missing" | "dangling_branch" | "feature_disabled";
  message: string;
  nodeId?: string;
  edgeId?: string;
};
