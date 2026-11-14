// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("@/components/ui/sonner", () => ({ toast }));
const fire = vi.hoisted(() => vi.fn(() => ({ motion: false, celebrate: false })));
vi.mock("@/lib/feedback/use-feedback", () => ({ useFeedback: () => fire }));
const auth = vi.hoisted(() => ({
  twoFactor: { enable: vi.fn(), disable: vi.fn(), generateBackupCodes: vi.fn() },
  passkey: { listUserPasskeys: vi.fn(async () => ({ data: [] })), addPasskey: vi.fn(), updatePasskey: vi.fn(), deletePasskey: vi.fn() },
}));
vi.mock("@/shared/auth/client", () => ({ authClient: auth }));
vi.mock("../../security-actions", () => ({ recordSecurityAuditAction: vi.fn(async () => undefined) }));

import { SecurityLite } from "./security-lite";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function typePasswordAndEnable() {
  fireEvent.change(screen.getByLabelText("Senha atual"), { target: { value: "segredo" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Ativar duas etapas" }));
  });
}

describe("segurança Lite", () => {
  it("ativar 2FA confirma na seção depois do servidor, sem toast", async () => {
    auth.twoFactor.enable.mockResolvedValueOnce({ data: { method: "totp", totpURI: "otpauth://totp/x?secret=ABC", backupCodes: ["c1"] } });
    render(<SecurityLite enabled={false} email="ana@exemplo.com" />);
    await typePasswordAndEnable();
    expect(screen.getByText("2FA ativado. Guarde seus códigos de recuperação.")).toBeInTheDocument();
    expect(fire).toHaveBeenCalledWith("confirm");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("falha do 2FA mostra a causa em português, o que continua e Tentar de novo", async () => {
    auth.twoFactor.enable.mockResolvedValueOnce({ error: { message: "Invalid password" } });
    render(<SecurityLite enabled={false} email="ana@exemplo.com" />);
    await typePasswordAndEnable();
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível ativar o 2FA. A conta continua sem duas etapas.");
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
    expect(fire).toHaveBeenCalledWith("error");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("cadastrar biometria confirma na lista", async () => {
    auth.passkey.addPasskey.mockResolvedValueOnce({ data: {} });
    render(<SecurityLite enabled={false} email="ana@exemplo.com" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cadastrar biometria" }));
    });
    expect(screen.getByText("Biometria cadastrada")).toBeInTheDocument();
    expect(auth.passkey.listUserPasskeys).toHaveBeenCalledTimes(2);
    expect(toast.success).not.toHaveBeenCalled();
  });
});
