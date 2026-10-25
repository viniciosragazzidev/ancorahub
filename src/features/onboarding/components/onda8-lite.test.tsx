// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Onda 8 (diretor com a chave): validador, guia, webhook, assinatura e boas-vindas no visual Lite. Com a chave
 * desligada, cada tela atual segue com o mesmo HTML (snapshot gerado a partir do arquivo original).
 */
const mocks = vi.hoisted(() => ({ push: vi.fn(), dismiss: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: vi.fn(), replace: vi.fn() }), usePathname: () => "/welcome" }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/features/onboarding/actions/dismiss-tenant-onboarding", () => ({ dismissTenantOnboarding: mocks.dismiss }));

import { PaymentProofValidatorLite } from "@/features/payment-proof-validator/components/payment-proof-validator-lite";
import { SystemGuideLite } from "@/features/guide/components/system-guide-lite";
import { WebhookTutorialLite } from "@/app/(dashboard)/guia/webhook/webhook-tutorial-lite";
import { SubscriptionLite } from "@/app/(dashboard)/assinatura/_components/subscription-lite";
import { WelcomeScreenLite } from "./welcome-screen-lite";
import type { TenantOnboarding } from "../types/onboarding.types";

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined }) });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

const ONBOARDING: TenantOnboarding = {
  tenantName: "Âncora Saúde",
  userName: "Marina Exemplo",
  dismissed: false,
  shouldAutoOpen: true,
  steps: [
    { id: "branches" as never, title: "Cadastrar unidades", description: "Crie as unidades da corretora.", status: "completed", href: "/equipe?visao=unidades", actionLabel: "Abrir", essential: true },
    { id: "team" as never, title: "Convidar a equipe", description: "Convide gestores e corretores.", status: "pending", href: "/equipe/convidar", actionLabel: "Convidar", essential: true },
    { id: "whatsapp" as never, title: "Conectar o WhatsApp", description: "Ligue o número da corretora.", status: "unavailable", href: null, actionLabel: null, essential: false },
  ],
  totalSteps: 3,
  availableSteps: 2,
  completedSteps: 1,
  progressPercentage: 50,
  essentialCompleted: false,
  fullyCompleted: false,
};

describe("telas da Onda 8 no visual Lite", () => {
  it("validador só libera com proposta e comprovante e mostra o resultado", () => {
    render(<PaymentProofValidatorLite />);
    const validate = screen.getByRole("button", { name: /Validar comprovante/ });
    expect(validate).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Proposta"), { target: { files: [new File(["%PDF"], "proposta.pdf", { type: "application/pdf" })] } });
    fireEvent.change(screen.getByLabelText("Comprovante de pagamento"), { target: { files: [new File(["%PDF"], "comprovante.pdf", { type: "application/pdf" })] } });
    expect(screen.getByText("proposta.pdf")).toBeInTheDocument();
    expect(validate).toBeEnabled();
  });

  it("guia filtra pelo papel e pela busca, sem caixa alta", () => {
    const { container } = render(<SystemGuideLite role="broker" />);
    expect(screen.getByText(/para Corretor/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Pesquisar no guia" }), { target: { value: "zzzz-nada" } });
    expect(screen.getByText("Não encontramos esse assunto")).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/uppercase/);
  });

  it("webhook mostra o mesmo conteúdo sem travessão", () => {
    const { container } = render(<WebhookTutorialLite />);
    expect(screen.getByText("Referência de campos")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Copiar/ })).toHaveLength(3);
    expect(container.textContent).not.toContain("—");
  });

  it("assinatura com datas no fuso de São Paulo e limite em porcentagem", () => {
    render(<SubscriptionLite tenant={{ name: "Âncora Saúde", legalName: null, cnpj: null, status: "active", createdAt: new Date("2025-03-01T01:00:00.000Z") }} plan={{ label: "Essencial", features: ["Até 3 usuários"] }} usage={[{ label: "Usuários ativos", value: 3, limit: 3 }]} />);
    expect(screen.getAllByText(/28 de fevereiro de 2025/).length).toBeGreaterThan(0);
    expect(screen.getByRole("meter", { name: "Usuários ativos: 100% do limite" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerenciar plano" })).toBeDisabled();
  });

  it("boas-vindas: um botão principal, progresso real e o mesmo dispensar", async () => {
    mocks.dismiss.mockResolvedValue({ success: true });
    render(<WelcomeScreenLite userName="Marina Exemplo" role="director" tenantName="Âncora Saúde" onboarding={ONBOARDING} greeting="Bom dia" />);
    expect(screen.getByRole("heading", { name: "Marina" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Continuar configuração/ }));
    expect(mocks.push).toHaveBeenCalledWith("/equipe/convidar");
    expect(screen.getByRole("progressbar", { name: "Progresso da configuração inicial" })).toHaveAttribute("aria-valuenow", "50");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Explorar o sistema agora/ })); });
    expect(mocks.dismiss).toHaveBeenCalled();
  });
});
