import { describe, expect, it } from "vitest";
import { autoLayoutWorkflow, canConnectWorkflowNodes, connectWorkflowNodes, removeWorkflowNode } from "./editor-state";

const definition = { schemaVersion: 1 as const, nodes: [
  { id: "trigger", kind: "trigger.manual" as const, position: { x: 0, y: 0 }, config: {} },
  { id: "task", kind: "crm.create_task" as const, position: { x: 0, y: 0 }, config: { title: "Retornar" } },
], edges: [] };

describe("workflow editor state", () => {
  it("connects only compatible ports and preserves one outgoing trigger connection", () => {
    expect(canConnectWorkflowNodes(definition, "trigger", "task")).toBe(true);
    const connected = connectWorkflowNodes(definition, "trigger", "task");
    expect(connected.edges).toHaveLength(1);
    expect(canConnectWorkflowNodes(connected, "trigger", "task")).toBe(false);
  });

  it("rejects an output whose data type cannot feed the target input", () => {
    const withAi = { ...definition, nodes: [...definition.nodes, { id: "ai", kind: "ai.classify_lead" as const, position: { x: 0, y: 0 }, config: { prompt: "Classificar" } }] };
    expect(canConnectWorkflowNodes(withAi, "task", "ai")).toBe(false);
  });

  it("removes attached connections and produces a deterministic layout", () => {
    const connected = connectWorkflowNodes(definition, "trigger", "task");
    expect(removeWorkflowNode(connected, "task").edges).toEqual([]);
    expect(autoLayoutWorkflow(connected).nodes.map((node) => node.position.y)).toEqual([120, 310]);
  });
});
