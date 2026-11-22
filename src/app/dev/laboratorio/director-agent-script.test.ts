import { describe, expect, it } from "vitest";

import { createDirectorAgent } from "@/features/agent/agent";
import { createMemoryBackend, sampleWorld } from "@/features/agent/backend-memory";

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
