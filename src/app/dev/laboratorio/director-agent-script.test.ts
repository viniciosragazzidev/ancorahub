import { describe, expect, it } from "vitest";

import { createDirectorAgent } from "@/features/agent/agent";
import { createMemoryBackend, sampleWorld } from "@/features/agent/backend-memory";
import { buildAgentTools } from "@/features/agent/tools";
import type { ToolResult } from "@/features/agent/types";

import { scriptedModel } from "./director-agent-script";

const NOW = new Date("2026-11-21T13:00:00Z");

async function ask(text: string, writesEnabled = true) {
  const backend = createMemoryBackend(sampleWorld(NOW));
  const agent = createDirectorAgent({
    model: scriptedModel(0, () => false),
    backend,
    viewer: { role: "director", viewAs: false, writesEnabled },
    firstName: "Vinicios",
    messages: [],
  });
  const result = await agent.stream({ messages: [{ role: "user", content: [{ type: "text", text }] }] });
  const steps = await result.steps;
  const calls = steps.flatMap((step) => step.toolCalls.map((call) => call.toolName));
  return { calls, text: await result.text, content: steps.flatMap((step) => step.content), backend };
}

describe("A7 e A8 com o agente real", { timeout: 20_000 }, () => {
  async function run(text: string, prepare?: (world: ReturnType<typeof sampleWorld>) => void, approve = true) {
    const world = sampleWorld(NOW);
    prepare?.(world);
    const backend = createMemoryBackend(world);
    const make = () => createDirectorAgent({ model: scriptedModel(0, () => false), backend, viewer: { role: "director", viewAs: false, writesEnabled: true }, firstName: null, messages: [] });
    const first = await make().stream({ messages: [{ role: "user", content: [{ type: "text", text }] }] });
    const steps = await first.steps;
    const calls = steps.flatMap((step) => step.toolCalls.map((call) => call.toolName));
    // Só a confirmação que espera o diretor (as automáticas já executaram).
    const request = steps.flatMap((step) => step.content).find((part) => part.type === "tool-approval-request" && !(part as { isAutomatic?: boolean }).isAutomatic) as { approvalId: string } | undefined;
    await first.text;
    if (request && approve) {
      const response = await first.response;
      const second = await make().stream({
        messages: [
          { role: "user", content: [{ type: "text", text }] },
          ...response.messages,
          { role: "tool", content: [{ type: "tool-approval-response", approvalId: request.approvalId, approved: true }] },
        ],
      });
      await second.text;
    }
    return { backend, world, calls, asked: Boolean(request) };
  }

  it("A7: a Carla faltou hoje (pede confirmação, marca, Desfazer tira a falta)", async () => {
    const { world, calls, asked, backend } = await run("A Carla faltou hoje");
    expect(calls).toEqual(["pessoas_buscar", "plantao_marcar_falta"]);
    expect(asked).toBe(true);
    expect(world.presence?.["s-manha:2026-11-21|u-carla"]).toBe("absent");
    expect(backend.actions[0]?.undo).toMatchObject({ tool: "plantao_marcar_falta", input: { falta: false } });
  });

  it("A7: tirar a falta", async () => {
    const { world } = await run("Tira a falta da Carla", (w) => { w.presence = { "s-manha:2026-11-21|u-carla": "absent" }; });
    expect(world.presence?.["s-manha:2026-11-21|u-carla"]).toBe("pending");
  });

  it("A8: libera a presença com o motivo dito pelo diretor (sem Desfazer)", async () => {
    const { world, backend } = await run("Libera a presença do Bruno, ele está aqui", (w) => { w.presence = { "s-manha:2026-11-21|u-bruno": "pending" }; });
    expect(world.presence?.["s-manha:2026-11-21|u-bruno"]).toBe("confirmed");
    expect(backend.actions[0]).toMatchObject({ tool: "plantao_liberar_presenca", status: "done", undo: null });
  });

  it("A11: de quem é a vez (leitura)", async () => {
    const { calls, backend } = await run("De quem é a vez?");
    expect(calls).toEqual(["plantao_rodizio"]);
    expect(backend.actions).toHaveLength(0);
  });

  it("A11: põe a Carla primeiro; Desfazer volta ao automático", async () => {
    const { world, backend, asked } = await run("Põe a Carla primeiro no rodízio");
    expect(asked).toBe(false);
    expect(world.queueOrder?.["s-manha"]).toEqual(["u-carla", "u-ana-lima"]);
    expect(backend.actions[0]?.undo).toMatchObject({ tool: "plantao_rodizio_ordenar", input: { voltar_automatico: true } });
  });

  it("A11: volta o rodízio pro automático", async () => {
    const { world } = await run("Volta o rodízio pro automático", (w) => { w.queueOrder = { "s-manha": ["u-carla", "u-ana-lima"] }; });
    expect(world.queueOrder?.["s-manha"]).toBeUndefined();
  });

  it("A12: online no plantão presencial, com Desfazer", async () => {
    const { world, backend } = await run("A Carla vai fazer online hoje");
    expect(world.onlineHere).toEqual(["s-manha:2026-11-21|u-carla"]);
    expect(backend.actions[0]?.undo).toMatchObject({ tool: "plantao_modo_online", input: { online: false } });
  });

  it("A13: reenvia o convite (pede confirmação; quem já confirmou não recebe de novo)", async () => {
    const pending = await run("Manda de novo o aviso de presença pra Carla", (w) => { w.presence = { "s-manha:2026-11-21|u-carla": "pending" }; });
    expect(pending.asked).toBe(true);
    expect(pending.world.invites).toEqual(["s-manha:2026-11-21|u-carla"]);
    const confirmed = await run("Manda de novo o aviso de presença pra Carla");
    expect(confirmed.world.invites ?? []).toHaveLength(0);
  });

  it("A16: lê a escala do mês (sem escrever)", async () => {
    const { calls, backend } = await run("Como está a escala deste mês?");
    expect(calls).toEqual(["escala_mensal_situacao"]);
    expect(backend.actions).toHaveLength(0);
  });

  it("A16: publica o rascunho do mês que vem depois da confirmação forte", async () => {
    const { calls, asked, world, backend } = await run("Publica a escala do mês que vem", (w) => { w.draftMonths = ["2026-12"]; });
    expect(calls).toEqual(["escala_mensal_situacao", "escala_mensal_publicar"]);
    expect(asked).toBe(true);
    expect(world.draftMonths).toEqual([]);
    expect(backend.actions[0]).toMatchObject({ tool: "escala_mensal_publicar", status: "done", undo: null });
  });

  it("A16: escala já publicada não publica de novo", async () => {
    const { calls } = await run("Publica a escala do mês que vem");
    expect(calls).toEqual(["escala_mensal_situacao"]);
  });

  it("A15: tira o dia 25 da escala (feriado)", async () => {
    const { asked, world } = await run("Tira o dia 25 da escala");
    expect(asked).toBe(true);
    expect(world.excludedDays).toEqual(["2026-11-25"]);
    expect(world.seats.filter((seat) => seat.dutyDate === "2026-11-25")).toHaveLength(0);
  });

  it("B9: quantos leads sem dono (leitura, sem telefone inteiro)", async () => {
    const { calls, backend } = await run("Quantos leads sem dono?");
    expect(calls).toEqual(["leads_buscar"]);
    expect(backend.actions).toHaveLength(0);
  });

  it("B1: passa 2 leads do plantão para a Carla (os mais antigos), com Desfazer", async () => {
    const { world, backend, asked } = await run("Passa 2 leads do plantão para a Carla");
    expect(asked).toBe(false);
    const carla = (world.leads ?? []).filter((lead) => lead.brokerId === "u-carla" && lead.scheduleId === "s-manha").map((lead) => lead.id).sort();
    expect(carla).toEqual(["l-0001", "l-0002"]);
    expect(backend.actions[0]?.undo).toMatchObject({ tool: "lead_tirar_corretor", input: { lead_ids: ["l-0001", "l-0002"] } });
  });

  it("B2: dá o lead do Sérgio (do Bruno) para a Carla; Desfazer devolve ao Bruno", async () => {
    const { world, backend } = await run("Dá o lead do Sérgio para a Carla");
    expect((world.leads ?? []).find((lead) => lead.id === "l-0006")?.brokerId).toBe("u-carla");
    expect(backend.actions[0]?.undo).toMatchObject({ tool: "lead_dar", input: { lead_id: "l-0006", corretor_id: "u-bruno" } });
  });

  it("B3: tira o lead da Maria Clara da Carla (espera manual); Desfazer devolve", async () => {
    const { world, backend } = await run("Tira o lead da Maria Clara da Carla");
    const lead = (world.leads ?? []).find((item) => item.id === "l-0005");
    expect(lead?.brokerId).toBeNull();
    expect(lead?.distributionStatus).toBe("manual_hold");
    expect(backend.actions[0]?.undo).toMatchObject({ tool: "plantao_devolver_leads", input: { corretor_id: "u-carla", lead_ids: ["l-0005"] } });
  });

  it("B1: corretor pausado no plantão não recebe", async () => {
    const backend = createMemoryBackend(sampleWorld(NOW));
    backend.world.pausedHere = ["s-manha:2026-11-21|u-carla"];
    const tools = buildAgentTools({ backend, requestText: null, approvedByUser: () => false });
    const execute = (tools.plantao_dar_leads as unknown as { execute: (input: unknown, options: { toolCallId: string; messages: [] }) => Promise<ToolResult> }).execute;
    const result = await execute({ corretor_id: "u-carla", quantidade: 2 }, { toolCallId: "t-pausa", messages: [] });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("pausada");
  });

  it("B4: transfere a carteira do Bruno para a Carla (confirmação forte)", async () => {
    const { world, asked, calls } = await run("Passa todos os leads do Bruno para a Carla");
    expect(calls).toEqual(["pessoas_buscar", "pessoas_buscar", "carteira_transferir"]);
    expect(asked).toBe(true);
    expect((world.leads ?? []).find((lead) => lead.id === "l-0006")?.brokerId).toBe("u-carla");
  });

  it("B6: põe a Maria Clara em negociação; Desfazer volta para em contato", async () => {
    const { world, backend } = await run("Põe o lead da Maria Clara em negociação");
    expect((world.leads ?? []).find((lead) => lead.id === "l-0005")?.status).toBe("negotiation");
    expect(backend.actions[0]?.undo).toMatchObject({ tool: "lead_mudar_etapa", input: { etapa: "in_contact" } });
  });

  it("B7: anota no lead com as palavras do diretor", async () => {
    const { world } = await run("Anota no lead da Maria Clara que pediu proposta da Amil");
    expect(world.notes).toEqual([{ leadId: "l-0005", text: "pediu proposta da amil" }]);
  });

  it("B8: distribui os sem dono (confirmação forte)", async () => {
    const { world, asked } = await run("Distribui os leads sem dono");
    expect(asked).toBe(true);
    expect((world.leads ?? []).filter((lead) => lead.distributionStatus === "queued")).toHaveLength(4);
  });

  it("B10: diagnóstico diz por que a pessoa não recebe", async () => {
    const backend = createMemoryBackend(sampleWorld(NOW));
    backend.world.whatsappOff = ["u-carla"];
    backend.world.pausedHere = ["s-manha:2026-11-21|u-carla"];
    const tools = buildAgentTools({ backend, requestText: null, approvedByUser: () => false });
    const execute = (tools.corretor_diagnosticar as unknown as { execute: (input: unknown, options: { toolCallId: string; messages: [] }) => Promise<ToolResult> }).execute;
    const result = await execute({ corretor_id: "u-carla" }, { toolCallId: "t-diag", messages: [] });
    expect(result.message).toContain("pausada em Plantão Manhã");
    expect(result.message).toContain("WhatsApp pessoal desconectado");
    const idle = await execute({ corretor_id: "u-ana-souza" }, { toolCallId: "t-diag2", messages: [] });
    expect(idle.message).toContain("não está");
  });

  it("C7: quem está pausado (leitura)", async () => {
    const { calls, backend } = await run("Quem está pausado?");
    expect(calls).toEqual(["equipe_listar"]);
    expect(backend.actions).toHaveLength(0);
  });

  it("C1: convida corretor com unidade; Desfazer revoga o convite", async () => {
    const { world, asked, backend } = await run("Convida o Pedro Lima, 21 99999-0000, unidade Centro");
    expect(asked).toBe(true);
    expect(world.pending?.[0]).toMatchObject({ name: "Pedro Lima", status: "PENDING" });
    expect(backend.actions[0]?.undo).toMatchObject({ tool: "convite_revogar", input: { convite_id: "conv-1" } });
  });

  it("C3: passa a Carla para a Barra; Desfazer volta ao Centro", async () => {
    const { world, asked, backend } = await run("Passa a Carla para a unidade Barra");
    expect(asked).toBe(true);
    expect(world.people.find((person) => person.id === "u-carla")?.branchName).toBe("Barra");
    expect(backend.actions[0]?.undo).toMatchObject({ tool: "membro_trocar_unidade", input: { unidade_id: "b-centro" } });
  });

  it("C4: desativa o Bruno (confirmação); Desfazer ativa", async () => {
    const { world, backend } = await run("Desativa o Bruno");
    expect(world.people.find((person) => person.id === "u-bruno")?.status).toBe("inactive");
    expect(backend.actions[0]?.undo).toMatchObject({ tool: "membro_ativar", input: { ativo: true } });
  });

  it("C6: aviso no Início; Desfazer tira o aviso", async () => {
    const { world, backend } = await run("Põe no Início: plantão extra sábado");
    expect(world.announcement).toMatchObject({ active: true, title: "Plantão extra sábado", art: "mirando" });
    expect(backend.actions[0]?.undo).toMatchObject({ tool: "aviso_inicio", input: { desligar: true } });
  });

  it("C5: mensagem a corretores vai para cada um (confirmação forte na política)", async () => {
    const backend = createMemoryBackend(sampleWorld(NOW));
    const tools = buildAgentTools({ backend, requestText: null, approvedByUser: () => true });
    const execute = (tools.corretores_mensagem as unknown as { execute: (input: unknown, options: { toolCallId: string; messages: [] }) => Promise<ToolResult> }).execute;
    const result = await execute({ corretor_ids: ["u-carla", "u-bruno"], texto: "Reunião às 9h" }, { toolCallId: "t-msg", messages: [] });
    expect(result.ok).toBe(true);
    expect(backend.world.messages).toHaveLength(2);
  });

  it("A8: presencial sem motivo não libera e pede a nota", async () => {
    const { world, backend } = await run("Libera a presença do Bruno", (w) => { w.presence = { "s-manha:2026-11-21|u-bruno": "pending" }; });
    expect(world.presence?.["s-manha:2026-11-21|u-bruno"]).toBe("pending");
    expect(backend.actions[0]?.status).toBe("failed");
    expect(backend.actions[0]?.message).toContain("preciso do motivo");
  });
});

describe("A5 e A6 com o agente real", { timeout: 20_000 }, () => {
  async function approveAndRun(text: string) {
    // Primeiro turno para no cartão; o segundo leva o "sim" do diretor (como a gaveta faz).
    const backend = createMemoryBackend(sampleWorld(NOW));
    const make = () => createDirectorAgent({ model: scriptedModel(0, () => false), backend, viewer: { role: "director", viewAs: false, writesEnabled: true }, firstName: null, messages: [] });
    const first = await make().stream({ messages: [{ role: "user", content: [{ type: "text", text }] }] });
    const steps = await first.steps;
    const request = steps.flatMap((step) => step.content).find((part) => part.type === "tool-approval-request");
    expect(request).toBeTruthy();
    const response = await first.response;
    const second = await make().stream({
      messages: [
        { role: "user", content: [{ type: "text", text }] },
        ...response.messages,
        { role: "tool", content: [{ type: "tool-approval-response", approvalId: (request as { approvalId: string }).approvalId, approved: true }] },
      ],
    });
    await second.text;
    return backend;
  }

  it("A6: passar a cadeira da Carla de terça para a Ana Souza", async () => {
    const backend = await approveAndRun("Passa a cadeira da Carla de terça para a Ana Souza");
    const seat = backend.world.seats.find((item) => item.id === "s-tarde:2026-11-24")!;
    expect(seat.brokerIds).toContain("u-ana-souza");
    expect(seat.brokerIds).not.toContain("u-carla");
    expect(backend.actions[0]).toMatchObject({ tool: "plantao_passar_cadeira", approval: "auto", status: "done" });
  });

  it("A5: trocar a Carla de terça com o Bruno de quarta", async () => {
    const backend = await approveAndRun("Troca a Carla de terça com o Bruno de quarta");
    const terca = backend.world.seats.find((item) => item.id === "s-tarde:2026-11-24")!;
    const quarta = backend.world.seats.find((item) => item.id === "s-online:2026-11-25")!;
    expect(terca.brokerIds).toContain("u-bruno");
    expect(terca.brokerIds).not.toContain("u-carla");
    expect(quarta.brokerIds).toContain("u-carla");
    expect(quarta.brokerIds).not.toContain("u-bruno");
    expect(backend.actions[0]?.undo?.tool).toBe("plantao_trocar_corretores");
  });

  it("A5: falha no meio volta tudo como estava", async () => {
    const world = sampleWorld(NOW);
    const backend = createMemoryBackend(world);
    const original = backend.addSeat.bind(backend);
    let adds = 0;
    backend.addSeat = async (occurrence, brokerId, force) => {
      adds += 1;
      if (adds === 2) throw new Error("Falha simulada no segundo encaixe.");
      return original(occurrence, brokerId, force);
    };
    const tools = buildAgentTools({ backend, requestText: null, approvedByUser: () => true });
    const execute = (tools.plantao_trocar_corretores as unknown as { execute: (input: unknown, options: { toolCallId: string; messages: [] }) => Promise<ToolResult> }).execute;
    const before = JSON.stringify(world.seats.map((seat) => [seat.id, [...seat.brokerIds].sort()]));
    const result = await execute({ corretor_a_id: "u-carla", ocorrencia_a_id: "s-tarde:2026-11-24", corretor_b_id: "u-bruno", ocorrencia_b_id: "s-online:2026-11-25" }, { toolCallId: "t-falha", messages: [] });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(world.seats.map((seat) => [seat.id, [...seat.brokerIds].sort()]))).toBe(before);
  });
});

describe("A4, A9 e A10 com o agente real", { timeout: 20_000 }, () => {
  it("A4: tirar de todos os plantões das próximas 2 semanas pede confirmação com a lista", async () => {
    const { calls, content, backend } = await ask("Tire a Carla de todos os plantões das próximas 2 semanas");
    expect(calls).toEqual(["pessoas_buscar", "plantao_escala", "plantao_tirar_de_vagas"]);
    expect(content.some((part) => part.type === "tool-approval-request")).toBe(true);
    expect(backend.actions).toHaveLength(0);
  });

  it("A9: pausa só no plantão em andamento, com Desfazer", async () => {
    const { calls, backend, text } = await ask("Pausa o Bruno no plantão");
    expect(calls).toEqual(["pessoas_buscar", "plantao_pausar"]);
    expect(backend.world.pausedHere).toEqual(["s-manha:2026-11-21|u-bruno"]);
    expect(backend.actions[0]?.undo).toMatchObject({ tool: "plantao_pausar", input: { pausado: false } });
    expect(text).toBe("Pronto.");
  });

  it("A9: quem não está em plantão agora recebe a explicação", async () => {
    const backend = createMemoryBackend(sampleWorld(NOW));
    const tools = buildAgentTools({ backend, requestText: null, approvedByUser: () => false });
    const execute = (tools.plantao_pausar as unknown as { execute: (input: unknown, options: { toolCallId: string; messages: [] }) => Promise<ToolResult> }).execute;
    const result = await execute({ corretor_id: "u-ana-souza", pausado: true }, { toolCallId: "t1", messages: [] });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("não está em nenhum plantão");
    expect(backend.world.pausedHere ?? []).toHaveLength(0);
  });

  it("A10: pausa e reativa o recebimento geral", async () => {
    const paused = await ask("Pausa a Carla");
    expect(paused.calls).toEqual(["pessoas_buscar", "corretor_pausar"]);
    expect(paused.backend.world.people.find((person) => person.id === "u-carla")?.availability).toBe("paused");
    const resumed = await ask("Ativa o Bruno");
    expect(resumed.backend.world.people.find((person) => person.id === "u-bruno")?.availability).toBe("available");
    expect(resumed.backend.actions[0]?.undo).toMatchObject({ tool: "corretor_pausar", input: { corretor_ids: ["u-bruno"], pausado: true } });
  });
});

describe("roteiro do laboratório com o agente real", { timeout: 20_000 }, () => {
  it("plantão agora: uma leitura e a resposta", async () => {
    const { calls } = await ask("Quem está no plantão agora?");
    expect(calls).toEqual(["plantao_agora"]);
  });

  it("dar cadeiras para nome repetido: busca e pede escolha (para, sem escrever)", async () => {
    const { calls, backend } = await ask("Dê 3 cadeiras para a Ana");
    expect(calls).toEqual(["pessoas_buscar", "escolher"]);
    expect(backend.actions).toHaveLength(0);
  });

  it("dar cadeiras: acha vagas e para no pedido de confirmação (3 vagas = toque)", async () => {
    const { calls, content, backend } = await ask("Dê 3 cadeiras para a Carla");
    expect(calls).toEqual(["pessoas_buscar", "plantao_cadeiras_livres", "plantao_escalar_em_vagas"]);
    expect(content.some((part) => part.type === "tool-approval-request")).toBe(true);
    expect(backend.actions).toHaveLength(0);
  });

  it("sem a chave da empresa, a escrita nem existe para o modelo", async () => {
    const { calls, backend } = await ask("Dê 1 cadeira para a Carla", false);
    expect(calls).toContain("plantao_cadeiras_livres");
    expect(calls).not.toContain("plantao_escalar_em_vagas");
    expect(backend.actions).toHaveLength(0);
  });

  it("A2: escalar no plantão da manhã de amanhã (um plantão só: direto)", async () => {
    const { calls, backend } = await ask("Escala o Bruno no plantão da manhã de amanhã");
    expect(calls).toEqual(["pessoas_buscar", "plantao_escala", "plantao_escalar_em_vagas"]);
    expect(backend.actions).toHaveLength(1);
    expect(backend.world.seats.find((seat) => seat.id === "s-manha:2026-11-22")?.brokerIds).toContain("u-bruno");
  });

  it("A2: dia com vários plantões e sem turno dito: pergunta qual", async () => {
    const { calls, backend } = await ask("Escala a Carla no plantão de segunda");
    expect(calls).toEqual(["pessoas_buscar", "plantao_escala", "escolher"]);
    expect(backend.actions).toHaveLength(0);
  });

  it("A3: tirar do plantão de terça (ela só tem um no dia: direto, com Desfazer)", async () => {
    const { calls, backend } = await ask("Tira a Carla do plantão de terça");
    expect(calls).toEqual(["pessoas_buscar", "plantao_escala", "plantao_tirar_de_vagas"]);
    expect(backend.actions[0]).toMatchObject({ tool: "plantao_tirar_de_vagas", status: "done" });
    expect(backend.actions[0]?.undo?.tool).toBe("plantao_escalar_em_vagas");
    expect(backend.world.seats.filter((seat) => seat.dutyDate === "2026-11-24" && seat.brokerIds.includes("u-carla"))).toHaveLength(0);
  });

  it("uma cadeira só é direta e grava a trilha", async () => {
    const { calls, backend } = await ask("Dê 1 cadeira para a Carla");
    expect(calls).toContain("plantao_escalar_em_vagas");
    expect(backend.actions).toHaveLength(1);
    expect(backend.actions[0]).toMatchObject({ status: "done", approval: "auto" });
  });
});
