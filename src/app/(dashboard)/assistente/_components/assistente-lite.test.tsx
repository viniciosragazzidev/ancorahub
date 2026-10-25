// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { consultar } = vi.hoisted(() => ({ consultar: vi.fn() }));
vi.mock("@/features/tenant-intelligence/rag/cotacao-express-actions", () => ({ consultarCotacaoExpress: consultar }));

import { AssistenteLite, richText } from "./assistente-lite";
import { matchPresetCommand, mockAssistantReply, PRESET_COMMAND_DATA } from "./assistente-model";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("modelo do assistente", () => {
  it("reconhece o comando pelo atalho ou pelo nome e responde com a ferramenta", () => {
    expect(PRESET_COMMAND_DATA).toHaveLength(6);
    expect(matchPresetCommand("/lead-resumo agora")?.command).toBe("/lead-resumo");
    expect(matchPresetCommand("quero as métricas de filiais")?.command).toBe("/metricas-filial");
    expect(mockAssistantReply("/lead-resumo", "x", "lead_ana_02").mcpToolCall.args).toMatchObject({ lead_id: "lead_ana_02" });
    expect(mockAssistantReply(undefined, "oi", "none").mcpToolCall.toolName).toBe("mcp:general_query");
  });
});

describe("AssistenteLite", () => {
  it("atalho preenche o campo, envio mostra a resposta com a ferramenta recolhida", () => {
    vi.useFakeTimers();
    render(<AssistenteLite />);
    fireEvent.click(screen.getAllByRole("button", { name: /Resumo do Lead/ })[0]!);
    const input = screen.getByRole("textbox", { name: "Mensagem para o assistente" }) as HTMLInputElement;
    expect(input.value).toContain("resumo completo do lead");
    fireEvent.click(screen.getByRole("button", { name: "Enviar mensagem" }));
    expect(screen.getByText("Executando ferramenta MCP")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(900); });
    // O texto do atalho não cita o comando: a tela atual responde pela ferramenta genérica, e a Lite também.
    expect(screen.getByText("mcp:ancora_crm_engine")).toBeInTheDocument();
    expect(screen.getByText("MCP Engine", { selector: "strong" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpar histórico da conversa" }));
    expect(screen.queryByRole("list", { name: "Mensagens" })).not.toBeInTheDocument();
  });

  it("barra abre o menu de comandos e o painel MCP se recolhe", () => {
    render(<AssistenteLite />);
    fireEvent.change(screen.getByRole("textbox", { name: "Mensagem para o assistente" }), { target: { value: "/" } });
    expect(screen.getByRole("list", { name: "Comandos de atalho MCP" })).toBeInTheDocument();
    expect(screen.getByText("Ferramentas MCP ativas")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Ocultar painel MCP/ }));
    expect(screen.queryByText("Ferramentas MCP ativas")).not.toBeInTheDocument();
  });

  it("Cotação Express consulta o servidor", async () => {
    consultar.mockResolvedValue({ status: "answered", answer: "Resposta da cotação" });
    render(<AssistenteLite />);
    fireEvent.change(screen.getByRole("textbox", { name: "Mensagem para o assistente" }), { target: { value: "/cotacao-express 2 vidas" } });
    await act(async () => { fireEvent.keyDown(screen.getByRole("textbox", { name: "Mensagem para o assistente" }), { key: "Enter" }); });
    expect(consultar).toHaveBeenCalledWith("/cotacao-express 2 vidas");
    expect(await screen.findByText("Resposta da cotação")).toBeInTheDocument();
  });

  it("negrito em **texto**", () => {
    render(<p>{richText("a **b** c")}</p>);
    expect(screen.getByText("b").tagName).toBe("STRONG");
  });
});
