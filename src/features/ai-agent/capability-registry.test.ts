import { describe, expect, it } from "vitest";
import { AGENT_CAPABILITIES } from "./capability-registry";
import {
  runCapabilityGuardPipeline,
  runTenantGuard,
  runHumanTakeoverGuard,
  runOptOutGuard,
  runRequiredFactsGuard,
  type GuardContext,
} from "./capability-guards";
import { buildTriggerIdempotencyKey } from "./capability-execution-engine";

describe("Agent Capability Registry & Guards Engine", () => {
  it("contains all core capabilities with risk levels and repeat policies", () => {
    expect(AGENT_CAPABILITIES.length).toBeGreaterThanOrEqual(10);
    const collectCity = AGENT_CAPABILITIES.find((c) => c.key === "COLLECT_CITY");
    expect(collectCity).toBeDefined();
    expect(collectCity?.repeatPolicy).toBe("UNTIL_VALID");
    expect(collectCity?.riskLevel).toBe("LOW");

    const optOut = AGENT_CAPABILITIES.find((c) => c.key === "MARK_OPT_OUT");
    expect(optOut).toBeDefined();
    expect(optOut?.riskLevel).toBe("HIGH");
    expect(optOut?.repeatPolicy).toBe("ONCE");
  });

  it("TenantGuard blocks cross-tenant execution", () => {
    const context: GuardContext = {
      tenantId: "tenant_a",
      resourceTenantId: "tenant_b",
    };
    const res = runTenantGuard(context);
    expect(res.allowed).toBe(false);
    expect(res.denialCode).toBe("CROSS_TENANT_ACCESS_DENIED");
  });

  it("HumanTakeoverGuard blocks AI capability when human is active", () => {
    const cap = AGENT_CAPABILITIES.find((c) => c.key === "COLLECT_CITY")!;
    const context: GuardContext = {
      tenantId: "t1",
      resourceTenantId: "t1",
      conversationOwner: "HUMAN",
    };
    const res = runHumanTakeoverGuard(cap, context);
    expect(res.allowed).toBe(false);
    expect(res.denialCode).toBe("HUMAN_OWNS_CONVERSATION");
  });

  it("OptOutGuard blocks outbound communications for opted-out contacts", () => {
    const cap = AGENT_CAPABILITIES.find((c) => c.key === "COLLECT_CITY")!;
    const context: GuardContext = {
      tenantId: "t1",
      resourceTenantId: "t1",
      contactOptedOut: true,
    };
    const res = runOptOutGuard(cap, context);
    expect(res.allowed).toBe(false);
    expect(res.denialCode).toBe("OPTED_OUT_CONTACT");
  });

  it("RequiredFactsGuard enforces missing facts before completing qualification", () => {
    const cap = AGENT_CAPABILITIES.find((c) => c.key === "COMPLETE_QUALIFICATION")!;
    const context: GuardContext = {
      tenantId: "t1",
      resourceTenantId: "t1",
      knownFacts: { name: "Beatriz" }, // Missing city and planType
    };
    const res = runRequiredFactsGuard(cap, context);
    expect(res.allowed).toBe(false);
    expect(res.denialCode).toBe("MISSING_REQUIRED_FACTS");
  });

  it("RequiredFactsGuard passes when all required facts are present", () => {
    const cap = AGENT_CAPABILITIES.find((c) => c.key === "COMPLETE_QUALIFICATION")!;
    const context: GuardContext = {
      tenantId: "t1",
      resourceTenantId: "t1",
      knownFacts: { name: "Beatriz", city: "Rio de Janeiro", planType: "PME" },
    };
    const res = runRequiredFactsGuard(cap, context);
    expect(res.allowed).toBe(true);
  });

  it("buildTriggerIdempotencyKey constructs deterministic keys", () => {
    const key1 = buildTriggerIdempotencyKey({
      scope: "QUALIFICATION_SESSION",
      entityId: "lead_123",
      capabilityKey: "COMPLETE_QUALIFICATION",
      sessionId: "sess_abc",
    });
    expect(key1).toBe("session:sess_abc:complete_qualification");

    const key2 = buildTriggerIdempotencyKey({
      scope: "CONTACT",
      entityId: "contact_456",
      capabilityKey: "MARK_OPT_OUT",
    });
    expect(key2).toBe("contact:contact_456:mark_opt_out");
  });
});
