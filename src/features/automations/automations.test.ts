import { describe, expect, it, vi, beforeEach } from "vitest";

const { getRequiredTenantContext } = vi.hoisted(() => ({
  getRequiredTenantContext: vi.fn(),
}));

vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockDb = {
  insert: vi.fn(() => ({
    values: vi.fn().mockResolvedValue({}),
  })),
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue([]),
      })),
    })),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn().mockResolvedValue({}),
    })),
  })),
  delete: vi.fn(() => ({
    where: vi.fn().mockResolvedValue({}),
  })),
};

vi.mock("@/shared/db", () => ({
  getDatabase: () => mockDb,
  schema: {
    crmAutomations: { id: "id", tenantId: "tenantId", status: "status" },
    crmAutomationLogs: { id: "id", tenantId: "tenantId", status: "status" },
    whatsappFlows: { id: "id", tenantId: "tenantId" },
    auditLogs: { id: "id" },
    aiQualificationConfigs: { id: "id", tenantId: "tenantId" },
  },
}));

import {
  createAutomationAction,
} from "./actions";

describe("CRM Automations actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthorized non-director role", async () => {
    getRequiredTenantContext.mockResolvedValue({
      userId: "user-1",
      tenantId: "tenant-1",
      role: "broker",
    });

    const result = await createAutomationAction({
      name: "Teste",
      triggerType: "lead_parado",
      templateBody: "Olá {{nome}}",
      configuration: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Apenas diretores");
  });

  it("creates automation successfully when role is director", async () => {
    getRequiredTenantContext.mockResolvedValue({
      userId: "user-1",
      tenantId: "tenant-1",
      role: "director",
    });

    const result = await createAutomationAction({
      name: "Teste Diretor",
      triggerType: "lead_parado",
      templateBody: "Olá {{nome}}",
      configuration: {},
    });

    expect(result.success).toBe(true);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("rejects invalid inputs on creation", async () => {
    getRequiredTenantContext.mockResolvedValue({
      userId: "user-1",
      tenantId: "tenant-1",
      role: "director",
    });

    const result = await createAutomationAction({
      name: "",
      triggerType: "",
      templateBody: "",
      configuration: {},
    });

    expect(result.success).toBe(false);
  });
});
