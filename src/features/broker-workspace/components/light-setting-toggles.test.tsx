// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ consent: vi.fn(), leadToast: vi.fn(), fire: vi.fn() }));
vi.mock("@/features/ai-gateway/consent-actions", () => ({ decideAiConsentAction: mocks.consent }));
vi.mock("@/app/(dashboard)/notificacoes/actions", () => ({ setLeadToastEnabledAction: mocks.leadToast }));
vi.mock("@/components/providers/realtime-sync-provider", () => ({ LEAD_TOAST_PREFERENCE_EVENT: "lead-toast-pref" }));
vi.mock("@/lib/feedback/use-feedback", () => ({ useFeedback: () => mocks.fire }));

import { LightAiConsentToggle } from "./light-ai-consent-toggle";
import { LightLeadToastToggle } from "./light-lead-toast-toggle";

afterEach(() => cleanup());
beforeEach(() => {
  mocks.consent.mockReset().mockResolvedValue({ ok: true });
  mocks.leadToast.mockReset().mockResolvedValue(undefined);
  mocks.fire.mockReset();
});

describe("configurações do Lite (nível 1)", () => {
  it("IA: confirma no próprio controle depois do servidor", async () => {
    render(<LightAiConsentToggle initialGranted={false} />);
    await act(async () => { fireEvent.click(screen.getByRole("switch", { name: "Usar IA nas tarefas" })); });
    expect(mocks.consent).toHaveBeenCalledWith("granted");
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("IA ligada"));
    expect(mocks.fire).toHaveBeenCalledWith("confirm");
  });

  it("IA: falha volta o interruptor, diz o que vale e tenta de novo", async () => {
    mocks.consent.mockResolvedValueOnce({ ok: false });
    render(<LightAiConsentToggle initialGranted={false} />);
    await act(async () => { fireEvent.click(screen.getByRole("switch", { name: "Usar IA nas tarefas" })); });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Não deu para salvar. A IA continua desligada."));
    expect(screen.getByRole("switch", { name: "Usar IA nas tarefas" }).getAttribute("aria-checked")).toBe("false");
    expect(mocks.fire).toHaveBeenCalledWith("error");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" })); });
    expect(mocks.consent).toHaveBeenLastCalledWith("granted");
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("IA ligada"));
  });

  it("pop-up de lead: erro técnico nunca aparece e o aviso volta ao que era", async () => {
    mocks.leadToast.mockRejectedValueOnce(new TypeError("Cannot read properties of undefined"));
    render(<LightLeadToastToggle initialEnabled />);
    await act(async () => { fireEvent.click(screen.getByRole("switch", { name: "Mostrar pop-up de novo lead" })); });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Não deu para salvar esse aviso. O pop-up continua ligado."));
    expect(screen.getByRole("switch", { name: "Mostrar pop-up de novo lead" }).getAttribute("aria-checked")).toBe("true");
  });
});
