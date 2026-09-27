// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { IntegrationsCatalog } from "./integrations-catalog";

afterEach(cleanup);

describe("IntegrationsCatalog", () => {
  it("uses native anchors for available integration destinations", () => {
    render(<IntegrationsCatalog />);

    expect(screen.getByRole("link", { name: "Abrir integração Meta Business" })).toHaveAttribute("href", "/integrations/meta");
    expect(screen.getByRole("link", { name: "Abrir integração WhatsApp" })).toHaveAttribute("href", "/integrations/whatsapp");
    expect(screen.queryByRole("link", { name: "Abrir integração WhatsApp da diretoria" })).not.toBeInTheDocument();
  });
});
