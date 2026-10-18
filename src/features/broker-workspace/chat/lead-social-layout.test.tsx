// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: () => false }));

import { LeadSocialLayout } from "./lead-social-layout";

afterEach(() => cleanup());

describe("LeadSocialLayout", () => {
  it("shows the header, the next step and the conversation on the phone, with the full data in a sheet", () => {
    render(
      <LeadSocialLayout
        header={<p>Cabeçalho da Maria</p>}
        next={<p>Responder o cliente</p>}
        details={<p>Dados completos</p>}
        conversation={<p>Conversa com a Maria</p>}
      />,
    );

    expect(screen.getByText("Cabeçalho da Maria")).toBeTruthy();
    expect(screen.getByText("Responder o cliente")).toBeTruthy();
    expect(screen.getByText("Conversa com a Maria")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ver dados do cliente" })).toBeTruthy();
  });
});
