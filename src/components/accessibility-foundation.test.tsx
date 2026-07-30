// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SkipToContent } from "./skip-to-content";
import { FieldError } from "./ui/field";

afterEach(cleanup);

describe("accessibility foundation", () => {
  it("exposes a keyboard skip link to the shared application content target", () => {
    render(<SkipToContent />);

    expect(screen.getByRole("link", { name: "Pular para o conteúdo principal" })).toHaveAttribute("href", "#main-content");
  });

  it("announces inline form errors without relying on color", () => {
    render(<FieldError>Informe um e-mail válido.</FieldError>);

    expect(screen.getByRole("alert")).toHaveTextContent("Informe um e-mail válido.");
  });
});
