// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

describe("Select", () => {
  afterEach(() => cleanup());

  it("renders its open listbox in the document layer, outside the header container", () => {
    const { container } = render(
      <header className="sticky overflow-hidden">
        <Select defaultValue="today">
          <SelectTrigger aria-label="Período">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
          </SelectContent>
        </Select>
      </header>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Período" }));

    const listbox = screen.getByRole("listbox");
    expect(container.contains(listbox)).toBe(false);
    expect(listbox.parentElement).toBe(document.body);
  });
});
