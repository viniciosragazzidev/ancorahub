// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  subscribe: vi.fn(),
  fire: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  browserSubscribe: vi.fn(),
}));
vi.mock("../push-actions", () => ({
  getPushPublicKeyAction: vi.fn(async () => "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U"),
  getSubscriptionStatusAction: vi.fn(async () => ({ count: 0 })),
  sendTestNotificationAction: vi.fn(),
  subscribeUserAction: mocks.subscribe,
  unsubscribeUserAction: vi.fn(),
}));
vi.mock("@/lib/feedback/use-feedback", () => ({ useFeedback: () => mocks.fire }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));

import { PushNotificationManager } from "./push-notification-manager";

beforeEach(() => {
  mocks.subscribe.mockReset().mockResolvedValue({ success: true });
  mocks.fire.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.toastError.mockReset();
  mocks.browserSubscribe.mockReset().mockResolvedValue({ toJSON: () => ({}) });
  const registration = { pushManager: { getSubscription: vi.fn(async () => null), subscribe: mocks.browserSubscribe } };
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { ready: Promise.resolve(registration) } });
  Object.defineProperty(window, "PushManager", { configurable: true, value: function PushManager() {} });
  Object.defineProperty(window, "Notification", { configurable: true, value: { permission: "default" } });
});
afterEach(() => cleanup());

async function renderCompact() {
  render(<PushNotificationManager variant="compact" />);
  return screen.findByRole("button", { name: /Ativar/ });
}

describe("push no Lite (nível 1)", () => {
  it("ativar confirma no lugar do aviso, sem toast", async () => {
    const button = await renderCompact();
    await act(async () => { fireEvent.click(button); });
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Notificações ativadas neste aparelho."));
    expect(mocks.fire).toHaveBeenCalledWith("confirm");
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("falha mostra a causa, o que continua valendo e tentar de novo", async () => {
    mocks.subscribe.mockResolvedValueOnce({ success: false, error: "Assinatura inválida." });
    const button = await renderCompact();
    await act(async () => { fireEvent.click(button); });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Assinatura inválida. As notificações continuam desligadas neste aparelho."));
    expect(screen.getByRole("button", { name: /Tentar de novo/ })).toBeTruthy();
    expect(mocks.fire).toHaveBeenCalledWith("error");
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
