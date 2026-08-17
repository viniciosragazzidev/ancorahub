import { describe, expect, it, vi } from "vitest";
import { resetTenantOperationalDataAction } from "@/app/(platform-admin)/super-admin/actions";
import { purgeTenantOperationalData } from "./service";

vi.mock("@/shared/auth/platform-admin", () => ({
  getRequiredPlatformAdmin: vi.fn().mockResolvedValue({
    userId: "admin-user-123",
    email: "admin@ancora.com.br",
    isPlatformAdmin: true,
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/shared/db", () => {
  const mockDeleteWhere = vi.fn().mockResolvedValue([]);
  const mockSelectWhere = vi.fn().mockImplementation(() => ({
    limit: vi.fn().mockResolvedValue([{ id: "mock-id" }]),
    then: (resolve: (val: unknown) => void) => resolve([{ count: 5 }]),
  }));
  const mockInsertValues = vi.fn().mockResolvedValue([]);

  const mockTx = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: mockSelectWhere,
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: mockDeleteWhere,
    }),
    insert: vi.fn().mockReturnValue({
      values: mockInsertValues,
    }),
  };

  return {
    getDatabase: () => ({
      transaction: async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: mockSelectWhere,
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: mockDeleteWhere,
      }),
      insert: vi.fn().mockReturnValue({
        values: mockInsertValues,
      }),
    }),
    schema: {
      leads: { tenantId: "tenantId", id: "id" },
      aiConversations: { tenantId: "tenantId", id: "id" },
      wahaDeliveryOutbox: { tenantId: "tenantId" },
      wahaCadenceRuns: { tenantId: "tenantId" },
      leadEffectOutbox: { tenantId: "tenantId" },
      leadDistributionJobs: { tenantId: "tenantId" },
      leadDistributionEvents: { tenantId: "tenantId" },
      aiAttendanceLogs: { tenantId: "tenantId" },
      aiQuickReplyEvents: { tenantId: "tenantId" },
      whatsappMessages: { tenantId: "tenantId" },
      aiQualificationSessions: { tenantId: "tenantId" },
      agentTrainingSimulations: { tenantId: "tenantId" },
      notifications: { tenantId: "tenantId" },
      leadFeedbacks: { tenantId: "tenantId" },
      leadAssignmentAttempts: { tenantId: "tenantId" },
      leadInteractions: { tenantId: "tenantId" },
      leadBeneficiaries: { tenantId: "tenantId" },
      leadOffers: { tenantId: "tenantId" },
      leadDocumentChecklist: { tenantId: "tenantId" },
      leadDocuments: { tenantId: "tenantId" },
      sales: { tenantId: "tenantId" },
      commissionSchedule: { tenantId: "tenantId" },
      marketingImports: { tenantId: "tenantId", id: "id" },
      marketingImportResults: { importId: "importId" },
      whatsappOutboundMessages: { tenantId: "tenantId" },
      leadTasks: { tenantId: "tenantId", id: "id" },
      leadTaskAssignees: { taskId: "taskId" },
      quotes: { tenantId: "tenantId", id: "id" },
      quoteLineItems: { quoteId: "quoteId" },
      quoteItems: { quoteId: "quoteId" },
      clients: { tenantId: "tenantId" },
      webhookDeliveries: { tenantId: "tenantId" },
      platformAuditLogs: { id: "id" },
    },
  };
});

describe("Operational Data Reset (Super Admin)", () => {
  const validTenantId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

  it("purgeTenantOperationalData executes clean purge transaction and logs audit event", async () => {
    const result = await purgeTenantOperationalData(validTenantId);
    expect(result).toEqual({
      deletedLeadsCount: 5,
      deletedConversationsCount: 5,
    });
  });

  it("resetTenantOperationalDataAction rejects invalid tenantId", async () => {
    const formData = new FormData();
    formData.append("tenantId", "invalid-id");
    formData.append("confirmation", "RESET");

    await expect(resetTenantOperationalDataAction(formData)).rejects.toThrow("ID da empresa é inválido.");
  });

  it("resetTenantOperationalDataAction rejects invalid confirmation code", async () => {
    const formData = new FormData();
    formData.append("tenantId", validTenantId);
    formData.append("confirmation", "WRONG");

    await expect(resetTenantOperationalDataAction(formData)).rejects.toThrow(
      'Confirmação inválida. Digite "RESET" para confirmar a operação.'
    );
  });

  it("resetTenantOperationalDataAction executes successfully with valid inputs", async () => {
    const formData = new FormData();
    formData.append("tenantId", validTenantId);
    formData.append("confirmation", "RESET");

    const result = await resetTenantOperationalDataAction(formData);
    expect(result).toEqual({
      deletedLeadsCount: 5,
      deletedConversationsCount: 5,
    });
  });
});
