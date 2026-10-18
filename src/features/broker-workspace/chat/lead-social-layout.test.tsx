// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LeadSocialLayout } from "./lead-social-layout";

afterEach(() => cleanup());

describe("LeadSocialLayout", () => {
  it("puts the client's profile and the conversation side by side in the DOM order", () => {
    render(
      <LeadSocialLayout profile={<p>Perfil da Maria</p>}>
        <p>Conversa com a Maria</p>
      </LeadSocialLayout>,
    );

    const profile = screen.getByRole("complementary", { name: "Perfil do cliente" });
    expect(profile.textContent).toBe("Perfil da Maria");
    expect(screen.getByText("Conversa com a Maria")).toBeTruthy();
    // The profile comes first: on the phone it sits above the conversation.
    expect(profile.compareDocumentPosition(screen.getByText("Conversa com a Maria")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
