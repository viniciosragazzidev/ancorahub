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

  it("uma cadeira só é direta e grava a trilha", async () => {
    const { calls, backend } = await ask("Dê 1 cadeira para a Carla");
    expect(calls).toContain("plantao_escalar_em_vagas");
    expect(backend.actions).toHaveLength(1);
    expect(backend.actions[0]).toMatchObject({ status: "done", approval: "auto" });
  });
});
