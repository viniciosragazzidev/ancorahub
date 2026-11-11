import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requirePilot: vi.fn(), loadPilotIndex: vi.fn(), loadPlanShard: vi.fn(), auditPilot: vi.fn(), upload: vi.fn() }));
vi.mock("./server", () => mocks);
vi.mock("@/shared/storage/r2-storage", () => ({ uploadR2Object: mocks.upload }));
import { getCatalogPlanAction, getCatalogNetworkAction, simulateCatalogAction } from "./actions";
import { exportCatalogProposalAction } from "./proposal-action";

beforeEach(() => { vi.clearAllMocks(); mocks.requirePilot.mockRejectedValue(new Error("denied")); });
describe("server entry points fail closed", () => {
  it("denies direct simulation, details and network before loading private objects", async () => {
    expect((await simulateCatalogAction({})).error).toBeTruthy();
    expect((await getCatalogPlanAction("004b3e1a-349c-4ee3-8fec-fd9d90de646c")).error).toBeTruthy();
    expect((await getCatalogNetworkAction({ id: "004b3e1a-349c-4ee3-8fec-fd9d90de646c" })).error).toBeTruthy();
    expect(mocks.loadPilotIndex).not.toHaveBeenCalled(); expect(mocks.loadPlanShard).not.toHaveBeenCalled();
  });
  it("denies forged proposal requests without creating or exporting anything", async () => {
    expect((await exportCatalogProposalAction({ monthlyPrice: 1, tenantId: "another" })).error).toBeTruthy();
    expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.loadPilotIndex).not.toHaveBeenCalled();
  });
  it("blocks pending products on the server even if the browser sends a fake ready state", async () => {
    const id = "004b3e1a-349c-4ee3-8fec-fd9d90de646c";
    mocks.requirePilot.mockResolvedValue({ context: { userId: "u", tenantId: "t" }, config: { release: "r", reviewedPlanIds: [], hiddenPlanIds: [] } });
    mocks.loadPilotIndex.mockResolvedValue({ plans: [{ id, name: "Pending", modality: "PESSOA_FISICA", cities: ["Rio de Janeiro"], businessProfiles: [], minLives: 1, maxLives: null, minAge: 0, maxAge: null, holderMin: 0, holderMax: null, minHolders: 1, ageConfirmed: true, eligibilityConfirmed: true, from: null, to: null, prices: [{ id: "p", min: 0, max: null, cents: 30193, active: true, priority: 0, from: null, to: null }] }] });
    const result = await exportCatalogProposalAction({ planId: id, state: "ready", totalCents: 1, profile: { modality: "PESSOA_FISICA", city: "Rio de Janeiro", lives: [{ age: 39, holder: true }] } });
    expect(result.error).toContain("bloqueada"); expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.loadPlanShard).not.toHaveBeenCalled(); expect(mocks.auditPilot).toHaveBeenCalledWith("u", "t", "quote_catalog.proposal_blocked", expect.any(Object));
  });
  it("prevents exporting while viewing another user", async () => {
    mocks.requirePilot.mockResolvedValue({ context: { viewAs: { adminUserId: "admin" } }, config: {} });
    expect((await exportCatalogProposalAction({})).error).toContain("somente leitura"); expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("recalculates an approved PDF from server prices and stores its immutable snapshot", async () => {
    const id = "004b3e1a-349c-4ee3-8fec-fd9d90de646c";
    mocks.requirePilot.mockResolvedValue({ context: { userId: "u", tenantId: "t" }, config: { release: "r", indexHash: "hash", reviewedPlanIds: [id], hiddenPlanIds: [] } });
    mocks.loadPilotIndex.mockResolvedValue({ plans: [{ id, name: "Revisado", operator: "Operadora", accommodation: "Apartamento", coparticipation: "Sem", coverage: "Nacional", modality: "PESSOA_FISICA", cities: ["Rio de Janeiro"], businessProfiles: [], minLives: 1, maxLives: null, minAge: 0, maxAge: null, holderMin: 0, holderMax: null, minHolders: 1, ageConfirmed: true, eligibilityConfirmed: true, from: null, to: null, prices: [{ id: "p", min: 0, max: null, cents: 30193, active: true, priority: 0, from: null, to: null }] }] });
    mocks.loadPlanShard.mockResolvedValue({ plan: {}, details: [] });
    const result = await exportCatalogProposalAction({ planId: id, totalCents: 1, monthlyPrice: 0.01, profile: { modality: "PESSOA_FISICA", city: "Rio de Janeiro", lives: [{ age: 39, holder: true }], tenantId: "forged" } });
    expect(result.error).toBeUndefined(); expect(result.data?.base64).toBeTruthy();
    const snapshot = JSON.parse(mocks.upload.mock.calls[0][1].toString());
    expect(snapshot.plan.totalCents).toBe(30193); expect(snapshot.profile.tenantId).toBeUndefined();
    expect(mocks.upload.mock.calls[0][0]).toMatch(/^quote-catalog-proposals\/t\/u\//);
    expect(mocks.auditPilot).toHaveBeenCalledWith("u", "t", "quote_catalog.proposal_exported", expect.objectContaining({ totalCents: 30193 }));
  });
});
