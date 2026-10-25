// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/light-top-nav", () => ({
  LightAvailabilityPill: () => <span>Disponibilidade</span>,
}));
vi.mock("./light-back-button", () => ({
  LightBackButton: ({ className }: { className?: string }) => <button aria-label="Voltar" className={className} />,
}));
vi.mock("./use-light-route", () => ({
  useLightRoute: () => ({ title: "Minha fila", isRoot: true, parentHref: null, backToParent: false }),
}));

import { LightAppHeader } from "./light-app-header";

afterEach(() => cleanup());

const requiredProps = {
  availability: "available" as const,
  availabilityPending: false,
  onToggleAvailability: () => undefined,
  onOpenMore: () => undefined,
};

describe("LightAppHeader", () => {
  it("preserva o HTML sem a configuração específica do diretor", () => {
    const { container } = render(<LightAppHeader {...requiredProps} />);
    const header = container.querySelector("header");
    expect(header).not.toHaveAttribute("data-skin");
    expect(screen.getByRole("button", { name: "Abrir menu Mais" })).toHaveClass("md:hidden");
  });

  it("ativa a pele e mantém Mais acessível até 1023px no diretor", () => {
    const { container } = render(
      <LightAppHeader
        {...requiredProps}
        hideAvailability
        routeOverride={{ title: "Início", isRoot: true, parentHref: null }}
      />,
    );
    expect(container.querySelector("header")).toHaveAttribute("data-skin", "diretor");
    expect(screen.getByRole("button", { name: "Abrir menu Mais" })).toHaveClass("min-[1024px]:hidden");
    expect(screen.getByText("Início")).toBeInTheDocument();
  });
});
