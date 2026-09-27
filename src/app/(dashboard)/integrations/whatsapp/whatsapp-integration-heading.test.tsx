// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WhatsAppIntegrationHeading } from "./whatsapp-integration-heading";

afterEach(cleanup);

describe("WhatsAppIntegrationHeading", () => {
  it("keeps the channel selection in the URL for directors", () => {
    render(<WhatsAppIntegrationHeading active="diretoria" canViewDirector />);

    expect(screen.queryByRole("heading", { name: "WhatsApp" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Oficial (Meta)" })).toHaveAttribute("href", "/integrations/whatsapp");
    expect(screen.getByRole("link", { name: "Diretoria (WAHA)" })).toHaveAttribute("href", "/integrations/whatsapp?visao=diretoria");
    expect(screen.getByRole("link", { name: "Diretoria (WAHA)" })).toHaveAttribute("aria-current", "page");
  });

  it("does not show the director channel to other roles", () => {
    render(<WhatsAppIntegrationHeading active="oficial" canViewDirector={false} />);
    expect(screen.queryByRole("link", { name: "Diretoria (WAHA)" })).not.toBeInTheDocument();
  });
});
