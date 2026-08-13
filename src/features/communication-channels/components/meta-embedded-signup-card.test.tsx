// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { completeMock, refreshMock } = vi.hoisted(() => ({
  completeMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));
vi.mock("../actions", () => ({ completeMetaEmbeddedSignupAction: completeMock }));

import { MetaEmbeddedSignupCard } from "./meta-embedded-signup-card";

afterEach(() => {
  cleanup();
  completeMock.mockReset();
  refreshMock.mockReset();
  delete window.FB;
});

describe("MetaEmbeddedSignupCard", () => {
  it("conclui o cadastro quando a Meta envia o resultado FINISH como JSON em postMessage", async () => {
    completeMock.mockResolvedValue({ success: true });
    window.FB = {
      init: vi.fn(),
      login: (callback) => callback({ authResponse: { code: "authorization-code-123" } }),
    };

    render(<MetaEmbeddedSignupCard appId="780859815090303" configId="1084166957633691" />);
    fireEvent.click(screen.getByRole("button", { name: "Conectar número com Facebook" }));

    window.dispatchEvent(new MessageEvent("message", {
      origin: "https://www.facebook.com",
      data: JSON.stringify({
        type: "WA_EMBEDDED_SIGNUP",
        event: "FINISH",
        data: { business_id: "37173915645589885", waba_id: "123456789012345", phone_number_id: "987654321098765" },
      }),
    }));

    await waitFor(() => expect(completeMock).toHaveBeenCalledWith({
      code: "authorization-code-123",
      businessId: "37173915645589885",
      wabaId: "123456789012345",
      phoneNumberId: "987654321098765",
    }));
    expect(await screen.findByText("Número oficial conectado e validado pela Meta.")).toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalled();
  });
});
