// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PersonChip, personInitials, shortPersonName } from "./person-chip";
import { SegmentBar } from "./segment-bar";

afterEach(cleanup);

describe("PersonChip", () => {
  it("iniciais e nome curto", () => {
    expect(personInitials("Vinicios Ragazzi")).toBe("VR");
    expect(personInitials("ana")).toBe("A");
    expect(shortPersonName("Vinicios Ragazzi")).toBe("Vinicios R.");
    expect(shortPersonName("Maria da Silva")).toBe("Maria S.");
    expect(shortPersonName("Tain")).toBe("Tain");
  });

  it("mostra nome curto e guarda o completo no title", () => {
    render(<PersonChip name="Vinicios Ragazzi" />);
    const chip = screen.getByTitle("Vinicios Ragazzi");
    expect(chip.textContent).toBe("VRVinicios R.");
  });
});

describe("SegmentBar", () => {
  it("preenche os segmentos até o valor e limita ao total", () => {
    const { container, rerender } = render(<SegmentBar value={3} total={8} label="Etapa 3 de 8" />);
    expect(screen.getByRole("img", { name: "Etapa 3 de 8" })).toBeTruthy();
    expect(container.querySelectorAll(".bg-ds-electric-blue")).toHaveLength(3);
    rerender(<SegmentBar value={12} total={8} label="x" />);
    expect(container.querySelectorAll(".bg-ds-electric-blue")).toHaveLength(8);
  });
});
