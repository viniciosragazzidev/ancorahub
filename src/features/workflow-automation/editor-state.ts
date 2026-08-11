import { getWorkflowNodeDefinition } from "./registry";
import type { WorkflowDefinition, WorkflowEdge, WorkflowNode, WorkflowNodeKind } from "./contracts";

export function createWorkflowNode(kind: WorkflowNodeKind, position: WorkflowNode["position"]): WorkflowNode {
  return { id: crypto.randomUUID(), kind, position, config: {} };
}

export function canConnectWorkflowNodes(definition: WorkflowDefinition, sourceId: string, targetId: string, sourceHandle = "default", targetHandle = "default") {
  if (sourceId === targetId || definition.edges.some((edge) => edge.source === sourceId && edge.target === targetId && (edge.sourceHandle ?? "default") === sourceHandle)) return false;
  const source = definition.nodes.find((node) => node.id === sourceId);
  const target = definition.nodes.find((node) => node.id === targetId);
  const output = source && getWorkflowNodeDefinition(source.kind)?.ports.find((port) => port.direction === "output" && port.id === sourceHandle);
  const input = target && getWorkflowNodeDefinition(target.kind)?.ports.find((port) => port.direction === "input" && port.id === targetHandle);
  if (!output || !input) return false;
  if (input.dataType !== "workflow-context" && output.dataType !== input.dataType) return false;
  if (output.maxConnections && definition.edges.filter((edge) => edge.source === sourceId && (edge.sourceHandle ?? "default") === sourceHandle).length >= output.maxConnections) return false;
  return true;
}

export function connectWorkflowNodes(definition: WorkflowDefinition, source: string, target: string, sourceHandle = "default", targetHandle = "default"): WorkflowDefinition {
  if (!canConnectWorkflowNodes(definition, source, target, sourceHandle, targetHandle)) return definition;
  const edge: WorkflowEdge = { id: crypto.randomUUID(), source, target, sourceHandle, targetHandle };
  return { ...definition, edges: [...definition.edges, edge] };
}

export function removeWorkflowNode(definition: WorkflowDefinition, nodeId: string): WorkflowDefinition {
  return { ...definition, nodes: definition.nodes.filter((node) => node.id !== nodeId), edges: definition.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId) };
}

export function autoLayoutWorkflow(definition: WorkflowDefinition): WorkflowDefinition {
  const children = new Map(definition.nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of definition.edges) children.get(edge.source)?.push(edge.target);
  const depths = new Map<string, number>();
  const trigger = definition.nodes.find((node) => node.kind.startsWith("trigger."));
  const visit = (id: string, depth: number) => { if ((depths.get(id) ?? -1) >= depth) return; depths.set(id, depth); for (const child of children.get(id) ?? []) visit(child, depth + 1); };
  if (trigger) visit(trigger.id, 0);
  const lanes = new Map<number, number>();
  return { ...definition, nodes: definition.nodes.map((node) => {
    const depth = depths.get(node.id) ?? 0;
    const lane = lanes.get(depth) ?? 0;
    lanes.set(depth, lane + 1);
    return { ...node, position: { x: 120 + lane * 300, y: 120 + depth * 190 } };
  }) };
}
