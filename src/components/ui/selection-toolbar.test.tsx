// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);
import { SelectionToolbar } from "./selection-toolbar";

describe("SelectionToolbar", () => {
  it("renders nothing when count is 0", () => {
    const { container } = render(
      <SelectionToolbar selectedCount={0} totalCount={10} onClear={vi.fn()}>
        <button>Ação</button>
      </SelectionToolbar>,
    );

    // The AnimatePresence hides content when count is 0
    expect(container.textContent).toBe("");
  });

  it("renders count message when items are selected", () => {
    render(
      <SelectionToolbar selectedCount={3} totalCount={10} onClear={vi.fn()}>
        <button>Ação</button>
      </SelectionToolbar>,
    );

    expect(screen.getByText("3 de 10 selecionados")).toBeInTheDocument();
  });

  it("renders singular label for single selection", () => {
    render(
      <SelectionToolbar selectedCount={1} totalCount={5} onClear={vi.fn()}>
        <button>Ação</button>
      </SelectionToolbar>,
    );

    expect(screen.getByText("1 de 5 selecionado")).toBeInTheDocument();
  });

  it("renders action buttons", () => {
    render(
      <SelectionToolbar selectedCount={2} totalCount={5} onClear={vi.fn()}>
        <button>Aprovar</button>
        <button>Rejeitar</button>
      </SelectionToolbar>,
    );

    expect(screen.getByText("Aprovar")).toBeInTheDocument();
    expect(screen.getByText("Rejeitar")).toBeInTheDocument();
  });

  it("calls onClear when clear button is clicked", () => {
    const onClear = vi.fn();
    render(
      <SelectionToolbar selectedCount={2} totalCount={5} onClear={onClear}>
        <button>Ação</button>
      </SelectionToolbar>,
    );

    screen.getByRole("button", { name: /limpar/i }).click();
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("renders custom children", () => {
    render(
      <SelectionToolbar selectedCount={3} totalCount={8} onClear={vi.fn()}>
        <span>Custom Action</span>
      </SelectionToolbar>,
    );

    expect(screen.getByText("Custom Action")).toBeInTheDocument();
  });

  it("hides when count goes to 0", () => {
    const { container, rerender } = render(
      <SelectionToolbar selectedCount={3} totalCount={10} onClear={vi.fn()}>
        <button>Ação</button>
      </SelectionToolbar>,
    );

    expect(
      screen.getByText("3 de 10 selecionados"),
    ).toBeInTheDocument();

    rerender(
      <SelectionToolbar selectedCount={0} totalCount={10} onClear={vi.fn()}>
        <button>Ação</button>
      </SelectionToolbar>,
    );

    // Toolbar is hidden when selectedCount is 0
    expect(
      screen.queryByText("3 de 10 selecionados"),
    ).not.toBeInTheDocument();
    expect(container.textContent).toBe("");
  });
});
