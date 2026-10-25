// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SpreadsheetPasswordGate, SpreadsheetTable, type PublicSpreadsheet } from "./spreadsheet-views";

afterEach(cleanup);

const DATA: PublicSpreadsheet = {
  name: "Leads de outubro",
  description: "Base compartilhada com a equipe",
  columns: [{ key: "nome", label: "Nome", type: "string" }, { key: "vidas", label: "Vidas", type: "number" }],
  rows: Array.from({ length: 30 }, (_, index) => ({ nome: index === 0 ? "Zélia" : `Cliente ${index + 1}`, vidas: index === 0 ? 1200 : index })),
  rowCount: 30,
};

describe("planilha compartilhada no visual Lite", () => {
  it("busca, ordena e pagina de 25 em 25 como antes", () => {
    render(<SpreadsheetTable data={DATA} />);
    expect(screen.getByText("30 linhas · 2 colunas")).toBeInTheDocument();
    expect(screen.getByText("1.200")).toBeInTheDocument();
    expect(screen.getByText(/Página 1 de 2/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar na tabela" }), { target: { value: "Zélia" } });
    expect(screen.getAllByRole("row")).toHaveLength(2);
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar na tabela" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Nome/ }));
    expect(screen.getAllByRole("columnheader")[0]).toHaveAttribute("aria-sort", "ascending");
    expect(within(screen.getAllByRole("row")[1]!).queryByText("Zélia")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
    expect(screen.getByText(/Página 2 de 2/)).toBeInTheDocument();
  });

  it("portão de senha envia o formulário e mostra o erro", () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    const onChange = vi.fn();
    render(<SpreadsheetPasswordGate password="" onPasswordChange={onChange} error="Senha incorreta." submitting={false} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "abc" } });
    expect(onChange).toHaveBeenCalledWith("abc");
    fireEvent.click(screen.getByRole("button", { name: "Acessar visualização" }));
    expect(onSubmit).toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Senha incorreta.");
  });
});
