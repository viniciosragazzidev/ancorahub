import { describe, expect, it } from "vitest";
import { getMcpToolsForRole, ALL_MCP_TOOLS } from "./mcp-tools";
import { ROLE_SHORTCUTS_MAP } from "./prompt-builder";

describe("Agent Drawer MCP Tools & Role Context", () => {
  it("filters MCP tools correctly based on user role permissions", () => {
    const brokerTools = getMcpToolsForRole("broker");
    const supervisorTools = getMcpToolsForRole("supervisor");
    const directorTools = getMcpToolsForRole("director");

    expect(brokerTools.some((t) => t.name === "get_my_lead_queue")).toBe(true);
    expect(brokerTools.some((t) => t.name === "get_tenant_funnel_metrics")).toBe(false);

    expect(supervisorTools.some((t) => t.name === "get_branch_queue_summary")).toBe(true);
    expect(supervisorTools.some((t) => t.name === "execute_lead_reassignment")).toBe(true);

    expect(directorTools.some((t) => t.name === "get_tenant_funnel_metrics")).toBe(true);
    expect(directorTools.some((t) => t.name === "get_ai_system_health")).toBe(true);
  });

  it("provides specific shortcuts for each operational role (broker, supervisor, manager, director)", () => {
    const roles = ["broker", "supervisor", "manager", "director"] as const;

    for (const role of roles) {
      const shortcuts = ROLE_SHORTCUTS_MAP[role];
      expect(shortcuts).toBeDefined();
      expect(shortcuts.length).toBe(3);
      expect(shortcuts[0].key).toBe("Ctrl 1");
      expect(shortcuts[1].key).toBe("Ctrl 2");
      expect(shortcuts[2].key).toBe("Ctrl 3");
    }
  });
});
