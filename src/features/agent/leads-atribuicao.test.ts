import { describe, expect, it } from "vitest";

import { createMemoryBackend, sampleWorld } from "./backend-memory";
import { buildAgentTools } from "./tools";
import type { ToolResult } from "./types";

/**
 * Caso real de 23/11: "quais leads foram para o Marcos Tomaz hoje?". O agente respondia que não via a data de
 * atribuição. Agora leads_buscar filtra pelo dia em que o lead chegou ao corretor (São Paulo) e devolve lista e total.
 */
const NOW = new Date("2026-11-23T20:00:00Z"); // segunda, 17:00 em São Paulo

type Exec = (input: unknown, options: { toolCallId: string; messages: [] }) => Promise<ToolResult>;

function setup() {
  const world = sampleWorld(NOW);
  const base = { status: "in_contact", brokerId: "u-marcos", brokerName: "Marcos Tomaz 11580", queueName: "FILA PME - RENAN", temperature: null, distributionStatus: "assigned", createdAt: "2026-11-23T10:00:00Z" };
  world.leads = [
    { ...base, id: "l-paulo", name: "Paulo Rodrigues", phoneTail: "7385", assignedAt: "2026-11-23T19:13:13Z" }, // 16:13
    { ...base, id: "l-adelmo", name: "Adelmo", phoneTail: "9939", assignedAt: "2026-11-23T18:38:47Z" }, // 15:38
    // 23:30 de domingo em São Paulo (02:30 UTC de segunda): é ontem, não hoje.
    { ...base, id: "l-ontem", name: "Lead de Ontem", phoneTail: "1111", assignedAt: "2026-11-23T02:30:00Z" },
    { ...base, id: "l-outro", name: "Lead da Carla", phoneTail: "2222", brokerId: "u-carla", brokerName: "Carla Mendes", assignedAt: "2026-11-23T15:00:00Z" },
  ];
  const tools = buildAgentTools({ backend: createMemoryBackend(world), requestText: null, approvedByUser: () => false });
  const run = (input: unknown) => ((tools.leads_buscar as unknown as { execute: Exec }).execute)(input, { toolCallId: "t", messages: [] });
  return { run };
}

describe("leads por data de atribuição", () => {
  it("lista os leads que chegaram ao corretor hoje, com hora, etapa, fila e total", async () => {
    const { run } = setup();
    const result = await run({ corretor_id: "u-marcos", atribuido_de: "2026-11-23", atribuido_ate: "2026-11-23" });
    expect(result.ok).toBe(true);
    expect((result.data as { total?: number } | undefined)?.total).toBe(2);
    expect(result.message).toContain("2 leads chegaram para Marcos Tomaz 11580 em 23/11");
    expect(result.message).toContain("16:13 · Paulo Rodrigues (…7385) · em contato · FILA PME - RENAN");
    expect(result.message).toContain("15:38 · Adelmo (…9939)");
    // Mais recente primeiro.
    expect(result.message.indexOf("Paulo")).toBeLessThan(result.message.indexOf("Adelmo"));
    expect(result.message).not.toContain("Lead de Ontem");
    expect(result.message).not.toContain("Lead da Carla");
    expect(result.href).toBe("/leads?corretor=u-marcos");
  });

  it("ontem pega o lead das 23:30 de domingo em São Paulo", async () => {
    const { run } = setup();
    const result = await run({ corretor_id: "u-marcos", atribuido_de: "2026-11-22", atribuido_ate: "2026-11-22" });
    expect((result.data as { total?: number } | undefined)?.total).toBe(1);
    expect(result.message).toContain("Lead de Ontem");
  });

  it("intervalo mostra dia e hora; sem corretor mostra de quem é", async () => {
    const { run } = setup();
    const result = await run({ atribuido_de: "2026-11-22", atribuido_ate: "2026-11-23" });
    expect((result.data as { total?: number } | undefined)?.total).toBe(4);
    expect(result.message).toContain("23/11 16:13 · Paulo Rodrigues");
    expect(result.message).toContain("Carla Mendes");
  });

  it("dia sem lead diz isso, sem mandar abrir tela", async () => {
    const { run } = setup();
    const result = await run({ corretor_id: "u-marcos", atribuido_de: "2026-11-20", atribuido_ate: "2026-11-20" });
    expect(result.message).toBe("Nenhum lead chegou para essa pessoa em 20/11.");
  });
});
