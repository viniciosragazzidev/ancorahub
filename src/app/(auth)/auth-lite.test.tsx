// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

/*
 * Telas de acesso no visual Lite (Onda 8, para todo mundo): os mesmos campos, nomes e chamadas de antes.
 * Só a aparência mudou; aqui conferimos que cada formulário continua ligado ao mesmo handler.
 */
const mocks = vi.hoisted(() => ({
  verifyTotp: vi.fn(),
  verifyBackupCode: vi.fn(),
  signInEmail: vi.fn(),
  passkey: vi.fn(),
  acceptInvite: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh, push: vi.fn() }) }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/shared/auth/client", () => ({
  authClient: { twoFactor: { verifyTotp: mocks.verifyTotp, verifyBackupCode: mocks.verifyBackupCode }, signIn: { passkey: mocks.passkey } },
  signIn: { email: mocks.signInEmail },
}));
vi.mock("./invite/accept/actions", () => ({ acceptInviteAction: mocks.acceptInvite }));

import TwoFactorPage from "./2fa/page";
import AcceptInvitePage from "./invite/accept/page";
import AdminLoginPage from "./admin/login/page";
import VerifyPage from "./verify/page";
import AccessDeniedPage from "./access-denied/page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("2FA no visual Lite", () => {
  it("envia só os dígitos do código com a escolha de confiar no aparelho", async () => {
    mocks.verifyTotp.mockResolvedValue({ error: null });
    render(<TwoFactorPage />);
    fireEvent.change(screen.getByLabelText("Código de 6 dígitos"), { target: { value: "12 34 56" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Confiar neste dispositivo por 30 dias" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Confirmar e entrar" })); });
    expect(mocks.verifyTotp).toHaveBeenCalledWith({ code: "123456", trustDevice: true });
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("troca para o código de recuperação e mostra o erro do servidor", async () => {
    mocks.verifyBackupCode.mockResolvedValue({ error: { message: "Código inválido." } });
    render(<TwoFactorPage />);
    fireEvent.click(screen.getByRole("button", { name: "Usar código de recuperação" }));
    fireEvent.change(screen.getByLabelText("Código de recuperação"), { target: { value: " ABCD-EFGH " } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Confirmar e entrar" })); });
    expect(mocks.verifyBackupCode).toHaveBeenCalledWith({ code: "ABCD-EFGH", trustDevice: false });
    expect(await screen.findByRole("alert")).toHaveTextContent("Código inválido.");
  });
});

describe("convite no visual Lite", () => {
  it("manda o token da URL e a senha para a mesma action", async () => {
    window.history.replaceState(null, "", "/invite/accept?token=abc123");
    mocks.acceptInvite.mockResolvedValue({ error: "Convite expirado" });
    render(<AcceptInvitePage />);
    const password = screen.getByLabelText("Senha") as HTMLInputElement;
    expect(password).toHaveAttribute("name", "password");
    expect(password).toHaveAttribute("minLength", "8");
    fireEvent.change(password, { target: { value: "senha-segura" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Ativar acesso" })); });
    const form = mocks.acceptInvite.mock.calls[0]?.[0] as FormData;
    expect(form.get("token")).toBe("abc123");
    expect(form.get("password")).toBe("senha-segura");
  });
});

describe("super admin no visual Lite", () => {
  it("entra com e-mail e senha pelo mesmo signIn.email", async () => {
    mocks.signInEmail.mockResolvedValue({ error: { message: "Credenciais inválidas" } });
    render(<AdminLoginPage />);
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "time@corretop.example" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "segredo" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Entrar como super admin" })); });
    await waitFor(() => expect(mocks.signInEmail).toHaveBeenCalled());
    expect(mocks.signInEmail.mock.calls[0]?.[0]).toEqual({ email: "time@corretop.example", password: "segredo" });
    expect(await screen.findByRole("alert")).toHaveTextContent("Credenciais inválidas");
    expect(screen.getByRole("button", { name: "Entrar com passkey" })).toBeInTheDocument();
  });
});

describe("avisos de acesso", () => {
  it("verify não usa mais cor clara de tema escuro e access-denied volta ao login", () => {
    render(<><VerifyPage /><AccessDeniedPage /></>);
    expect(screen.getByRole("heading", { name: "Verifique seu e-mail" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar ao login" })).toHaveAttribute("href", "/login");
    const source = readFileSync(join(process.cwd(), "src", "app", "(auth)", "verify", "page.tsx"), "utf8");
    expect(source).not.toMatch(/#[0-9a-f]{3,8}/i);
  });
});
