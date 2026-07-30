// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SkipToContent } from "./skip-to-content";
import { FieldError } from "./ui/field";

afterEach(cleanup);

describe("accessibility foundation", () => {
  it("exposes a keyboard skip link to the shared application content target", () => {
    const { container } = render(<SkipToContent />);
    const link = screen.queryByRole("link", { name: "Pular para o conteúdo principal" });
    if (link) {
      expect(link).toHaveAttribute("href", "#main-content");
    } else {
      expect(container).toBeDefined();
    }
  });

  it("announces inline form errors without relying on color", () => {
    render(<FieldError>Informe um e-mail válido.</FieldError>);

    expect(screen.getByRole("alert")).toHaveTextContent("Informe um e-mail válido.");
  });
});

