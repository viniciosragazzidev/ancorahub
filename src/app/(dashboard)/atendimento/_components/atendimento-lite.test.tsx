// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("@/components/ui/sonner", () => ({ toast }));
const actions = vi.hoisted(() => ({
  testPhraseAction: vi.fn(async () => ({ success: true, result: { kind: "custom", label: "Atende em Niterói", response: "Sim, atendemos.", action: "Responde e segue" } })),
  setAutoActivateAction: vi.fn(async () => ({ success: true })),
  saveQualificationFlowAction: vi.fn(async () => ({ success: true })),
}));
vi.mock("@/features/attendance-situations/actions", () => ({ testPhraseAction: actions.testPhraseAction }));
vi.mock("@/features/situation-learning/actions", () => ({ setAutoActivateAction: actions.setAutoActivateAction }));
vi.mock("@/features/qualification-flow/actions", () => ({ saveQualificationFlowAction: actions.saveQualificationFlowAction }));
vi.mock("../situacoes/_components/situation-drawer", () => ({ SituationDrawer: ({ target }: { target: { mode: string } | null }) => (target ? <div role="dialog" aria-label={`situação ${target.mode}`} /> : null) }));
vi.mock("../situacoes/_components/suggestion-drawer", () => ({ SuggestionDrawer: () => null, formatAskedAt: () => "há 2 dias" }));
vi.mock("../mensagens/_components/message-drawer", () => ({ MessageDrawer: ({ target }: { target: { mode: string } | null }) => (target ? <div role="dialog" aria-label={`mensagem ${target.mode}`} /> : null) }));
vi.mock("../../qualificacao/_components/message-policies-panel", () => ({ MessagePoliciesPanel: () => <p>painel de políticas</p> }));
vi.mock("../../integrations/whatsapp/_components/template-builder-wizard", () => ({ TemplateBuilderWizard: () => <p>assistente de template</p> }));
vi.mock("@/components/arc/switch/switch", () => ({
  Switch: ({ checked, onCheckedChange, ...props }: { checked: boolean; onCheckedChange: (value: boolean) => void } & Record<string, unknown>) => (
    <button type="button" role="switch" aria-checked={checked} aria-label={props["aria-label"] as string} onClick={() => onCheckedChange(!checked)} />
  ),
}));

import { FlowEditorLite } from "../fluxo/_components/flow-editor-lite";
import { MessagesWorkspaceLite } from "../mensagens/_components/messages-workspace-lite";
import { SituationsWorkspaceLite } from "../situacoes/_components/situations-workspace-lite";
import { QUALIFICATION_FIELDS } from "@/features/qualification-flow/domain";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const situation = (id: string, kind: "builtin" | "custom" | "guided", title: string) => ({ id, key: id, kind, title, response: "Resposta", phrases: [], recognizedBy: ["exemplo"], action: "reply_continue", enabled: true, critical: false }) as never;

describe("atendimento Lite", () => {
  it("situações: chips de tipo filtram, o teste de frase usa a mesma ação e a linha abre o painel", async () => {
    render(<SituationsWorkspaceLite situations={[situation("s1", "builtin", "Fora de área"), situation("s2", "custom", "Atende em Niterói")]} learning={{ suggestions: [], coverage: { percent: 80, covered: 8, total: 10 }, autoActivate: false }} autoActivatedKeys={[]} canConfigure />);
    const table = () => document.querySelector('[data-lite="table"]') as HTMLElement;
    expect(within(table()).getAllByRole("row")).toHaveLength(3);
    fireEvent.click(within(screen.getByRole("group", { name: "Filtrar por tipo" })).getByRole("button", { name: /Da empresa/ }));
    expect(within(table()).getAllByRole("row")).toHaveLength(2);
    fireEvent.change(screen.getByRole("textbox", { name: "Frase do cliente" }), { target: { value: "vocês atendem em Niterói?" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Testar frase" }));
    });
    expect(actions.testPhraseAction).toHaveBeenCalledWith("vocês atendem em Niterói?");
    expect(screen.getByText("Sim, atendemos.")).toBeInTheDocument();
    fireEvent.click(within(table()).getByText("Atende em Niterói"));
    expect(screen.getByRole("dialog", { name: "situação view" })).toBeInTheDocument();
  });

  it("situações: sem permissão de configurar, a ativação automática fica travada", () => {
    render(<SituationsWorkspaceLite situations={[]} learning={{ suggestions: [], coverage: { percent: null, covered: 0, total: 0 }, autoActivate: true }} autoActivatedKeys={[]} canConfigure={false} />);
    expect(screen.getByRole("checkbox", { name: /Ativar sugestões automaticamente/ })).toBeDisabled();
    expect(screen.getByText(/Só o Diretor altera/)).toBeInTheDocument();
  });

  it("mensagens: nova mensagem escolhe entre texto livre e template da Meta", () => {
    render(<MessagesWorkspaceLite messages={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Nova mensagem" }));
    fireEvent.click(screen.getByRole("button", { name: /Texto livre/ }));
    expect(screen.getByRole("dialog", { name: "mensagem new_free" })).toBeInTheDocument();
  });

  it("fluxo: reordenar mostra a barra de alterações e salva a nova ordem", async () => {
    const [first, second] = QUALIFICATION_FIELDS.map((field) => field.key);
    render(<FlowEditorLite enabledOrder={[first!, second!]} texts={{}} canEdit />);
    expect(screen.queryByRole("region", { name: "Alterações não salvas" })).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: /^Descer / })[0]!);
    const bar = within(screen.getByRole("region", { name: "Alterações não salvas" }));
    await act(async () => {
      fireEvent.click(bar.getByRole("button", { name: "Salvar fluxo" }));
    });
    expect((actions.saveQualificationFlowAction.mock.calls[0] as unknown as [{ order: string[] }])[0].order).toEqual([second, first]);
  });

  it("fluxo: quem só lê não vê os controles", () => {
    const [first] = QUALIFICATION_FIELDS.map((field) => field.key);
    render(<FlowEditorLite enabledOrder={[first!]} texts={{}} canEdit={false} />);
    expect(screen.queryByRole("button", { name: /^Subir / })).toBeNull();
  });
});
