// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const search = vi.hoisted(() => ({ value: "" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/qualificacao", useSearchParams: () => new URLSearchParams(search.value) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("@/components/ui/sonner", () => ({ toast }));
const fire = vi.hoisted(() => vi.fn(() => ({ motion: false, celebrate: false })));
vi.mock("@/lib/feedback/use-feedback", () => ({ useFeedback: () => fire }));
const actions = vi.hoisted(() => ({
  updateQualificationSettingsAction: vi.fn(async () => ({})),
  toggleQualificationEnabledAction: vi.fn(async () => ({})),
  saveFollowUpRuleAction: vi.fn(async () => []),
  deleteFollowUpRuleAction: vi.fn(async () => []),
  updateToolPermissionAction: vi.fn(async () => []),
  acknowledgeAlertAction: vi.fn(async () => []),
}));
vi.mock("@/features/ai-qualification/actions", () => actions);
vi.mock("@/components/dashboard-header", () => ({ DashboardHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/features/ai-qualification/components/bulk-qualification-dialog", () => ({ BulkQualificationDialog: ({ trigger }: { trigger: React.ReactNode }) => trigger }));
vi.mock("@/features/communication-channels/components/whatsapp-test-message-card", () => ({ WhatsAppTestMessageCard: () => <div data-stub="test-message" /> }));
vi.mock("../agent-triggers-panel", () => ({ AgentTriggersPanel: () => <div data-stub="agent-triggers" /> }));
vi.mock("@/components/arc/switch/switch", () => ({
  Switch: ({ checked, onCheckedChange, ...props }: { checked: boolean; onCheckedChange: (value: boolean) => void } & Record<string, unknown>) => (
    <button type="button" role="switch" aria-checked={checked} aria-labelledby={props["aria-labelledby"] as string} onClick={() => onCheckedChange(!checked)} />
  ),
}));

import { QUALIFICATION_HUB_FIXTURE } from "../qualification-hub-fixtures";
import { QualificationHubLite } from "./qualification-hub-lite";

afterEach(() => {
  cleanup();
  search.value = "";
  vi.clearAllMocks();
});

describe("hub de qualificação Lite", () => {
  it("salva os campos da aba de prompt pela mesma ação", async () => {
    render(<QualificationHubLite {...QUALIFICATION_HUB_FIXTURE} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Nome de exibição" }), { target: { value: "Bia" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    });
    const payload = (actions.updateQualificationSettingsAction.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(payload.assistantName).toBe("Bia");
    expect(payload.timeoutMinutes).toBe(20);
    expect(payload.businessContext).toContain("Rio de Janeiro");
  });

  it("aba antiga redireciona e a aba segue a URL (a barra da área Atendimento IA troca a query)", () => {
    search.value = "tab=mcp_governance";
    const { rerender } = render(<QualificationHubLite {...QUALIFICATION_HUB_FIXTURE} />);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getAllByText("Bloqueada (crítica)").length).toBeGreaterThan(0);
    search.value = "tab=whatsapp_diag";
    rerender(<QualificationHubLite {...QUALIFICATION_HUB_FIXTURE} />);
    expect(screen.getByText("+55 21 99999-0000")).toBeInTheDocument();
  });

  it("follow-up: remover pede confirmação e usa a mesma ação", async () => {
    search.value = "tab=followup_rules";
    render(<QualificationHubLite {...QUALIFICATION_HUB_FIXTURE} />);
    fireEvent.click(screen.getByRole("button", { name: "Remover Lead abandonou a qualificação" }));
    expect(actions.deleteFollowUpRuleAction).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Remover regra" }));
    });
    expect(actions.deleteFollowUpRuleAction).toHaveBeenCalledWith("rule-1");
  });

  it("simulador: alerta ativo aparece na aba e resolve pela mesma ação", async () => {
    search.value = "tab=alerts";
    render(<QualificationHubLite {...QUALIFICATION_HUB_FIXTURE} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Resolver alerta" }));
    });
    expect(actions.acknowledgeAlertAction).toHaveBeenCalledWith("alert-1");
  });

  it("salvar: confirma no próprio botão só depois do servidor, sem toast", async () => {
    render(<QualificationHubLite {...QUALIFICATION_HUB_FIXTURE} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    });
    expect(await screen.findByText("Alterações salvas", { selector: "span:not(.sr-only)" })).toBeInTheDocument();
    expect(fire).toHaveBeenCalledWith("confirm", expect.anything());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("salvar: a falha mostra a causa em português e o que continua valendo", async () => {
    actions.updateQualificationSettingsAction.mockRejectedValueOnce(new Error("internal server error"));
    render(<QualificationHubLite {...QUALIFICATION_HUB_FIXTURE} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("As alterações não foram salvas. O que você escreveu continua aqui.");
    expect(fire).toHaveBeenCalledWith("error");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("permissão: confirma na seção e, se falhar, oferece Tentar de novo", async () => {
    search.value = "tab=agent_triggers";
    actions.updateToolPermissionAction.mockRejectedValueOnce(new Error("TypeError: cannot read undefined"));
    render(<QualificationHubLite {...QUALIFICATION_HUB_FIXTURE} />);
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: /Consultar planos: permitida/ })[0]);
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Não deu para mudar a permissão agora. Consultar planos continua permitida.");
    expect(fire).toHaveBeenCalledWith("error");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    });
    expect(actions.updateToolPermissionAction).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status")).toHaveTextContent("Consultar planos: bloqueada");
    expect(fire).toHaveBeenCalledWith("confirm");
  });

  it("follow-up: nome vazio mostra o erro no formulário, sem chamar o servidor", async () => {
    search.value = "tab=followup_rules";
    render(<QualificationHubLite {...QUALIFICATION_HUB_FIXTURE} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Adicionar regra" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Informe o nome da regra de follow-up.");
    expect(actions.saveFollowUpRuleAction).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
