import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocks configuration before imports
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
};

vi.mock("@/shared/db", () => ({
  getDatabase: () => mockDb,
  schema: {
    proposals: {
      id: "proposals.id",
      tenantId: "proposals.tenant_id",
      leadId: "proposals.lead_id",
      status: "proposals.status",
      validUntil: "proposals.valid_until",
      convertedSaleId: "proposals.converted_sale_id",
    },
    leads: {
      id: "leads.id",
      tenantId: "leads.tenant_id",
    },
    sales: {
      id: "sales.id",
    },
    platformAuditLogs: {
      id: "platform_audit_logs.id",
    },
  },
}));

const mockContext = {
  tenantId: "tenant-a",
  userId: "user-1",
  role: "broker",
};

vi.mock("@/shared/auth/tenant-context", () => ({
  getRequiredTenantContext: () => Promise.resolve(mockContext),
}));

vi.mock("@/features/system-settings/queries", () => ({
  getSystemSetting: () => Promise.resolve("true"),
}));

vi.mock("@/features/commissions/commission-rules-service", () => ({
  generateCommissionSchedule: () => Promise.resolve([]),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { convertProposalToSaleAction, updateProposalStatusAction } from "./actions";

describe("Proposals feature and business rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("convertProposalToSaleAction validation and idempotency", () => {
    it("should return success and the existing saleId if the proposal is already converted (idempotency)", async () => {
      // Mock db select for proposal
      mockDb.select.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => [
              {
                id: "prop-1",
                tenantId: "tenant-a",
                createdBy: "user-1",
                status: "aprovada",
                convertedSaleId: "sale-existing-123",
                validUntil: new Date(Date.now() + 100000),
              },
            ],
          }),
        }),
      });

      const res = await convertProposalToSaleAction("prop-1", {
        policyNumber: "POL123",
        coverageStartDate: "2026-08-10",
        paymentMethod: "boleto",
        renewalType: "reajuste_operadora",
        renewalContactPreference: "whatsapp",
      });

      expect(res.success).toBe(true);
      expect(res.saleId).toBe("sale-existing-123");
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("should fail if the proposal status is not 'aprovada'", async () => {
      mockDb.select.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => [
              {
                id: "prop-2",
                tenantId: "tenant-a",
                createdBy: "user-1",
                status: "negociacao",
                convertedSaleId: null,
                validUntil: new Date(Date.now() + 100000),
              },
            ],
          }),
        }),
      });

      const res = await convertProposalToSaleAction("prop-2", {
        policyNumber: "POL123",
        coverageStartDate: "2026-08-10",
        paymentMethod: "boleto",
        renewalType: "reajuste_operadora",
        renewalContactPreference: "whatsapp",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Apenas propostas com status 'aprovada' podem ser convertidas");
    });

    it("should fail if the proposal is expired (validity test)", async () => {
      mockDb.select.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => [
              {
                id: "prop-3",
                tenantId: "tenant-a",
                createdBy: "user-1",
                status: "aprovada",
                convertedSaleId: null,
                validUntil: new Date(Date.now() - 100000), // in the past
              },
            ],
          }),
        }),
      });

      const res = await convertProposalToSaleAction("prop-3", {
        policyNumber: "POL123",
        coverageStartDate: "2026-08-10",
        paymentMethod: "boleto",
        renewalType: "reajuste_operadora",
        renewalContactPreference: "whatsapp",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Esta proposta expirou");
    });
  });

  describe("updateProposalStatusAction tenant isolation and scope", () => {
    it("should deny access if the broker is not the owner of the proposal", async () => {
      mockDb.select.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => [
              {
                id: "prop-4",
                tenantId: "tenant-a",
                createdBy: "another-user", // owner is different
                status: "rascunho",
              },
            ],
          }),
        }),
      });

      const res = await updateProposalStatusAction("prop-4", "enviada");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Acesso negado");
    });

    it("should update status and trigger audit log if the broker is the creator", async () => {
      mockDb.select.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => [
              {
                id: "prop-5",
                tenantId: "tenant-a",
                createdBy: "user-1", // owner matches mockContext
                status: "rascunho",
              },
            ],
          }),
        }),
      });

      mockDb.transaction.mockImplementation(async (cb) => {
        return cb(mockDb);
      });

      mockDb.update.mockReturnValue({
        set: () => ({
          where: () => Promise.resolve(),
        }),
      });

      mockDb.insert.mockReturnValue({
        values: () => Promise.resolve(),
      });

      const res = await updateProposalStatusAction("prop-5", "enviada");
      expect(res.success).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();
    });
  });
});
