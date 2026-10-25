// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Ficha do cliente do diretor com a chave desligada: o HTML de cada aba precisa continuar igual ao de antes do Lite.
// O snapshot foi gerado com o page.tsx original, com o banco, a sessão e as Server Actions trocados por dados fixos.
const fixtures = vi.hoisted(() => ({
  context: { role: "director", tenantId: "tenant-1", userId: "director-1", branchId: null as string | null, jobTitle: "director" },
  liteStyle: { current: false },
}));

vi.mock("@/shared/db", async () => {
  const data = await import("./client-detail-fixtures");
  const chain = (result: unknown): unknown => {
    const target = function () {};
    const proxy: unknown = new Proxy(target, {
      get: (_target, key) => (key === "then" ? (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject) : () => proxy),
      apply: () => proxy,
    });
    return proxy;
  };
  const db = {
    select: (fields: Record<string, unknown> = {}) => {
      if ("leadId" in fields && "brokerName" in fields) return chain([data.clientFixture]);
      if ("consentimentoLgpd" in fields) return chain([data.clientLeadFixture]);
      if ("approvedValue" in fields) return chain(data.clientSalesFixture);
      if ("saleValue" in fields) return chain(data.clientSalesFixture);
      if ("renewalStatus" in fields) return chain([data.clientActiveCustomerFixture]);
      return chain([]);
    },
  };
  return { schema: await import("@/shared/db/schema"), getDatabase: () => db };
});
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => fixtures.context }));
vi.mock("@/features/customers/customer-authorization", () => ({ buildClientScopeWhere: () => undefined }));
vi.mock("@/features/broker-workspace/lite-audience", () => ({ getLiteAudience: async () => null }));
vi.mock("@/features/leads/queries", async () => ({ getLeadTimeline: async () => (await import("./client-detail-fixtures")).clientInteractionsFixture }));
vi.mock("@/features/documents/actions", async () => {
  const data = await import("./client-detail-fixtures");
  return {
    getRequirementsForLead: async () => data.clientRequirementsFixture,
    getLeadDocuments: async () => data.clientDocumentsFixture,
    getLeadDocumentChecklist: async () => data.clientChecklistFixture,
    confirmDocumentUploadAction: async () => ({}),
    deleteDocumentAction: async () => ({}),
  };
});
vi.mock("@/features/post-sale/queries", async () => ({ getLeadBeneficiaries: async () => (await import("./client-detail-fixtures")).clientBeneficiariesFixture }));
vi.mock("@/features/post-sale/actions", () => ({ updateCustomerRenewalStatusAction: async () => ({}) }));
vi.mock("@/features/leads/actions", () => ({ addLeadNoteAction: async () => ({}) }));
vi.mock("@/features/broker-workspace/components/light-client-detail", () => ({ LightClientDetail: () => null }));
// A área de soltar arquivos do Arc usa molas do motion (fora do mock global); aqui basta saber que ela aparece.
vi.mock("@/components/arc/file-dropzone/file-dropzone", () => ({ FileDropzone: () => <div data-testid="file-dropzone" /> }));
vi.mock("@/features/director-lite/style-flag", () => ({ isDirectorLitePageOnServer: async () => fixtures.liteStyle.current }));
vi.mock("@/components/dashboard-header", () => ({
  DashboardHeader: ({ breadcrumb, title }: { breadcrumb?: string; title?: string }) => <header data-testid="dashboard-header">{breadcrumb} / {title}</header>,
}));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("notFound"); },
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/clientes/client-1",
}));

import { ArcScopeProvider } from "@/components/arc/arc-scope-context";

import ClientDetailPage from "./page";

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-24T15:00:00.000Z"));
});

afterEach(cleanup);

async function renderPage(lite: boolean) {
  fixtures.liteStyle.current = lite;
  const tree = (await ClientDetailPage({ params: Promise.resolve({ clientId: "client-1" }) })) as ReactElement;
  fixtures.liteStyle.current = false;
  return render(lite ? <ArcScopeProvider enabled>{tree}</ArcScopeProvider> : tree);
}

describe("ficha do cliente do diretor com a chave desligada", () => {
  it("preserva o HTML legado de cada aba", async () => {
    const { container } = await renderPage(false);
    expect(screen.getAllByText("Maria Aparecida Nova dos Santos").length).toBeGreaterThan(0);
    expect(container.innerHTML).toMatchSnapshot("vendas");
    fireEvent.click(screen.getByRole("tab", { name: /Documentos/ }));
    expect(container.innerHTML).toMatchSnapshot("documentos");
    fireEvent.click(screen.getByRole("tab", { name: /Linha do Tempo/ }));
    expect(container.innerHTML).toMatchSnapshot("linha do tempo");
  }, 30_000);

  it("com a chave do diretor, mostra a ficha Lite sem perder vendas, documentos, linha do tempo e renovação", async () => {
    const { container } = await renderPage(true);
    expect(container.querySelector('[data-skin="diretor"]')).not.toBeNull();
    expect(screen.getByTestId("dashboard-header")).toHaveTextContent("Maria Aparecida Nova dos Santos");
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Maria Aparecida Nova dos Santos" })).toBeInTheDocument();
    expect(screen.getAllByText("Renovação em 27 dias").length).toBe(2);
    expect(screen.getByRole("link", { name: /Ver lead original/ })).toHaveAttribute("href", "/leads/11111111-1111-4111-8111-111111111111");
    expect(screen.getByRole("link", { name: /Enviar mensagem pós-venda/ })).toHaveAttribute("href", "/conversas?leadId=11111111-1111-4111-8111-111111111111");
    expect(screen.getByRole("tab", { name: /Vendas/ })).toHaveTextContent("2");
    expect(screen.getAllByRole("link", { name: /Ver detalhes/ })[0]).toHaveAttribute("href", "/vendas/sale-1");
    expect(screen.getByDisplayValue("Proposta enviada, aguardando retorno")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar acompanhamento" })).toBeEnabled();
    expect(screen.getAllByText("João Nova").length).toBeGreaterThan(0);
    // Datas pt-BR no fuso de São Paulo.
    expect(container.textContent).toContain("14 de agosto de 2026");
    expect(container.textContent).toContain("01/09/2026");
    fireEvent.click(screen.getByRole("tab", { name: "Documentos" }));
    expect(container.textContent).toContain("RG ou CNH do titular");
    expect(screen.getAllByTestId("file-dropzone").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("tab", { name: "Linha do tempo" }));
    expect(screen.getByRole("button", { name: "Adicionar nota" })).toBeInTheDocument();
    expect(container.textContent).toContain("inclusão do filho");
    expect(container.textContent).not.toContain("—");
  }, 30_000);
});
