// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Onda 8 com a chave desligada: validador, guia, webhook e boas-vindas seguem com o mesmo HTML. Snapshot gerado
 * com os arquivos originais, antes da conversão.
 */
const mocks = vi.hoisted(() => ({ push: vi.fn(), dismiss: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: vi.fn(), replace: vi.fn() }), usePathname: () => "/welcome" }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/features/onboarding/actions/dismiss-tenant-onboarding", () => ({ dismissTenantOnboarding: mocks.dismiss }));

import { PaymentProofValidator } from "@/features/payment-proof-validator/components/payment-proof-validator";
import { SystemGuide } from "@/features/guide/components/system-guide";
import { WebhookTutorial } from "@/app/(dashboard)/guia/webhook/webhook-tutorial";
import { WelcomeScreen } from "./welcome-screen";
import type { TenantOnboarding } from "../types/onboarding.types";

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined }) });
});

afterEach(() => {
  cleanup();
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

describe("telas atuais com a chave desligada", () => {
  it("preservam o HTML legado", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 25, 10, 0));
    const screens = [
      <PaymentProofValidator key="v" />,
      <SystemGuide key="g" role="director" />,
      <WebhookTutorial key="w" />,
      <WelcomeScreen key="b" userName="Marina Exemplo" role="director" tenantName="Âncora Saúde" onboarding={ONBOARDING} />,
    ];
    for (const element of screens) {
      const { container, unmount } = render(element);
      expect(container.innerHTML).toMatchSnapshot();
      unmount();
    }
  });
});

