// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const search = vi.hoisted(() => ({ value: "" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/qualificacao", useSearchParams: () => new URLSearchParams(search.value) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("@/components/ui/sonner", () => ({ toast }));
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

  it("aba antiga redireciona e a troca de aba mostra o conteúdo certo", () => {
    search.value = "tab=mcp_governance";
    render(<QualificationHubLite {...QUALIFICATION_HUB_FIXTURE} />);
    expect(screen.getByRole("tab", { name: "Permissões" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByText("Bloqueada (crítica)").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("tab", { name: "Conectividade" }));
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
    expect(screen.getByRole("tab", { name: "Simulador (1)" })).toHaveAttribute("aria-selected", "true");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Resolver alerta" }));
    });
    expect(actions.acknowledgeAlertAction).toHaveBeenCalledWith("alert-1");
  });
});
