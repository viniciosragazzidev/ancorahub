// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { completeMock, assignMock } = vi.hoisted(() => ({
  completeMock: vi.fn(),
  assignMock: vi.fn(),
}));

vi.mock("../actions", () => ({ completeMetaEmbeddedSignupAction: completeMock }));

import { MetaEmbeddedSignupCard } from "./meta-embedded-signup-card";

afterEach(() => {
  cleanup();
  completeMock.mockReset();
  assignMock.mockReset();
  delete window.FB;
});

describe("MetaEmbeddedSignupCard", () => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, assign: assignMock },
  });

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
    expect(await screen.findByText("Cadastro concluído. O CRM confirmou a ativação do número na Cloud API.")).toBeInTheDocument();
    expect(assignMock).toHaveBeenCalledWith("/integrations/whatsapp?channel=connected");
  });

  it("mantém a ação visível e explica o bloqueio quando a configuração do servidor está indisponível", () => {
    render(<MetaEmbeddedSignupCard appId="" configId="" disabled unavailableReason="A configuração segura da Meta está incompleta: META_WHATSAPP_APP_ID." />);

    expect(screen.getByRole("button", { name: "Conectar número com Facebook" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("META_WHATSAPP_APP_ID");
  });
});
