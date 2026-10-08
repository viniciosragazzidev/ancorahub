// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  complete: vi.fn(),
  signIn: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
vi.mock("@/components/ui/sonner", () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }));
vi.mock("@/shared/auth/client", () => ({
  authClient: { signIn: { email: mocks.signIn }, passkey: { addPasskey: vi.fn() } },
}));
vi.mock("@/app/(dashboard)/settings/security-actions", () => ({ recordSecurityAuditAction: vi.fn() }));
vi.mock("./onboarding-actions", () => ({ completeOnboardingAction: mocks.complete }));
// Arc components drive Motion springs that the global jsdom mock of motion/react does not implement.
vi.mock("@/components/arc/button/button", () => ({
  Button: ({ children, loading: _loading, variant: _variant, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; variant?: string }) => (
    <button type="button" {...props}>{children}</button>
  ),
}));
vi.mock("@/components/arc/input/input", () => ({
  Input: ({ label, description: _description, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; description?: string }) => (
    <label>{label}<input {...props} /></label>
  ),
}));
vi.mock("@/components/arc/password-field/password-field", () => ({
  PasswordField: ({ label, messages: _messages, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; messages?: unknown }) => (
    <label>{label}<input type="password" {...props} /></label>
  ),
}));
vi.mock("@/components/arc/stepper/stepper", () => ({
  Stepper: ({ steps, current }: { steps: Array<{ label: string }>; current: number }) => <p>Etapa {current + 1} de {steps.length}</p>,
}));

import { OnboardingWizard } from "./onboarding-wizard";

const invitation = { id: "inv-1", email: "ana@example.test", tenantName: "Corretora", branchName: "Centro" };
const profile = { professionalName: "Ana Souza", phone: "21999990000", cpf: "111.222.333-44", internalCode: "AB12" };

function next(name: string | RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("OnboardingWizard", () => {
  it("starts on the profile step with the invitation data and the stepper", () => {
    render(<OnboardingWizard invitation={invitation} profile={profile} />);

    expect(screen.getByRole("heading", { level: 1, name: "Confirme seu perfil profissional" })).toBeTruthy();
    expect(screen.getByText("Etapa 1 de 5")).toBeTruthy();
    expect(screen.getByText(/Vínculo com Corretora · Unidade Centro/)).toBeTruthy();
  });

  it("blocks a CPF that does not match the profile and a missing birth date", () => {
    render(<OnboardingWizard invitation={invitation} profile={profile} />);
    next("Confirmar dados");

    fireEvent.change(screen.getByLabelText("CPF (opcional)"), { target: { value: "999.999.999-99" } });
    next("Validar dados");
    expect(mocks.toastError).toHaveBeenCalledWith("O CPF digitado não coincide com o CPF cadastrado para o perfil.");

    fireEvent.change(screen.getByLabelText("CPF (opcional)"), { target: { value: "" } });
    next("Validar dados");
    expect(mocks.toastError).toHaveBeenCalledWith("Por favor, informe sua data de nascimento.");
  });

  it("checks the password length and the confirmation before the terms", () => {
    render(<OnboardingWizard invitation={invitation} profile={profile} />);
    next("Confirmar dados");
    fireEvent.change(screen.getByLabelText("Data de nascimento"), { target: { value: "1990-05-10" } });
    next("Validar dados");

    fireEvent.change(screen.getByLabelText("Senha de acesso"), { target: { value: "a" } });
    next("Confirmar senha");
    expect(mocks.toastError).toHaveBeenCalledWith(expect.stringMatching(/A senha deve ter no mínimo/));

    fireEvent.change(screen.getByLabelText("Senha de acesso"), { target: { value: "SenhaForte#12345" } });
    fireEvent.change(screen.getByLabelText("Confirme sua senha"), { target: { value: "outra" } });
    next("Confirmar senha");
    expect(mocks.toastError).toHaveBeenCalledWith("As senhas não coincidem.");
  });

  it("activates the account with the same fields, signs in and offers the biometrics step", async () => {
    mocks.complete.mockResolvedValue({ success: true, email: "ana@example.test" });
    mocks.signIn.mockResolvedValue({ error: null });
    render(<OnboardingWizard invitation={invitation} profile={profile} />);

    next("Confirmar dados");
    fireEvent.change(screen.getByLabelText("Data de nascimento"), { target: { value: "1990-05-10" } });
    next("Validar dados");
    fireEvent.change(screen.getByLabelText("Senha de acesso"), { target: { value: "SenhaForte#12345" } });
    fireEvent.change(screen.getByLabelText("Confirme sua senha"), { target: { value: "SenhaForte#12345" } });
    next("Confirmar senha");

    // The terms checkbox is required: the browser itself blocks the submit until it is checked.
    fireEvent.click(screen.getByRole("button", { name: "Concluir e ativar" }));
    expect(mocks.complete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText(/Li e aceito os termos/));
    fireEvent.click(screen.getByRole("button", { name: "Concluir e ativar" }));

    await waitFor(() => expect(mocks.complete).toHaveBeenCalledTimes(1));
    const formData = mocks.complete.mock.calls[0][1] as FormData;
    expect(formData.get("invitationId")).toBe("inv-1");
    expect(formData.get("birthDate")).toBe("1990-05-10");
    expect(formData.get("termsAccepted")).toBe("on");
    await waitFor(() => expect(screen.getByRole("heading", { name: "Acesso com biometria" })).toBeTruthy());
    expect(mocks.signIn).toHaveBeenCalledWith({ email: "ana@example.test", password: "SenhaForte#12345" });
  });
});
