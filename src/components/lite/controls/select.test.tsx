// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LiteFilterChips, LiteSelect } from "./index";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const options = [
  { value: "", label: "Todas as filiais" },
  { value: "centro", label: "Centro" },
  { value: "niteroi", label: "Niterói 1" },
  { value: "barra", label: "Barra da Tijuca" },
];

function stubPhone(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe("LiteSelect", () => {
  it("mostra rótulo e valor no campo e abre a lista com busca", () => {
    render(<LiteSelect label="Filial" value="centro" options={options} onChange={() => {}} />);
    const trigger = screen.getByRole("button", { name: "Filial Centro" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("combobox", { name: "Buscar em filial" })).toHaveFocus();
    expect(screen.getByRole("option", { name: "Centro" })).toHaveAttribute("aria-selected", "true");
  });

  it("filtra sem acento e escolhe com Enter, devolvendo o foco ao campo", async () => {
    const onChange = vi.fn();
    render(<LiteSelect label="Filial" value="" options={options} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Filial/ }));
    const search = screen.getByRole("combobox");
    fireEvent.change(search, { target: { value: "niteroi" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("niteroi");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByRole("button", { name: /Filial/ })).toHaveFocus();
  });

  it("setas, Home e End movem a opção ativa; Esc fecha sem escolher", () => {
    const onChange = vi.fn();
    render(<LiteSelect label="Filial" value="" options={options} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Filial/ }));
    const search = screen.getByRole("combobox");
    const activeLabel = () => document.getElementById(search.getAttribute("aria-activedescendant") ?? "")?.textContent;
    expect(activeLabel()).toBe("Todas as filiais");
    fireEvent.keyDown(search, { key: "ArrowDown" });
    expect(activeLabel()).toBe("Centro");
    fireEvent.keyDown(search, { key: "End" });
    expect(activeLabel()).toBe("Barra da Tijuca");
    fireEvent.keyDown(search, { key: "ArrowDown" });
    expect(activeLabel()).toBe("Todas as filiais");
    fireEvent.keyDown(search, { key: "Home" });
    fireEvent.keyDown(search, { key: "ArrowUp" });
    expect(activeLabel()).toBe("Barra da Tijuca");
    fireEvent.keyDown(search, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clique numa opção escolhe e avisa quando nada casa com a busca", () => {
    const onChange = vi.fn();
    render(<LiteSelect label="Filial" value="" options={options} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Filial/ }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzz" } });
    expect(screen.getByRole("status")).toHaveTextContent("Nenhuma opção encontrada");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("option", { name: "Barra da Tijuca" }));
    expect(onChange).toHaveBeenCalledWith("barra");
  });

  it("seta para baixo no campo abre a lista", () => {
    render(<LiteSelect label="Filial" value="" options={options} onChange={() => {}} />);
    fireEvent.keyDown(screen.getByRole("button", { name: /Filial/ }), { key: "ArrowDown" });
    expect(screen.getByRole("listbox", { name: "Filial" })).toBeInTheDocument();
  });

  it("no celular abre no BottomSheet", () => {
    stubPhone(true);
    render(<LiteSelect label="Filial" value="" options={options} onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Filial/ }));
    expect(screen.getByRole("dialog", { name: "Filial" })).toBeInTheDocument();
    expect(screen.getByRole("listbox", { name: "Filial" })).toBeInTheDocument();
  });

  it("inline abre a lista no fluxo mesmo no celular", () => {
    stubPhone(true);
    render(<LiteSelect label="Filial" inline value="" options={options} onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Filial/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("listbox", { name: "Filial" })).toBeInTheDocument();
  });
});

describe("LiteFilterChips removíveis", () => {
  it("mostra rótulo e valor e remove pelo clique", () => {
    const onRemove = vi.fn();
    render(<LiteFilterChips label="Filtros ativos" chips={[{ id: "branch", label: "Filial", value: "Centro" }]} onRemove={onRemove} />);
    const chip = screen.getByRole("button", { name: "Remover filtro Filial: Centro" });
    expect(chip).not.toHaveAttribute("aria-pressed");
    fireEvent.click(chip);
    expect(onRemove).toHaveBeenCalledWith("branch");
  });
});
