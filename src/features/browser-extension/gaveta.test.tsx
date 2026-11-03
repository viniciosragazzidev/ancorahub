// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Gaveta, type AcoesGaveta } from "../../../apps/browser-extension/src/panel/gaveta";
import { montarPainel } from "../../../apps/browser-extension/src/panel/main";
import type { EstadoGaveta, LeadAmpliado } from "../../../apps/browser-extension/src/shared/types";

// Dados falsos: nenhum nome, telefone ou valor real.
const LEAD: LeadAmpliado = {
  id: "lead-falso-0001",
  version: 3,
  name: "Cliente Exemplo",
  phoneMasked: "(11) 9****-0000",
  etapa: "Em atendimento",
  unidade: "Unidade Centro (falsa)",
  corretor: "Corretor Exemplo",
  proximoPasso: { titulo: "Enviar cotação", prazo: "2026-11-03T15:00:00.000Z" },
  temperatura: "quente",
  plano: "Plano Falso Bronze",
  vidas: 3,
  valorMensal: 218,
  fila: "Fila de teste",
  plantao: "Plantão falso",
  chegouEm: "2026-11-03T12:00:00.000Z",
  historico: [
    { tipo: "ligação", data: "2026-11-03T13:00:00.000Z" },
    { tipo: "mensagem", data: "2026-11-02T10:00:00.000Z" },
    { tipo: "nota", data: "2026-11-01T10:00:00.000Z" },
    { tipo: "tarefa", data: "2026-10-31T10:00:00.000Z" },
    { tipo: "ligação", data: "2026-10-30T10:00:00.000Z" },
    { tipo: "mensagem", data: "2026-10-29T10:00:00.000Z" },
  ],
};

function acoesFalsas(): AcoesGaveta & Record<"abrirNoCrm" | "respostas" | "inserir" | "conectar" | "tentarNovamente" | "fechar", ReturnType<typeof vi.fn>> {
  return {
    abrirNoCrm: vi.fn(),
    respostas: vi.fn(async () => ["Olá, posso te ajudar com a cotação?"]),
    inserir: vi.fn(),
    conectar: vi.fn(),
    tentarNovamente: vi.fn(),
    fechar: vi.fn(),
  } as never;
}

describe("gaveta: estados", () => {
  afterEach(cleanup);

  it("mostra carregando, sem lead, erro e capacidade desligada", () => {
    const acoes = acoesFalsas();
    const estados: [EstadoGaveta, RegExp][] = [
      [{ tipo: "carregando" }, /Carregando o lead/],
      [{ tipo: "sem-lead" }, /não está entre os seus leads/],
      [{ tipo: "erro" }, /Não foi possível carregar agora/],
      [{ tipo: "desligada" }, /desligado para a sua empresa/],
    ];
    for (const [estado, texto] of estados) {
      const { unmount } = render(<Gaveta estado={estado} acoes={acoes} />);
      expect(screen.getByText(texto)).toBeTruthy();
      unmount();
    }
  });

  it("sem conexão oferece conectar e chama a ação", () => {
    const acoes = acoesFalsas();
    render(<Gaveta estado={{ tipo: "sem-conexao" }} acoes={acoes} />);
    fireEvent.click(screen.getByRole("button", { name: "Conectar ao CRM" }));
    expect(acoes.conectar).toHaveBeenCalledOnce();
  });

  it("erro oferece tentar de novo", () => {
    const acoes = acoesFalsas();
    render(<Gaveta estado={{ tipo: "erro" }} acoes={acoes} />);
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(acoes.tentarNovamente).toHaveBeenCalledOnce();
  });

  it("fechar chama a ação de fechar", () => {
    const acoes = acoesFalsas();
    render(<Gaveta estado={{ tipo: "carregando" }} acoes={acoes} />);
    fireEvent.click(screen.getByRole("button", { name: "Fechar dados do lead" }));
    expect(acoes.fechar).toHaveBeenCalledOnce();
  });
});

describe("gaveta: lead", () => {
  afterEach(cleanup);

  it("mostra os campos do Lite com temperatura e valores formatados", () => {
    render(<Gaveta estado={{ tipo: "lead", lead: LEAD }} acoes={acoesFalsas()} />);
    expect(screen.getByText("Cliente Exemplo")).toBeTruthy();
    expect(screen.getByText("Quente")).toBeTruthy();
    expect(screen.getByRole("img", { name: /Temperatura: Quente/ })).toBeTruthy();
    expect(screen.getByText("Plano Falso Bronze")).toBeTruthy();
    expect(screen.getByText("R$ 218,00")).toBeTruthy();
    expect(screen.getByText("Enviar cotação")).toBeTruthy();
  });

  it("usa traço quando o servidor não enviou o campo novo", () => {
    render(<Gaveta estado={{ tipo: "lead", lead: { ...LEAD, plano: undefined, vidas: undefined, valorMensal: undefined, temperatura: undefined, historico: undefined, proximoPasso: null } }} acoes={acoesFalsas()} />);
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("Sem ação pendente")).toBeTruthy();
    expect(screen.getByText("Sem interações registradas.")).toBeTruthy();
    expect(screen.getByRole("img", { name: /Temperatura: Sem dados/ })).toBeTruthy();
  });

  it("mostra no histórico no máximo cinco itens, só tipo e data", () => {
    const { container } = render(<Gaveta estado={{ tipo: "lead", lead: LEAD }} acoes={acoesFalsas()} />);
    const itens = container.querySelectorAll(".secao ul li");
    expect(itens.length).toBe(5);
    expect(container.textContent).not.toMatch(/CPF|comiss|observa/i);
  });

  it("respostas rápidas pedem sugestão e inserem o texto, sem enviar", async () => {
    const acoes = acoesFalsas();
    render(<Gaveta estado={{ tipo: "lead", lead: LEAD }} acoes={acoes} />);
    fireEvent.click(screen.getByRole("button", { name: "Pedir dado" }));
    await waitFor(() => expect(acoes.respostas).toHaveBeenCalledWith(LEAD, "ASK_MISSING_FIELD"));
    fireEvent.click(await screen.findByRole("button", { name: "Olá, posso te ajudar com a cotação?" }));
    expect(acoes.inserir).toHaveBeenCalledWith("Olá, posso te ajudar com a cotação?");
  });

  it("abrir no CRM passa o id do lead", () => {
    const acoes = acoesFalsas();
    render(<Gaveta estado={{ tipo: "lead", lead: LEAD }} acoes={acoes} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir no CRM" }));
    expect(acoes.abrirNoCrm).toHaveBeenCalledWith("lead-falso-0001");
  });
});

describe("montarPainel no shadow root", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("monta o estilo e a gaveta, troca de estado e desmonta", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const shadow = host.attachShadow({ mode: "open" });
    const controle = montarPainel(shadow, acoesFalsas());
    expect(shadow.querySelector("style")).toBeTruthy();
    await waitFor(() => expect(shadow.textContent).toMatch(/Carregando o lead/));

    controle.atualizar({ tipo: "lead", lead: LEAD });
    await waitFor(() => expect(shadow.textContent).toMatch(/Cliente Exemplo/));

    controle.desmontar();
    await waitFor(() => expect(shadow.querySelector("aside")).toBeNull());
  });
});
