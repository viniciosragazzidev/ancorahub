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
