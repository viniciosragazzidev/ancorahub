// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/carteira/retorno-actions", () => ({ agendarRetornoAction: vi.fn(), reagendarRetornoAction: vi.fn() }));
vi.mock("@/features/leads/task-actions", () => ({ setLeadTaskDoneAction: vi.fn() }));

import { LightClientDetail, type LightClientDetailData } from "./light-client-detail";

const data: LightClientDetailData = {
  client: { id: "c1", leadId: "lead-1", name: "Marina Alves", phone: null, email: null, convertedAt: "2026-09-20T12:00:00Z", branchName: null, brokerName: "Paulo" },
  activeCustomer: null,
  sales: [{ id: "venda-9", planName: "Plano", carrierName: "Operadora", saleValue: "100", policyNumber: null, status: "approved", saleDate: "2026-09-20", brokerName: "Paulo" }],
  beneficiaries: [],
  documents: [],
  timeline: [],
};

afterEach(() => cleanup());

describe("ações da ficha do corretor", () => {
  it("com ações permitidas, mostra conversa e 'Ver detalhes' da venda", () => {
    render(<LightClientDetail data={data} actions={{ conversationHref: "/conversas?leadId=lead-1", saleLinks: true }} />);
    expect(screen.getByRole("link", { name: "Enviar mensagem" }).getAttribute("href")).toBe("/conversas?leadId=lead-1");
    fireEvent.click(screen.getByText("Vendas (1)"));
    expect(screen.getByRole("link", { name: "Ver detalhes" }).getAttribute("href")).toBe("/vendas/venda-9");
  });

  it("sem ações (lead transferido), não mostra conversa nem detalhes de venda", () => {
    render(<LightClientDetail data={data} actions={{ conversationHref: null, saleLinks: false }} />);
    expect(screen.queryByRole("link", { name: "Enviar mensagem" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Ver detalhes" })).toBeNull();
  });
});
