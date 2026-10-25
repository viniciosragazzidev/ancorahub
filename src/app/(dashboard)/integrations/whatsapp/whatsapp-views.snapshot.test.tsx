// Snapshot do HTML das visões de hoje (chave desligada), tirado antes da versão Lite. Os cartões filhos viram marcadores.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", () => {
  const chain: Record<string, unknown> = {};
  for (const key of ["select", "from", "where", "orderBy"]) chain[key] = () => chain;
  (chain as { then: unknown }).then = (resolve: (rows: unknown[]) => unknown) => resolve([{ id: "m1", name: "Boas-vindas", content: "Olá" }]);
  return { getDatabase: () => chain, schema: new Proxy({}, { get: () => new Proxy({}, { get: () => ({}) }) }) };
});
vi.mock("drizzle-orm", () => ({ and: () => ({}), asc: () => ({}), desc: () => ({}), eq: () => ({}) }));
vi.mock("@/features/communication-channels/outbound-service", () => ({ resolveNoticeTextVariants: () => ["texto"] }));
vi.mock("@/features/team-notices/catalog", () => ({ TEAM_NOTICES: [{ key: "k1", label: "Aviso", description: "Desc", purpose: "taskReminder", class: "critical" }] }));
vi.mock("@/features/team-notices/service", () => ({ getTeamNoticeSettings: async () => new Map([["k1", { enabled: true, channel: "waha", freeMessageIds: [] }]]) }));
vi.mock("@/features/waha-cadence/tenant-channel", () => ({ getTenantChannel: async () => ({ id: "c1", status: "ready" }), getMaterialsChannel: async () => ({ id: "c2", status: "ready" }) }));
vi.mock("@/features/system-settings/queries", () => ({ getFeatureFlag: async () => "true" }));
vi.mock("@/features/waha-group-capture/channel-actions", () => ({ disconnectMaterialsChannelAction: vi.fn(), pollMaterialsChannelAction: vi.fn(), refreshMaterialGroupsAction: vi.fn(), setMaterialGroupActiveAction: vi.fn(), startMaterialsChannelAction: vi.fn() }));
vi.mock("@/features/waha-group-capture/groups-service", () => ({ getCaptureStats: vi.fn() }));
vi.mock("@/features/waha-group-capture/safe-load", () => ({
  safeLoad: async (name: string) => name === "materials-stats"
    ? { ok: true, value: { total: 3, lastMessageAt: new Date("2026-10-24T15:00:00Z"), byStatus: { captured: 2, error: 1 } } }
    : { ok: true, value: [{ id: "g1", groupId: "x", groupName: "Amil", active: true }] },
}));
vi.mock("../whats_alt/_components/team-notices-card", () => ({ TeamNoticesCard: () => <div data-stub="team-notices" /> }));
vi.mock("../whats_alt/_components/tenant-channel-card", () => ({ TenantChannelCard: () => <div data-stub="tenant-channel" /> }));
vi.mock("../whats_alt/_components/material-groups-card", () => ({ MaterialGroupsCard: () => <div data-stub="material-groups" /> }));
vi.mock("./whatsapp-integration-heading", () => ({ WhatsAppIntegrationHeading: ({ active }: { active: string }) => <div data-stub={`heading-${active}`} /> }));

import { DirectorWhatsAppView } from "./director-whatsapp-view";
import { MaterialsWhatsAppView } from "./materials-whatsapp-view";

const context = { tenantId: "t1", userId: "u1", role: "director", jobTitle: "director" } as never;

describe("visões do WhatsApp com a chave desligada", () => {
  it("diretoria", async () => {
    expect(renderToStaticMarkup(await DirectorWhatsAppView({ context }))).toMatchSnapshot();
  });
  it("materiais", async () => {
    expect(renderToStaticMarkup(await MaterialsWhatsAppView({ context }))).toMatchSnapshot();
  });
});

describe("visões do WhatsApp com a chave", () => {
  it("diretoria e materiais trocam de visão em chips de link e mantêm os mesmos cartões", async () => {
    const director = renderToStaticMarkup(await DirectorWhatsAppView({ context, lite: true }));
    expect(director).toContain('aria-current="page"');
    expect(director).toContain('data-stub="tenant-channel"');
    expect(director).toContain('data-stub="team-notices"');
    expect(director).not.toContain("shadow-sm");
    const materials = renderToStaticMarkup(await MaterialsWhatsAppView({ context, lite: true }));
    expect(materials).toContain("Material publicado");
    expect(materials).toContain('data-stub="material-groups"');
    expect(materials).toContain("Captura ligada");
  });
});
