import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TenantContext } from "@/shared/auth/types";

const state = vi.hoisted(() => ({ enabled: true, calls: [] as string[], slow: false, fail: false }));

vi.mock("./flag", () => ({ isLiveStatusEnabled: async () => state.enabled }));
vi.mock("./loaders", () => {
  const make = (id: string) => async () => {
    state.calls.push(id);
    if (state.fail) throw new Error("db down");
    if (state.slow) await new Promise((resolve) => setTimeout(resolve, 10_000));
    return { id, label: id, value: 1, emptyText: "", severity: "info", explanation: ".", generatedAt: "2026-10-27T13:00:00.000Z" };
  };
  return {
    loadColdLeads: make("frios"),
    loadColdRecoveries: make("frios-recuperados"),
    loadAiQualification: make("qualificacao-ia"),
    loadWaitingBroker: make("aguardando-corretor"),
    loadOffers: make("ofertas"),
    loadFirstContact: make("primeiro-contato"),
    loadDuty: make("plantao"),
    loadWhatsAppQueue: make("whatsapp-fila"),
    loadDistributionEngineSeal: async () => ({ id: "motor-distribuicao", label: "Motor", severity: "ok", lastRunAt: null, nextRunAt: null, generatedAt: "2026-10-27T13:00:00.000Z" }),
  };
});

import { getLiveStatuses } from "./service";

let tenantSeq = 0;
const context = (overrides: Partial<TenantContext> = {}): TenantContext => ({ userId: "u1", tenantId: `t${(tenantSeq += 1)}`, role: "director", jobTitle: "director", branchId: null, ...overrides });

beforeEach(() => {
  state.enabled = true;
  state.calls = [];
  state.slow = false;
  state.fail = false;
});
afterEach(() => vi.useRealTimers());

describe("getLiveStatuses", () => {
  it("chave desligada: nada é consultado e a tela fica como hoje", async () => {
    state.enabled = false;
    expect(await getLiveStatuses(context())).toBeNull();
    expect(state.calls).toHaveLength(0);
  });

  it("diretor: os 8 status na ordem e o selo", async () => {
    const payload = await getLiveStatuses(context());
    expect(payload?.statuses.map((status) => status.id)).toEqual(["frios", "frios-recuperados", "qualificacao-ia", "aguardando-corretor", "ofertas", "primeiro-contato", "plantao", "whatsapp-fila"]);
    expect(payload?.seals).toHaveLength(1);
  });

  it("corretor: só os dele, sem selo, e nenhuma consulta dos outros", async () => {
    const payload = await getLiveStatuses(context({ role: "broker", jobTitle: "broker" }));
    expect(payload?.statuses.map((status) => status.id)).toEqual(["ofertas", "primeiro-contato", "plantao"]);
    expect(payload?.seals).toEqual([]);
    expect(state.calls.sort()).toEqual(["ofertas", "plantao", "primeiro-contato"]);
  });

  it("cache compartilhado por escopo: a segunda leitura não consulta de novo", async () => {
    const shared = context();
    await getLiveStatuses(shared);
    const first = state.calls.length;
    await getLiveStatuses({ ...shared, userId: "outro-diretor" });
    expect(state.calls.length).toBe(first);
  });

  it("provedor que falha some (sem valor anterior) e não derruba os outros", async () => {
    state.fail = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const payload = await getLiveStatuses(context({ role: "supervisor", jobTitle: "supervisor" }));
    expect(payload?.statuses).toEqual([]);
    warn.mockRestore();
  });
});
