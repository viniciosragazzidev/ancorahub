// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AcoesLead, opcoesDeEtapa, validarPedido } from "../../../apps/browser-extension/src/panel/acoes-lead";
import { requisicaoDaAcao, resultadoDaAcao } from "../../../apps/browser-extension/src/content/acoes";
import type { LeadAmpliado } from "../../../apps/browser-extension/src/shared/types";

// Dados falsos.
const LEAD: LeadAmpliado = { id: "lead-falso-0001", version: 4, name: "Cliente Exemplo", phoneMasked: "(11) 9****-0000", etapa: "Em atendimento", etapaId: "in_contact" };

describe("etapas válidas e regras antes de enviar", () => {
  it("só oferece as etapas que o CRM aceita a partir da atual", () => {
    const ids = opcoesDeEtapa("in_contact").map((opcao) => opcao.id);
    expect(ids).toContain("lost");
    expect(ids).not.toContain("new");
    expect(opcoesDeEtapa(undefined)).toEqual([]);
    expect(opcoesDeEtapa("etapa-inventada")).toEqual([]);
  });

  it("perda exige motivo; nota e tarefa vazias são recusadas", () => {
    expect(validarPedido({ tipo: "etapa", statusId: "lost" })).toMatch(/motivo da perda/);
    expect(validarPedido({ tipo: "etapa", statusId: "lost", motivoPerda: "preco" })).toBeNull();
    expect(validarPedido({ tipo: "nota", conteudo: "   " })).toMatch(/nota/);
    expect(validarPedido({ tipo: "tarefa", titulo: "ab" })).toMatch(/3 letras/);
  });
});

describe("seção de ações da gaveta", () => {
  afterEach(cleanup);

  it("perda sem motivo não envia e mostra o aviso", async () => {
    const acao = vi.fn(async () => ({ ok: true as const }));
    render(<AcoesLead lead={LEAD} acao={acao} />);
    fireEvent.change(screen.getByLabelText("Mudar etapa"), { target: { value: "lost" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar etapa" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/motivo da perda/);
    expect(acao).not.toHaveBeenCalled();
  });

  it("perda com motivo envia a etapa e o motivo", async () => {
    const acao = vi.fn(async () => ({ ok: true as const }));
    render(<AcoesLead lead={LEAD} acao={acao} />);
    fireEvent.change(screen.getByLabelText("Mudar etapa"), { target: { value: "lost" } });
    fireEvent.change(screen.getByLabelText("Motivo da perda"), { target: { value: "preco" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar etapa" }));
    await waitFor(() => expect(acao).toHaveBeenCalledWith({ tipo: "etapa", statusId: "lost", motivoPerda: "preco" }));
  });

  it("nota vazia não envia; nota preenchida envia o texto", async () => {
    const acao = vi.fn(async () => ({ ok: true as const }));
    render(<AcoesLead lead={LEAD} acao={acao} />);
    fireEvent.click(screen.getByRole("button", { name: "Salvar nota" }));
    expect(acao).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Nota interna"), { target: { value: "Pediu retorno na semana." } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nota" }));
    await waitFor(() => expect(acao).toHaveBeenCalledWith({ tipo: "nota", conteudo: "Pediu retorno na semana." }));
  });

  it("retorno com preset envia o lembrete", async () => {
    const acao = vi.fn(async () => ({ ok: true as const }));
    render(<AcoesLead lead={LEAD} acao={acao} />);
    fireEvent.click(screen.getByRole("button", { name: "Amanhã às 9h" }));
    await waitFor(() => expect(acao).toHaveBeenCalledWith({ tipo: "lembrete", when: "tomorrow" }));
  });

  it("conflito de versão mostra o aviso para recarregar", async () => {
    const acao = vi.fn(async () => ({ ok: false as const, conflito: true, mensagem: "Este lead mudou em outro lugar. Atualizamos a tela." }));
    render(<AcoesLead lead={LEAD} acao={acao} />);
    fireEvent.change(screen.getByLabelText("Nota interna"), { target: { value: "Nota qualquer" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nota" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Atualizamos a tela/);
  });
});

describe("tradução dos pedidos e dos resultados", () => {
  it("mudança de etapa usa PATCH com a versão mostrada na tela e o motivo", () => {
    expect(requisicaoDaAcao(LEAD, { tipo: "etapa", statusId: "lost", motivoPerda: "preco" })).toEqual({
      path: "/api/extension/leads/lead-falso-0001/status", metodo: "PATCH", corpo: { statusId: "lost", expectedVersion: 4, motivoPerda: "preco" },
    });
  });

  it("nota, tarefa e lembrete usam as rotas do servidor com a mesma versão", () => {
    expect(requisicaoDaAcao(LEAD, { tipo: "nota", conteudo: "x" }).path).toMatch(/\/notes$/);
    expect(requisicaoDaAcao(LEAD, { tipo: "tarefa", titulo: "Enviar proposta" }).corpo).toEqual({ title: "Enviar proposta", expectedVersion: 4 });
    expect(requisicaoDaAcao(LEAD, { tipo: "lembrete", when: "today" }).corpo).toEqual({ when: "today", expectedVersion: 4 });
  });

  it("resultado: 409 pede recarga; erros não mostram detalhe técnico", () => {
    expect(resultadoDaAcao(200)).toEqual({ ok: true });
    expect(resultadoDaAcao(409)).toMatchObject({ ok: false, conflito: true });
    expect(resultadoDaAcao(403).mensagem).toMatch(/permissão/);
    expect(resultadoDaAcao(404).mensagem).toMatch(/não está disponível/);
    expect(resultadoDaAcao(0).mensagem).toMatch(/Sem conexão/);
    expect(resultadoDaAcao(500).mensagem).not.toMatch(/Error|stack|SQL/);
  });
});
