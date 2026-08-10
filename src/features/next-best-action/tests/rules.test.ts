import { describe, it, expect } from "vitest";
import { evaluateLeadRules, evaluateDashboardRules } from "../rules";
import type { LeadActionContext } from "../types";

describe("Next Best Action Rules", () => {
  it("recommends critical SLA action when SLA is near breach or breached", () => {
    const ctx: LeadActionContext = {
      id: "lead-1",
      name: "João Silva",
      status: "in_contact",
      hasSlaBreach: true,
    };
    const action = evaluateLeadRules(ctx);
    expect(action).not.toBeNull();
    expect(action?.priority).toBe("critical");
    expect(action?.ruleId).toBe("lead_critical_sla");
  });

  it("recommends first contact when lead is new", () => {
    const ctx: LeadActionContext = {
      id: "lead-2",
      name: "Maria Santos",
      status: "new",
      firstContactCompleted: false,
    };
    const action = evaluateLeadRules(ctx);
    expect(action).not.toBeNull();
    expect(action?.ruleId).toBe("lead_no_first_contact");
    expect(action?.priority).toBe("high");
  });

  it("recommends creating quote when qualification is completed without quote", () => {
    const ctx: LeadActionContext = {
      id: "lead-3",
      name: "Pedro Souza",
      status: "in_contact",
      qualificationStatus: "completed",
      hasActiveQuote: false,
      firstContactCompleted: true,
    };
    const action = evaluateLeadRules(ctx);
    expect(action).not.toBeNull();
    expect(action?.ruleId).toBe("qualification_completed_no_quote");
    expect(action?.label).toBe("Criar Cotação");
  });

  it("recommends sending quote when quote exists but is not sent", () => {
    const ctx: LeadActionContext = {
      id: "lead-4",
      name: "Ana Lima",
      status: "quote_sent",
      hasActiveQuote: true,
      hasSentQuote: false,
      firstContactCompleted: true,
    };
    const action = evaluateLeadRules(ctx);
    expect(action).not.toBeNull();
    expect(action?.ruleId).toBe("quote_generated_not_sent");
  });

  it("recommends requesting documents when status is documentation_pending", () => {
    const ctx: LeadActionContext = {
      id: "lead-5",
      name: "Carlos Ferreira",
      status: "documentation_pending",
      hasActiveQuote: true,
      hasSentQuote: true,
      documentsPendingCount: 2,
      firstContactCompleted: true,
    };
    const action = evaluateLeadRules(ctx);
    expect(action).not.toBeNull();
    expect(action?.ruleId).toBe("documents_pending_request");
  });

  it("evaluates dashboard rules for manager unattended leads", () => {
    const actions = evaluateDashboardRules({
      role: "manager",
      unattendedLeadsCount: 5,
    });
    expect(actions.length).toBeGreaterThan(0);
    expect(actions[0].ruleId).toBe("team_unattended_leads");
  });
});
