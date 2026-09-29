import { describe, expect, it } from "vitest";

import {
  buildBulkImportDistributionState,
  getBulkImportDistributionReadiness,
  getBulkImportQueuesForBranch,
  isAutomaticQueueAvailableForBulkImport,
  shouldQualifyBulkImportLead,
} from "./bulk-import-policy";

describe("bulk import distribution policy", () => {
  const queues = [
    { id: "general", name: "Fila comercial", branchId: null, assignmentMode: "automatic" },
    { id: "selected", name: "Fila Centro", branchId: "branch-a", assignmentMode: "automatic" },
    { id: "other", name: "Fila Norte", branchId: "branch-b", assignmentMode: "automatic" },
    { id: "manual", name: "Triagem manual", branchId: "branch-a", assignmentMode: "manual" },
  ];

  it("shows tenant-wide and selected-unit queues without leaking queues from another unit", () => {
    expect(getBulkImportQueuesForBranch(queues, "branch-a").map((queue) => queue.id)).toEqual([
      "general",
      "selected",
      "manual",
    ]);
  });

  it("only treats automatic tenant-wide or same-unit queues as distributable", () => {
    expect(isAutomaticQueueAvailableForBulkImport(queues[0], "branch-a")).toBe(true);
    expect(isAutomaticQueueAvailableForBulkImport(queues[1], "branch-a")).toBe(true);
    expect(isAutomaticQueueAvailableForBulkImport(queues[2], "branch-a")).toBe(false);
    expect(isAutomaticQueueAvailableForBulkImport(queues[3], "branch-a")).toBe(false);
  });

  it("persists a CSV lead queued before the canonical motor assigns its provisional owner", () => {
    expect(buildBulkImportDistributionState()).toEqual({
      corretorId: null,
      status: "new",
      distributionStatus: "queued",
      assignmentSource: null,
      assignmentStrategy: null,
      assignedAt: null,
      qualificationStatus: "qualified",
      qualificationState: "COMPLETED",
    });
  });

  it("bypasses IA when the selected queue has qualification disabled", () => {
    expect(shouldQualifyBulkImportLead({
      qualificationEngineEnabled: true,
      queueAiQualificationEnabled: false,
    })).toBe(false);
  });

  it("uses the global qualification decision when no queue override exists", () => {
    expect(shouldQualifyBulkImportLead({
      qualificationEngineEnabled: true,
      queueAiQualificationEnabled: null,
    })).toBe(true);
  });

  it("activates automatic distribution before importing into an operational unit", () => {
    expect(getBulkImportDistributionReadiness({
      acceptingLeads: true,
      autoDistribute: false,
      isDistributionHub: false,
    })).toEqual({ allowed: true, activateAutoDistribution: true });
  });

  it("blocks imports that would leave leads parked in a paused unit", () => {
    expect(getBulkImportDistributionReadiness({
      acceptingLeads: false,
      autoDistribute: false,
      isDistributionHub: false,
    })).toEqual({
      allowed: false,
      activateAutoDistribution: false,
      reason: "A unidade está com o recebimento de leads pausado.",
    });
  });

  it("does not activate the manual redistribution hub", () => {
    expect(getBulkImportDistributionReadiness({
      acceptingLeads: true,
      autoDistribute: false,
      isDistributionHub: true,
    })).toEqual({
      allowed: false,
      activateAutoDistribution: false,
      reason: "A Central de redistribuição não recebe distribuição automática.",
    });
  });
});
