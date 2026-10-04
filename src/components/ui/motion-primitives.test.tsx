// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Button } from "./button";
import { FieldSuccess } from "./field";
import { Skeleton, SkeletonReveal } from "./skeleton";

afterEach(cleanup);

describe("motion primitives", () => {
  it("keeps button content width and semantics while loading", () => {
    render(<Button loading>Salvar alterações</Button>);

    const button = screen.getByRole("button", { name: "Salvar alterações" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector(".ct-spinner")).toBeInTheDocument();
    expect(button.querySelector(".opacity-0")).toHaveTextContent("Salvar alterações");
  });

  it("preserves the asChild link structure during loading", () => {
    render(<Button asChild loading><a href="/leads">Abrir leads</a></Button>);

    const link = screen.getByRole("link", { name: "Abrir leads" });
    expect(link).toHaveAttribute("aria-busy", "true");
    expect(link.querySelector("a")).toBeNull();
    expect(link.querySelector(".ct-spinner")).toBeInTheDocument();
  });

  it("replaces a marked icon while retaining the button label", () => {
    render(<Button loading><svg data-icon="inline-start" className="size-4" aria-hidden="true" /><span>Enviar</span></Button>);

    const button = screen.getByRole("button", { name: "Enviar" });
    expect(button.querySelector("[data-icon='inline-start']")?.parentElement).toHaveClass("opacity-0");
    expect(screen.getByText("Enviar")).not.toHaveClass("opacity-0");
    expect(button.querySelector(".ct-spinner")).toBeInTheDocument();
  });

  it("provides an accessible success check and crossfade state", () => {
    const { rerender } = render(
      <>
        <FieldSuccess>Verificado</FieldSuccess>
        <SkeletonReveal loading fallback={<Skeleton aria-label="Carregando" />}>
          <span>Conteúdo pronto</span>
        </SkeletonReveal>
      </>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Verificado");
    const reveal = screen.getByLabelText("Carregando").parentElement?.parentElement;
    expect(reveal).toHaveAttribute("data-loading", "true");
    rerender(
      <SkeletonReveal loading={false} fallback={<Skeleton aria-label="Carregando" />}>
        <span>Conteúdo pronto</span>
      </SkeletonReveal>,
    );
    expect(screen.getByText("Conteúdo pronto").parentElement).toHaveAttribute("aria-hidden", "false");
  });
});
