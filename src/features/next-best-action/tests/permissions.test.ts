import { describe, it, expect } from "vitest";
import { filterActionsByPermissions } from "../permissions";
import type { NextBestAction } from "../types";

describe("Next Best Action Permissions Filtering", () => {
  const sampleActions: NextBestAction[] = [
    {
      key: "action-broker",
      title: "Ver Lead",
      priority: "high",
      actionType: "navigate",
      label: "Ver",
      reason: "Reason",
      ruleId: "rule-1",
      entityType: "lead",
      permission: "acessar_leads",
    },
    {
      key: "action-director",
      title: "Ver Filiais",
      priority: "high",
      actionType: "navigate",
      label: "Gerenciar",
      reason: "Reason",
      ruleId: "rule-2",
      entityType: "system",
      permission: "gerenciar_filiais",
    },
  ];

  it("allows broker to see broker actions but filters out director actions", () => {
    const filtered = filterActionsByPermissions(sampleActions, "broker");
    expect(filtered.length).toBe(1);
    expect(filtered[0].key).toBe("action-broker");
  });

  it("allows director to see all actions", () => {
    const filtered = filterActionsByPermissions(sampleActions, "director");
    expect(filtered.length).toBe(2);
  });
});
