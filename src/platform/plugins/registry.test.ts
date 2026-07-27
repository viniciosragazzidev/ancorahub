import { describe, expect, it } from "vitest";

import { createPluginRegistry } from "./registry";
import type { PluginDefinition } from "./types";

const plugin: PluginDefinition = {
  manifest: {
    id: "lead.context",
    name: "Lead contextual",
    category: "lead",
    icon: "user",
    requiredPermissions: ["acessar_leads"],
    featureFlag: "plugin.lead.context",
    minSize: { width: 280, height: 240 },
    preferredSize: { width: 360, height: 520 },
    allowedHosts: ["workspace", "drawer"],
    eventsPublished: ["lead.status_changed"],
    eventsConsumed: ["lead.converted"],
  },
  isReady: true,
  isAllowed: () => true,
};

const context = { tenantId: "tenant-a", userId: "user-a", role: "broker" as const, jobTitle: null as string | null, branchId: "branch-a" };

describe("plugin registry", () => {
  it("registers and filters a plugin by host, permission and feature flag", () => {
    const registry = createPluginRegistry([plugin]);
    expect(registry.available(context, "workspace", { enabledFlags: new Set(["plugin.lead.context"]) })).toHaveLength(1);
    expect(registry.available(context, "page", { enabledFlags: new Set(["plugin.lead.context"]) })).toHaveLength(0);
    expect(registry.available(context, "workspace", { enabledFlags: new Set() })).toHaveLength(0);
  });

  it("rejects duplicate plugin ids", () => {
    const registry = createPluginRegistry([plugin]);
    expect(() => registry.register(plugin)).toThrow(/already registered/);
  });
});
