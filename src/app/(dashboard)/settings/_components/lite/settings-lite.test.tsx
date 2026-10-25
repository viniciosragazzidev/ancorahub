// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const search = vi.hoisted(() => ({ value: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search.value), usePathname: () => "/settings", useRouter: () => ({ refresh: vi.fn() }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("@/components/ui/sonner", () => ({ toast }));
const actions = vi.hoisted(() => ({
  updateFeedbackSettingsAction: vi.fn(async () => ({ success: true })),
  createIntegrationAction: vi.fn(async () => ({ success: true })),
  toggleIntegrationAction: vi.fn(async () => ({ success: true })),
  revokeIntegrationAction: vi.fn(async () => undefined),
  updateAiStageModeAction: vi.fn(async () => ({ success: true })),
}));
vi.mock("../../feedback-actions", () => ({ updateFeedbackSettingsAction: actions.updateFeedbackSettingsAction }));
vi.mock("../../integrations-actions", () => ({ createIntegrationAction: actions.createIntegrationAction, toggleIntegrationAction: actions.toggleIntegrationAction, revokeIntegrationAction: actions.revokeIntegrationAction }));
vi.mock("@/features/conversation-intelligence/actions", () => ({ updateAiStageModeAction: actions.updateAiStageModeAction }));
vi.mock("@/components/arc/radio-cards/radio-cards", () => ({
  RadioCards: ({ options, value, onValueChange }: { options: { value: string; label: string }[]; value: string; onValueChange: (value: string) => void }) => (
    <div role="radiogroup">{options.map((option) => <button key={option.value} type="button" role="radio" aria-checked={option.value === value} onClick={() => onValueChange(option.value)}>{option.label}</button>)}</div>
  ),
}));

import { FeedbackLite, StageModeLite } from "./atendimento-lite";
import { IntegrationsLite } from "./integrations-lite";
import { SettingsLite, type SettingsLiteSection } from "./settings-lite";
import { UnitLite } from "./unit-lite";

const sections: SettingsLiteSection[] = [
  { id: "conta", title: "Minha conta", description: "Seus dados", node: <p>conteúdo da conta</p> },
  { id: "empresa", title: "Empresa", description: "Identidade", node: <p>conteúdo da empresa</p> },
  { id: "seguranca", title: "Segurança", description: "2FA e chaves", node: <p>conteúdo da segurança</p> },
];

afterEach(() => {
  cleanup();
  search.value = "";
  vi.clearAllMocks();
});

describe("/settings Lite", () => {
  it("lista as seções que o servidor mandou e abre a primeira sem ?tab", () => {
    render(<SettingsLite sections={sections} />);
    const nav = within(screen.getByRole("navigation", { name: "Seções das configurações" }));
    expect(nav.getAllByRole("button").map((button) => button.textContent)).toEqual(["Minha contaSeus dados", "EmpresaIdentidade", "Segurança2FA e chaves"]);
    expect(nav.getByRole("button", { name: /Minha conta/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("conteúdo da conta")).toBeInTheDocument();
  });

  it("segue o ?tab= e tab=passkey abre Segurança", () => {
    search.value = "tab=passkey";
    render(<SettingsLite sections={sections} />);
    expect(screen.getByRole("heading", { name: "Segurança" })).toBeInTheDocument();
    expect(screen.getByText("conteúdo da segurança")).toBeInTheDocument();
  });

  it("trocar de seção mostra só a escolhida", () => {
    render(<SettingsLite sections={sections} />);
    fireEvent.click(screen.getByRole("button", { name: /Empresa/ }));
    expect(screen.getByText("conteúdo da empresa")).toBeInTheDocument();
    expect(screen.queryByText("conteúdo da conta")).toBeNull();
  });

  it("atendimento envia o mesmo formulário e respeita canEdit", async () => {
    const { unmount } = render(<FeedbackLite feedbackReminderInterval="30" feedbackReminderMaxAttempts={5} feedbackPushEnabled feedbackToastEnabled={false} feedbackRequiredEnabled maxActiveLeadsLimit={10} canEdit />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar configuração" }));
    });
    const data = (actions.updateFeedbackSettingsAction.mock.calls[0] as unknown as [unknown, FormData])[1];
    expect(data.get("feedbackReminderInterval")).toBe("30");
    expect(data.get("feedbackPushEnabled")).toBe("true");
    expect(data.get("feedbackToastEnabled")).toBeNull();
    expect(data.get("maxActiveLeadsLimit")).toBe("10");
    unmount();
    render(<FeedbackLite feedbackReminderInterval="30" feedbackReminderMaxAttempts={5} feedbackPushEnabled feedbackToastEnabled feedbackRequiredEnabled maxActiveLeadsLimit={10} canEdit={false} />);
    expect(screen.queryByRole("button", { name: "Salvar configuração" })).toBeNull();
    expect(screen.getByRole("spinbutton", { name: /Intervalo entre lembretes/ })).toBeDisabled();
  });

  it("etapa pela IA volta ao valor anterior se a ação falhar", async () => {
    actions.updateAiStageModeAction.mockResolvedValueOnce({ success: false, error: "Sem permissão." } as never);
    render(<StageModeLite initialMode="suggest" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("radio", { name: "Automático" }));
    });
    expect(actions.updateAiStageModeAction).toHaveBeenCalledWith("auto");
    expect(toast.error).toHaveBeenCalledWith("Sem permissão.");
    expect(screen.getByRole("radio", { name: "Só sugerir" })).toHaveAttribute("aria-checked", "true");
  });

  it("unidade sem filial aponta para a Central de Distribuição", () => {
    render(<UnitLite branch={null} />);
    expect(screen.getByRole("link", { name: /Central de Distribuição/ })).toHaveAttribute("href", "/distribuicao?view=filas");
  });

  it("integrações: alterna o recebimento e revoga só depois da confirmação Lite", async () => {
    const integration = { id: "11111111-1111-4111-8111-111111111111", name: "Landing page Centro", source: "landing_page", branchId: null, branchName: null, status: "active" as const, tokenPrefix: "lp_abc", createdAt: new Date("2026-10-20T12:00:00Z") };
    render(<IntegrationsLite integrations={[integration]} branches={[{ id: "b1", name: "Centro" }]} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Desativar" }));
    });
    expect((actions.toggleIntegrationAction.mock.calls[0] as unknown as [FormData])[0].get("id")).toBe(integration.id);
    fireEvent.click(screen.getByRole("button", { name: "Revogar integração" }));
    expect(actions.revokeIntegrationAction).not.toHaveBeenCalled();
    const dialog = screen.getByRole("alertdialog", { name: "Revogar esta integração?" });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Revogar integração" }));
    });
    expect(actions.revokeIntegrationAction).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledWith("Integração revogada.");
  });
});
