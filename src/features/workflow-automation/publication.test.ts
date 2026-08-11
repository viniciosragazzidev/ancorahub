import { describe, expect, it } from "vitest";
import { assessWorkflowPublication } from "./publication";

const safeDefinition = {
  schemaVersion: 1 as const,
  nodes: [
    { id: "trigger", kind: "trigger.manual" as const, position: { x: 0, y: 0 }, config: {} },
    { id: "task", kind: "crm.create_task" as const, position: { x: 200, y: 0 }, config: { title: "Retornar" } },
  ],
  edges: [{ id: "edge", source: "trigger", target: "task" }],
};

describe("workflow publication policy", () => {
  it("requires the platform switch even for a valid safe workflow", () => {
    const result = assessWorkflowPublication(safeDefinition, false);
    expect(result.allowed).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "feature_disabled" }),
    ]));
  });

  it("allows only a valid safe workflow after platform activation", () => {
    expect(assessWorkflowPublication(safeDefinition, true)).toEqual({ allowed: true, issues: [] });
  });
});
