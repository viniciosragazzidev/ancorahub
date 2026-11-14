// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const fired = vi.hoisted(() => vi.fn());
vi.mock("@/lib/feedback/use-feedback", () => ({ fireFeedbackOnce: fired }));
vi.mock("@/components/motion/interface-motion-provider", () => ({ useInterfaceMotionEnabled: () => false }));

import { SaleCelebration } from "./sale-celebration";

afterEach(() => { cleanup(); fired.mockClear(); });

describe("SaleCelebration", () => {
  it("shows the captain, the title, the stats and one continue button, and celebrates once", () => {
    const onClose = vi.fn();
    render(<SaleCelebration open celebrationKey="sale-1" onClose={onClose} stats={[{ label: "Valor mensal", value: "R$ 1.240" }, { label: "Vidas", value: "3" }]} />);
    const dialog = screen.getByRole("dialog", { name: "Venda registrada!" });
    expect(dialog.querySelector("img")!.getAttribute("src")).toBe("/mascote/venda-capitao.webp");
    expect(screen.getByText("R$ 1.240")).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(fired).toHaveBeenCalledWith("sale-celebration:sale-1", "celebrate", { budgetKey: "venda" }, false);
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes with Escape and shows no sparkles with motion off", () => {
    const onClose = vi.fn();
    const { baseElement } = render(<SaleCelebration open celebrationKey="sale-2" onClose={onClose} />);
    expect(baseElement.querySelectorAll("svg")).toHaveLength(0);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("renders nothing when closed", () => {
    render(<SaleCelebration open={false} celebrationKey="sale-3" onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fired).not.toHaveBeenCalled();
  });
});

import { saleCelebrationStats } from "./sale-celebration";

describe("saleCelebrationStats", () => {
  it("formats the monthly value and the term, and skips what is missing", () => {
    expect(saleCelebrationStats({ approvedValue: "1.240,50", contractTermMonths: 12 })).toEqual([
      { label: "Valor mensal", value: expect.stringMatching(/R\$\s?1\.241/) },
      { label: "Vigência", value: "12 meses" },
    ]);
    expect(saleCelebrationStats({ approvedValue: "", contractTermMonths: 0 })).toEqual([]);
  });
});
