import { describe, expect, it } from "vitest";
import { validateWorkflowDefinition } from "./validation";

describe("workflow definition validation", () => {
  it("accepts a reachable safe CRM workflow", () => {
    expect(validateWorkflowDefinition({ schemaVersion: 1, nodes: [
      { id: "trigger", kind: "trigger.lead_created", position: { x: 0, y: 0 }, config: {} },
      { id: "task", kind: "crm.create_task", position: { x: 200, y: 0 }, config: { title: "Retornar" } },
    ], edges: [{ id: "edge", source: "trigger", target: "task" }] })).toEqual([]);
  });

  it("blocks unreachable and protected nodes before publication", () => {
    const issues = validateWorkflowDefinition({ schemaVersion: 1, nodes: [
      { id: "trigger", kind: "trigger.manual", position: { x: 0, y: 0 }, config: {} },
      { id: "send", kind: "channel.whatsapp_send", position: { x: 200, y: 0 }, config: {} },
    ], edges: [] });
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["unreachable_node", "protected_action"]));
  });
});
