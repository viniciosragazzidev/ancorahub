// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("@/components/ui/sonner", () => ({ toast }));
const actions = vi.hoisted(() => ({
  createChecklistTemplateAction: vi.fn(async () => ({})),
  toggleChecklistTemplateAction: vi.fn(async () => ({ success: true })),
  deleteChecklistTemplateAction: vi.fn(async () => ({ success: true })),
}));
vi.mock("@/features/leads/checklist-actions", () => actions);

import { FeedbackTemplatesLite } from "./feedback-templates-lite";

const TEMPLATES = [
  { id: "t1", name: "Primeiro contato", description: "Ligação inicial", active: true, items: [{ id: "i1", sortOrder: 0, question: "Conseguiu falar com o cliente?", answerType: "boolean", options: null, required: true }] },
  { id: "t2", name: "Retorno da proposta", description: null, active: false, items: [] },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("checklists de atendimento Lite", () => {
  it("ativa pela mesma ação e exclui só depois da confirmação", async () => {
    render(<FeedbackTemplatesLite initialTemplates={TEMPLATES} />);
    expect(screen.getByText(/Conseguiu falar com o cliente\?/)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ativar" }));
    });
    expect((actions.toggleChecklistTemplateAction.mock.calls[0] as unknown as [unknown, FormData])[1].get("templateId")).toBe("t2");
    fireEvent.click(screen.getByRole("button", { name: "Excluir Primeiro contato" }));
    expect(actions.deleteChecklistTemplateAction).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir modelo" }));
    });
    expect((actions.deleteChecklistTemplateAction.mock.calls[0] as unknown as [unknown, FormData])[1].get("templateId")).toBe("t1");
    expect(screen.queryByText("Primeiro contato")).toBeNull();
  });
});
