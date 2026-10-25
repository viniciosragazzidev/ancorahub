// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LitePagination } from "./pagination";

afterEach(cleanup);

describe("LitePagination", () => {
  it("some com uma página só", () => {
    const { container } = render(<LitePagination page={1} totalPages={1} totalItems={8} pageSize={20} onPageChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra o intervalo e navega pelas setas, travando nas pontas", () => {
    const onPageChange = vi.fn();
    const { rerender } = render(<LitePagination page={1} totalPages={7} totalItems={134} pageSize={20} onPageChange={onPageChange} />);
    expect(screen.getByText("1 a 20 de 134")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
    rerender(<LitePagination page={7} totalPages={7} totalItems={134} pageSize={20} onPageChange={onPageChange} />);
    expect(screen.getByText("121 a 134 de 134")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Página anterior" }));
    expect(onPageChange).toHaveBeenLastCalledWith(6);
  });

  it("não navega enquanto carrega", () => {
    const onPageChange = vi.fn();
    render(<LitePagination page={2} totalPages={7} totalItems={134} pageSize={20} onPageChange={onPageChange} pending />);
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeDisabled();
  });
});
