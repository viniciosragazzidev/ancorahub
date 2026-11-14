// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Composição da rota /clientes/[clientId] com o Perfil do cliente do corretor (etapa 5): quem vê o quê, com a
// chave ligada ou desligada, e o escopo da carteira aplicado antes de qualquer leitura.
const state = vi.hoisted(() => ({
  context: { role: "broker", tenantId: "tenant-1", userId: "broker-1", branchId: null as string | null, jobTitle: "broker" },
  audience: "broker" as string | null,
  profileOn: true,
  walletOn: false,
  clientRows: [] as unknown[],
  scope: vi.fn(() => "scope"),
  loadProfile: vi.fn(),
}));

vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => state.context }));
vi.mock("@/features/customers/customer-authorization", () => ({ buildClientScopeWhere: state.scope }));
vi.mock("@/features/broker-workspace/lite-audience", () => ({ getLiteAudience: async () => state.audience }));
vi.mock("@/features/broker-workspace/client-profile/profile-server", () => ({
  brokerClientProfileOn: async (context: { role: string }, audience: string | null) => state.profileOn && context.role === "broker" && audience === "broker",
  loadBrokerClientProfile: state.loadProfile,
}));
vi.mock("@/features/broker-workspace/components/broker-client-profile/broker-client-profile", () => ({
  BrokerClientProfile: ({ initialTab, initialFilter }: { initialTab: string; initialFilter: string }) => <div data-testid="broker-profile">{initialTab}/{initialFilter}</div>,
}));
vi.mock("@/features/broker-workspace/components/light-client-detail", () => ({ LightClientDetail: () => <div data-testid="lite-ficha" /> }));
vi.mock("@/features/carteira/retorno-servico", () => ({ carregarProximaAcao: async () => null, carteiraFichaLiteLigada: async () => state.walletOn }));
vi.mock("@/shared/db", async () => {
  const chain = (result: unknown): unknown => {
    const target = function () {};
    const proxy: unknown = new Proxy(target, {
      get: (_target, key) => (key === "then" ? (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject) : () => proxy),
      apply: () => proxy,
    });
    return proxy;
  };
  const db = { select: (fields: Record<string, unknown> = {}) => ("leadId" in fields && "brokerName" in fields ? chain(state.clientRows) : chain([])) };
  return { schema: await import("@/shared/db/schema"), getDatabase: () => db };
});
vi.mock("@/features/leads/queries", () => ({ getLeadTimeline: async () => [] }));
// Carteira anterior (etapa 4b) roda só no servidor: desligada aqui, o perfil segue o caminho de cliente de venda.
vi.mock("@/features/customers/prior-portfolio", () => ({ isBrokerPriorClientsEnabled: async () => false, listPriorContracts: async () => [], loadOwnPriorClient: async () => null, saoPauloDateKey: () => "2026-11-13" }));
vi.mock("@/features/customers/prior-portfolio-actions", () => ({ updatePriorClientAction: async () => ({ ok: true }), savePriorContractAction: async () => ({ ok: true }), removePriorContractAction: async () => ({ ok: true }) }));
vi.mock("@/features/documents/actions", () => ({ getRequirementsForLead: async () => [], getLeadDocuments: async () => [], getLeadDocumentChecklist: async () => [] }));
vi.mock("@/features/documents/components/lead-documents-section", () => ({ LeadDocumentsSection: () => <div data-testid="docs" /> }));
vi.mock("@/features/post-sale/queries", () => ({ getLeadBeneficiaries: async () => [] }));
vi.mock("@/features/director-lite/style-flag", () => ({ isDirectorLitePageOnServer: async () => false }));
vi.mock("@/components/dashboard-header", () => ({ DashboardHeader: () => <header data-testid="legacy-header" /> }));
vi.mock("@/features/leads/components/lead-timeline", () => ({ LeadTimeline: () => null }));
vi.mock("@/features/post-sale/components/customer-renewal-status", () => ({ CustomerRenewalStatus: () => null }));
vi.mock("@/features/customer-record/components/person-record-details", () => ({ PersonRecordDetails: () => null }));
vi.mock("@/features/post-sale/actions", () => ({ updateCustomerRenewalStatusAction: async () => ({}) }));
vi.mock("@/features/leads/actions", () => ({ addLeadNoteAction: async () => ({}) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("notFound"); } }));

import ClientDetailPage from "./page";

const client = { id: "client-1", leadId: "lead-1", name: "Marina Alves", phone: "11999998888", email: null, convertedAt: new Date("2026-09-20T12:00:00Z"), createdAt: new Date("2026-09-20T12:00:00Z"), branchId: null, corretorId: "broker-1", brokerName: "Paulo Dias", branchName: null };

function setup(overrides: Partial<typeof state> = {}) {
  Object.assign(state, { context: { ...state.context, role: "broker" }, audience: "broker", profileOn: true, walletOn: false, clientRows: [client] }, overrides);
  state.loadProfile.mockResolvedValue({ canAct: false, beneficiaries: [] });
}

async function renderPage(searchParams: Record<string, string> = {}) {
  const tree = (await ClientDetailPage({ params: Promise.resolve({ clientId: "client-1" }), searchParams: Promise.resolve(searchParams) })) as ReactElement;
  return render(tree);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("rota do cliente com o Perfil do corretor", () => {
  it("corretor com a chave ligada vê o Perfil, com aba e filtro da URL", async () => {
    setup();
    await renderPage({ aba: "contratos", filtro: "observacoes" });
    expect(screen.getByTestId("broker-profile")).toHaveTextContent("contratos/observacoes");
    expect(state.loadProfile).toHaveBeenCalledWith(state.context, expect.objectContaining({ id: "client-1", leadId: "lead-1" }));
  });

  it("aplica o escopo da carteira da sessão antes de montar o perfil", async () => {
    setup();
    await renderPage();
    expect(state.scope).toHaveBeenCalledWith(state.context);
  });

  it("cliente fora da carteira não é encontrado, sem carregar o perfil", async () => {
    setup({ clientRows: [] });
    await expect(renderPage()).rejects.toThrow("notFound");
    expect(state.loadProfile).not.toHaveBeenCalled();
  });

  it("chave desligada: o corretor segue com a ficha de antes", async () => {
    setup({ profileOn: false });
    await renderPage();
    expect(screen.queryByTestId("broker-profile")).not.toBeInTheDocument();
    expect(screen.getByTestId("legacy-header")).toBeInTheDocument();
  });

  it("chave desligada com a carteira Lite: segue a ficha Lite de antes", async () => {
    setup({ profileOn: false, walletOn: true });
    await renderPage();
    expect(screen.getByTestId("lite-ficha")).toBeInTheDocument();
  });

  it("supervisor continua com a ficha atual mesmo com a chave ligada", async () => {
    setup({ context: { ...state.context, role: "supervisor", userId: "sup-1" }, audience: "supervisor" });
    await renderPage();
    expect(screen.getByTestId("lite-ficha")).toBeInTheDocument();
    expect(state.loadProfile).not.toHaveBeenCalled();
  });
});
