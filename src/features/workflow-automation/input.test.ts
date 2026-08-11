import { describe, expect, it } from "vitest";
import { workflowDraftInputSchema } from "./input";

describe("workflow draft input", () => {
  it("accepts an editable safe draft", () => {
    expect(workflowDraftInputSchema.safeParse({
      name: "Retorno inicial",
      description: "Cria uma tarefa para retorno.",
      definition: { schemaVersion: 1, nodes: [{ id: "start", kind: "trigger.lead_created", position: { x: 0, y: 0 }, config: {} }], edges: [] },
    }).success).toBe(true);
  });

  it("rejects invalid graph input before persistence", () => {
    expect(workflowDraftInputSchema.safeParse({ name: "x", definition: { schemaVersion: 1, nodes: [], edges: [] } }).success).toBe(false);
  });
});
