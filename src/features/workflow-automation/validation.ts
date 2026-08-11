import { getWorkflowNodeDefinition } from "./registry";
import type { WorkflowDefinition, WorkflowValidationIssue } from "./contracts";

export function validateWorkflowDefinition(definition: WorkflowDefinition): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = [];
  const nodeIds = new Set(definition.nodes.map((node) => node.id));
  const triggers = definition.nodes.filter((node) => node.kind.startsWith("trigger."));

  if (!triggers.length) issues.push({ code: "missing_trigger", message: "Todo fluxo precisa de um gatilho inicial." });
  if (triggers.length > 1) issues.push({ code: "multiple_triggers", message: "Um fluxo publicado deve ter apenas um gatilho inicial." });

  for (const node of definition.nodes) {
    const spec = getWorkflowNodeDefinition(node.kind);
    if (!spec) {
      issues.push({ code: "unsupported_node", message: "Este tipo de nó não está registrado.", nodeId: node.id });
      continue;
    }
    if (spec.requiresHumanConfirmation) issues.push({ code: "protected_action", message: `${spec.label} exige confirmação humana antes de poder ser publicado.`, nodeId: node.id });
    for (const field of spec.requiredConfig ?? []) {
      const value = node.config[field];
      if (typeof value !== "string" || !value.trim()) {
        issues.push({ code: "configuration_missing", message: `${spec.label} precisa de “${field}” antes da publicação.`, nodeId: node.id });
      }
    }
    for (const port of spec.ports.filter((item) => item.direction === "output" && item.id !== "default")) {
      if (!definition.edges.some((edge) => edge.source === node.id && edge.sourceHandle === port.id)) {
        issues.push({ code: "dangling_branch", message: `${spec.label} precisa conectar a saída “${port.label}”.`, nodeId: node.id });
      }
    }
  }

  for (const edge of definition.edges) {
    const source = definition.nodes.find((node) => node.id === edge.source);
    const target = definition.nodes.find((node) => node.id === edge.target);
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target) || edge.source === edge.target) {
      issues.push({ code: "invalid_edge", message: "Uma conexão precisa ligar dois nós diferentes do fluxo.", edgeId: edge.id });
      continue;
    }
    const sourcePort = source && getWorkflowNodeDefinition(source.kind)?.ports.find((port) => port.direction === "output" && port.id === (edge.sourceHandle ?? "default"));
    const targetPort = target && getWorkflowNodeDefinition(target.kind)?.ports.find((port) => port.direction === "input" && port.id === (edge.targetHandle ?? "default"));
    if (!sourcePort || !targetPort || (targetPort.dataType !== "workflow-context" && sourcePort.dataType !== targetPort.dataType)) {
      issues.push({ code: "invalid_connection", message: "Esta conexão não usa portas compatíveis do workflow.", edgeId: edge.id });
    }
  }

  const adjacency = new Map(definition.nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of definition.edges) adjacency.get(edge.source)?.push(edge.target);
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) { issues.push({ code: "cycle", message: "Fluxos publicados não podem ter ciclos sem um controle explícito de espera.", nodeId: id }); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const target of adjacency.get(id) ?? []) visit(target);
    visiting.delete(id);
    visited.add(id);
  };
  for (const trigger of triggers) visit(trigger.id);
  for (const node of definition.nodes) if (!visited.has(node.id)) issues.push({ code: "unreachable_node", message: "Este nó não pode ser alcançado a partir do gatilho.", nodeId: node.id });
  return issues;
}
