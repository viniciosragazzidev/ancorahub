// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LITE_PHONE_MAX_FIELDS, LiteDataList, LiteDataTable, LiteResponsiveData, splitPhoneDetails, type LiteColumn } from "./data";

afterEach(cleanup);

type Lead = { id: string; name: string; phone: string; queue: string; value: number };

const rows: Lead[] = [
  { id: "a", name: "Ana Souza", phone: "21 90000-0001", queue: "Fila Tatiana", value: 1200 },
  { id: "b", name: "Bruno Lima", phone: "21 90000-0002", queue: "PF Renan", value: 950 },
];

const columns: LiteColumn<Lead>[] = [
  { id: "name", label: "Lead", render: (row) => row.name, primary: true },
  { id: "phone", label: "Telefone", render: (row) => row.phone, secondary: true },
  { id: "queue", label: "Fila", render: (row) => row.queue },
  { id: "value", label: "Valor", render: (row) => `R$ ${row.value}`, numeric: true },
];

const base = { caption: "Leads", columns, rows, rowKey: (row: Lead) => row.id, empty: <p>Nenhum lead</p> };

describe("LiteDataTable", () => {
  it("mostra cabeçalho e uma linha por registro, com a coluna numérica à direita", () => {
    render(<LiteDataTable {...base} />);
    const table = within(screen.getByRole("table", { name: "Leads" }));
    expect(table.getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["Lead", "Telefone", "Fila", "Valor"]);
    expect(table.getAllByRole("row")).toHaveLength(3);
    expect(table.getByText("R$ 1200").className).toContain("numeric");
  });

  it("abre o registro com clique e com Enter", () => {
    const open = vi.fn();
    render(<LiteDataTable {...base} onRowOpen={open} />);
    fireEvent.click(screen.getByText("Ana Souza"));
    expect(open).toHaveBeenLastCalledWith(rows[0]);
    fireEvent.keyDown(screen.getByText("Bruno Lima").closest("tr")!, { key: "Enter" });
    expect(open).toHaveBeenLastCalledWith(rows[1]);
  });

  it("controle dentro da linha não abre o registro; coluna nowrap ganha a classe", () => {
    const open = vi.fn();
    const withAction: LiteColumn<Lead>[] = [...columns, { id: "go", label: "Ações", render: (row) => <a href={`/x/${row.id}`}>Abrir {row.name}</a> }];
    withAction[2] = { ...withAction[2]!, nowrap: true };
    render(<LiteDataTable {...base} columns={withAction} onRowOpen={open} />);
    const link = screen.getByRole("link", { name: "Abrir Ana Souza" });
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    fireEvent.keyDown(link, { key: "Enter" });
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByText("Fila Tatiana").className).toContain("nowrap");
  });

  it("sem linhas, mostra o estado vazio", () => {
    render(<LiteDataTable {...base} rows={[]} />);
    expect(screen.getByText("Nenhum lead")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("LiteDataList", () => {
  it("monta um cartão por linha: título, apoio e demais campos em pares", () => {
    render(<LiteDataList {...base} onRowOpen={() => {}} />);
    const list = screen.getByRole("list", { name: "Leads" });
    const cards = within(list).getAllByRole("listitem");
    expect(cards).toHaveLength(2);
    expect(within(cards[0]!).getByText("Ana Souza")).toBeInTheDocument();
    expect(within(cards[0]!).getByText("21 90000-0001")).toBeInTheDocument();
    expect(within(cards[0]!).getByText("Fila")).toBeInTheDocument();
  });

  it("sem linhas, mostra o estado vazio", () => {
    render(<LiteDataList {...base} rows={[]} />);
    expect(screen.getByText("Nenhum lead")).toBeInTheDocument();
  });
});

describe("LiteResponsiveData", () => {
  it("renderiza tabela e cartões; o CSS escolhe qual aparece pela largura", () => {
    const { container } = render(<LiteResponsiveData {...base} />);
    expect(container.querySelector('[data-lite="table"]')).not.toBeNull();
    expect(container.querySelector('[data-lite="list"]')).not.toBeNull();
  });
});

describe("seleção em massa", () => {
  const selection = (selected: string[], onToggle = vi.fn(), onToggleAll = vi.fn()) => ({
    isSelected: (row: Lead) => selected.includes(row.id),
    onToggle,
    allSelected: selected.length === rows.length,
    onToggleAll,
    rowLabel: (row: Lead) => `Selecionar ${row.name}`,
  });

  it("tabela tem caixa por linha e selecionar todos, sem abrir a linha", () => {
    const onToggle = vi.fn();
    const onToggleAll = vi.fn();
    const open = vi.fn();
    render(<LiteDataTable {...base} onRowOpen={open} selection={selection(["a"], onToggle, onToggleAll)} />);
    expect(screen.getByRole("checkbox", { name: "Selecionar Ana Souza" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Selecionar Bruno Lima" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Bruno Lima" }));
    expect(onToggle).toHaveBeenCalledWith(rows[1]);
    expect(open).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar todos" }));
    expect(onToggleAll).toHaveBeenCalledWith(true);
  });

  it("cartão do celular também seleciona, e espaço na caixa não abre o cartão", () => {
    const onToggle = vi.fn();
    const open = vi.fn();
    render(<LiteDataList {...base} onRowOpen={open} selection={selection([], onToggle)} />);
    const box = screen.getByRole("checkbox", { name: "Selecionar Ana Souza" });
    fireEvent.keyDown(box, { key: " " });
    fireEvent.click(box);
    expect(onToggle).toHaveBeenCalledWith(rows[0]);
    expect(open).not.toHaveBeenCalled();
  });
});

describe("cartão do celular (Miller: no máximo 6 campos à vista)", () => {
  type Wide = Record<string, string>;
  const ids = ["nome", "telefone", "fila", "etapa", "origem", "corretor", "valor", "criado", "unidade", "acoes"];
  const wide: LiteColumn<Wide>[] = ids.map((id, index) => ({
    id, label: id.toUpperCase(), render: (row) => row[id], primary: index === 0, secondary: index === 1,
  }));
  const wideRow: Wide = Object.fromEntries(ids.map((id) => [id, `v-${id}`]));

  it("mostra título, apoio e 4 detalhes; o resto fica em Mais dados, sem perder nada", () => {
    expect(LITE_PHONE_MAX_FIELDS).toBe(6);
    const open = vi.fn();
    render(<LiteDataList caption="Leads" columns={wide} rows={[wideRow]} rowKey={() => "x"} empty={null} onRowOpen={open} />);
    const card = screen.getByRole("listitem");
    const summary = within(card).getByText("Mais dados (4)");
    const details = summary.closest("details")!;
    const visible = [...card.querySelectorAll("dl")].filter((dl) => !details.contains(dl)).flatMap((dl) => [...dl.querySelectorAll("dt")].map((dt) => dt.textContent));
    expect(visible).toEqual(["FILA", "ETAPA", "ORIGEM", "CORRETOR"]);
    expect([...details.querySelectorAll("dt")].map((dt) => dt.textContent)).toEqual(["VALOR", "CRIADO", "UNIDADE", "ACOES"]);
    expect(within(details).getByText("v-acoes")).toBeInTheDocument();
    // Abrir "Mais dados" não abre o registro.
    fireEvent.click(summary);
    expect(open).not.toHaveBeenCalled();
  });

  it("prioridade: high sobe para os visíveis, low vai direto para Mais dados", () => {
    const columns = wide.map((column) => column.id === "acoes" ? { ...column, phonePriority: "high" as const } : column.id === "fila" ? { ...column, phonePriority: "low" as const } : column);
    const { visible, more } = splitPhoneDetails(columns.slice(2), 4);
    expect(visible.map((column) => column.id)).toEqual(["etapa", "origem", "corretor", "acoes"]);
    expect(more.map((column) => column.id)).toEqual(["fila", "valor", "criado", "unidade"]);
  });

  it("até 6 campos, nada muda: sem Mais dados", () => {
    render(<LiteDataList {...base} />);
    expect(screen.queryByText(/Mais dados/)).not.toBeInTheDocument();
  });

  it("a tabela do computador continua com todas as colunas", () => {
    render(<LiteDataTable caption="Leads" columns={wide} rows={[wideRow]} rowKey={() => "x"} empty={null} />);
    expect(screen.getAllByRole("columnheader")).toHaveLength(ids.length);
  });
});
