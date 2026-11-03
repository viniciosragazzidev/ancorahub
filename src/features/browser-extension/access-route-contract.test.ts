import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  authenticate: vi.fn(), exchangePrincipal: vi.fn(), touch: vi.fn(), context: vi.fn(), global: vi.fn(),
  resolve: vi.fn(), getLead: vi.fn(), audit: vi.fn(), changeStatus: vi.fn(), renew: vi.fn(), revoke: vi.fn(), exchange: vi.fn(),
  select: vi.fn(), settings: { enabled: true, minimumVersion: "0.1.0", allowInsert: true, maxSuggestions: 3 },
}));
vi.mock("@/shared/db", async () => ({
  schema: await import("@/shared/db/schema"),
  getDatabase: () => ({ select: state.select }),
}));
vi.mock("./auth", () => ({ authenticateExtensionRequest: state.authenticate,
  getExtensionExchangePrincipal: state.exchangePrincipal, touchExtensionSession: state.touch,
  renewExtensionSession: state.renew, revokeExtensionSession: state.revoke, exchangeExtensionCode: state.exchange }));
vi.mock("./context", () => ({ getExtensionTenantContext: state.context }));
vi.mock("@/features/system-settings/queries", () => ({ getSystemSetting: state.global }));
vi.mock("./lead-context", () => ({ resolveLeadForExtension: state.resolve, getLeadForExtension: state.getLead }));
vi.mock("./audit", () => ({ recordExtensionAudit: state.audit,
  extensionAuditMetadata: () => ({ source: "extension" }) }));
vi.mock("@/features/leads/change-lead-status", () => ({ changeLeadStatus: state.changeStatus }));

import { POST as resolve } from "@/app/api/extension/leads/resolve/route";
import { GET as config } from "@/app/api/extension/config/route";
import { GET as session, POST as renew } from "@/app/api/extension/session/route";
import { POST as revoke } from "@/app/api/extension/auth/revoke/route";
import { POST as exchange } from "@/app/api/extension/auth/exchange/route";
import { POST as feedback } from "@/app/api/extension/leads/[leadId]/feedback/route";
import { PATCH as status } from "@/app/api/extension/leads/[leadId]/status/route";
import { POST as reply } from "@/app/api/extension/leads/[leadId]/reply-suggestions/route";
import { POST as suggestionFeedback } from "@/app/api/extension/suggestions/[suggestionId]/feedback/route";
import { POST as telemetry } from "@/app/api/extension/telemetry/route";
import { AuthenticationError } from "@/shared/auth/errors";

const permissions = ["VIEW_LEAD", "CHANGE_STATUS", "REGISTER_FEEDBACK", "CREATE_TASK", "GENERATE_REPLY"];
let counter = 0;
const routes = [
  ["leads/resolve", (r: Request) => resolve(r)], ["config", (r: Request) => config(r)],
  ["session", (r: Request) => session(r)], ["session", (r: Request) => renew(r)],
  ["auth/revoke", (r: Request) => revoke(r)], ["auth/exchange", (r: Request) => exchange(r)],
  ["leads/lead-a/feedback", (r: Request) => feedback(r, { params: Promise.resolve({ leadId: "lead-a" }) })],
  ["leads/lead-a/status", (r: Request) => status(r, { params: Promise.resolve({ leadId: "lead-a" }) })],
  ["leads/lead-a/reply-suggestions", (r: Request) => reply(r, { params: Promise.resolve({ leadId: "lead-a" }) })],
  ["suggestions/s1/feedback", (r: Request) => suggestionFeedback(r, { params: Promise.resolve({ suggestionId: "s1" }) })],
  ["telemetry", (r: Request) => telemetry(r)],
] as const;
function request(route: string, body: unknown = {}) {
  return new Request("https://crm.test/api/extension/" + route, { method: "POST", body: JSON.stringify(body) });
}
const exchangeBody = { code: "c".repeat(40), deviceId: "device-one", extensionVersion: "0.1.2" };
beforeEach(() => {
  vi.clearAllMocks();
  state.settings.enabled = true;
  const principal = { id: "session-" + ++counter, userId: "user-a", tenantId: "tenant-a", deviceId: "device-a",
    extensionVersion: "0.1.2", expiresAt: new Date("2026-12-01"), permissions: [...permissions] };
  state.authenticate.mockResolvedValue(principal);
  state.exchangePrincipal.mockResolvedValue({ session: principal, grant: { id: "grant-a" } });
  state.context.mockResolvedValue({ userId: "user-a", tenantId: "tenant-a", branchId: "branch-a", role: "broker", jobTitle: "broker" });
  state.global.mockResolvedValue("true");
  state.select.mockImplementation(() => ({ from: () => ({ where: () => ({ limit: async () => [state.settings] }) }) }));
  state.resolve.mockResolvedValue({ status: "NOT_FOUND" });
  state.getLead.mockResolvedValue({ id: "lead-a", version: 1 });
});

describe("gateway de todas as rotas da extensão, sem banco", () => {
  for (const [path, handle] of routes) {
    it.each(["global", "tenant", "membership", "branch"])(path + " nega quando %s está indisponível", async (denial) => {
      if (denial === "global") state.global.mockResolvedValue("false");
      if (denial === "tenant") state.settings.enabled = false;
      if (denial === "membership") state.context.mockResolvedValue(null);
      if (denial === "branch") state.context.mockResolvedValue({ role: "broker", branchId: null });
      const response = await handle(request(path, path === "auth/exchange" ? exchangeBody : {}));
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "FORBIDDEN" });
      expect(state.touch).not.toHaveBeenCalled();
      expect(state.audit).not.toHaveBeenCalled();
      expect(state.changeStatus).not.toHaveBeenCalled();
      expect(state.exchange).not.toHaveBeenCalled();
    });
    if (path !== "auth/exchange") it(path + " exige permissão persistida na sessão", async () => {
      state.authenticate.mockResolvedValue({ id: "denied", userId: "user-a", tenantId: "tenant-a", permissions: [] });
      const response = await handle(request(path));
      expect(response.status).toBe(403);
      expect(state.touch).not.toHaveBeenCalled();
    });
  }

  it("nega flags ausentes do tenant e não usa tenant forjado no payload", async () => {
    state.select.mockImplementation(() => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }));
    const response = await resolve(request("leads/resolve", { phone: "+5511999990000", tenantId: "tenant-b" }));
    expect(response.status).toBe(403);
    expect(state.context).toHaveBeenCalledWith("user-a", "tenant-a");
    expect(state.resolve).not.toHaveBeenCalled();
  });

  it("não distingue número inexistente de lead de outro corretor", async () => {
    // Also guard the HTTP boundary against a legacy resolver returning FORBIDDEN.
    for (const result of [{ status: "NOT_FOUND" }, { status: "FORBIDDEN" }]) {
      state.resolve.mockResolvedValueOnce(result);
      const response = await resolve(request("leads/resolve", { phone: "+5511999990000" }));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "NOT_FOUND" });
    }
  });

  it("retorna 429 uniforme com Retry-After e não consome o limite de config", async () => {
    for (let i = 0; i < 60; i++) expect((await resolve(request("leads/resolve", { phone: "+5511999990000" }))).status).toBe(200);
    const response = await resolve(request("leads/resolve", { phone: "+5511999990000" }));
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "RATE_LIMITED" });
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await config(request("config"))).status).toBe(200);
  });

  it("propaga sessão vencida como 401 em vez de acessar recursos", async () => {
    state.authenticate.mockRejectedValue(new AuthenticationError("expired"));
    expect((await resolve(request("leads/resolve"))).status).toBe(401);
    expect(state.resolve).not.toHaveBeenCalled();
  });

  it("status usa o serviço normal do CRM e inclui auditoria da extensão sem caminho system", async () => {
    state.changeStatus.mockResolvedValue({ success: true });
    const response = await status(request("leads/lead-a/status", { statusId: "contacted", expectedVersion: 1 }),
      { params: Promise.resolve({ leadId: "lead-a" }) });
    expect(response.status).toBe(200);
    expect(state.changeStatus).toHaveBeenCalledWith({ leadId: "lead-a", newStatus: "contacted", expectedVersion: 1 },
      expect.objectContaining({ tenantId: "tenant-a", userId: "user-a", branchId: "branch-a" }),
      undefined, { action: "extension.status.changed", metadata: { source: "extension" } });
  });

  it.each([{ statusId: "contacted" }, { nextAction: "Ligar" }])("feedback não amplia permissão via campos opcionais: %j", async (extra) => {
    state.authenticate.mockResolvedValue({ id: "restricted-" + ++counter, userId: "user-a", tenantId: "tenant-a", permissions: ["REGISTER_FEEDBACK"] });
    const response = await feedback(request("leads/lead-a/feedback", { outcome: "INTERESTED", expectedVersion: 1, ...extra }),
      { params: Promise.resolve({ leadId: "lead-a" }) });
    expect(response.status).toBe(403);
    expect(state.changeStatus).not.toHaveBeenCalled();
    expect(state.audit).not.toHaveBeenCalled();
  });
});
