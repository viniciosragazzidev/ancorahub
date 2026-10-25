// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArchivedLeadsLite, type ArchivedLeadLiteRow } from "./archived-leads-lite";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const row: ArchivedLeadLiteRow = { id: "l1", name: "Ana Ribeiro", phone: "+55 11 99999-0101", email: "ana@example.test", status: "in_contact", qualificationStatus: "hot", archivedAt: "2026-10-20T15:30:00.000Z", archivedBy: null };

describe("leads arquivados Lite", () => {
  it("mostra etapa e qualificação em sentence case, a data em São Paulo e leva a página para a URL com a busca", () => {
    render(<ArchivedLeadsLite rows={[row]} total={120} page={1} totalPages={3} pageSize={50} search="ana" />);
    expect(screen.getAllByText("Em atendimento").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Quente").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Administrador").length).toBeGreaterThan(0);
    cleanup();
    render(<ArchivedLeadsLite rows={[{ ...row, qualificationStatus: "no_whatsapp_contact", status: "documentation_pending" }]} total={1} page={1} totalPages={1} pageSize={50} search="" />);
    expect(screen.getAllByText("Sem contato no WhatsApp").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Documentação pendente").length).toBeGreaterThan(0);
    cleanup();
    render(<ArchivedLeadsLite rows={[row]} total={120} page={1} totalPages={3} pageSize={50} search="ana" />);
    expect(screen.getAllByText("20/10/2026, 12:30").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Próxima página" })[0]!);
    expect(push).toHaveBeenCalledWith("/leads/arquivados?page=2&search=ana");
  });

  it("busca é um formulário GET com o mesmo parâmetro e o vazio explica o que fazer", () => {
    render(<ArchivedLeadsLite rows={[]} total={0} page={1} totalPages={1} pageSize={50} search="zzz" />);
    const input = screen.getByRole("searchbox", { name: "Buscar leads arquivados" });
    expect(input).toHaveAttribute("name", "search");
    expect(input.closest("form")).toHaveAttribute("method", "get");
    expect(screen.getByRole("heading", { name: "Nenhum lead arquivado encontrado" })).toBeInTheDocument();
    expect(screen.getByText("Tente outro termo de busca.")).toBeInTheDocument();
  });
});
