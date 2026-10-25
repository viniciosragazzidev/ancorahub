// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/arc/bottom-sheet/bottom-sheet", () => ({ BottomSheet: () => null }));

import { ViewAsButton } from "./view-as";
import styles from "./view-as.module.css";

afterEach(() => cleanup());

describe("ViewAsButton no Diretor Lite", () => {
  const state = { canViewAs: true, viewingAs: null };

  it("usa uma linha neutra com alvo de 44px", () => {
    render(<ViewAsButton state={state} variant="sidebar" directorLite />);
    const button = screen.getByRole("button", { name: /Ver como/ });
    expect(button).toHaveClass(styles.directorLiteButton);
    expect(button.querySelector("small")).toHaveTextContent("Entre como corretor");
  });

  it("mantem o estilo existente quando a pele esta desligada", () => {
    render(<ViewAsButton state={state} variant="sidebar" />);
    expect(screen.getByRole("button", { name: /Ver como/ })).toHaveClass(styles.button);
    expect(screen.getByRole("button", { name: /Ver como/ })).not.toHaveClass(styles.directorLiteButton);
  });
});

