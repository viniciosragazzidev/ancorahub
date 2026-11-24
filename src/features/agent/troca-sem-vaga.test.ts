import { describe, expect, it } from "vitest";

import { createMemoryBackend, sampleWorld } from "./backend-memory";
import { AGENT_CATALOG, type CatalogEntry } from "./catalog-meta";
import { confirmLevelFor } from "./policy";
import { blockedSeats } from "./seats";
import { buildAgentTools } from "./tools";
import type { SeatOccurrence, ToolResult } from "./types";

/**
 * Caso real de 24/11: "adiciona Osmarina, 30/11 presencial tarde". Não havia vaga na unidade dela; o agente ofereceu
 * "fora do tipo, sim/não", o diretor disse "adiciona" e o agente não tinha como seguir. Agora, sem vaga, a busca
 * devolve os plantões do pedido com quem está em cada um, e escalar aceita "mesmo assim" (fora do tipo / acima do
 * máximo) sempre com o toque do diretor; trocar usa plantao_passar_cadeira.
 */
const NOW = new Date("2026-11-24T13:00:00Z"); // terça, 10:00 em São Paulo

type Exec = (input: unknown, options: { toolCallId: string; messages: [] }) => Promise<ToolResult>;

function seat(partial: Partial<SeatOccurrence> & Pick<SeatOccurrence, "id">): SeatOccurrence {
  return {
    scheduleId: partial.id.split(":")[0]!, scheduleName: "Presencial · Tarde", dutyDate: "2026-11-30", startsAt: "13:30", endsAt: "19:00",
    typeId: "t-presencial", typeName: "Presencial", attendanceMode: "presencial", maximumBrokers: 2, minimumBrokers: 1,
    brokerIds: [], allowedBrokerIds: ["u-carla", "u-bruno"], started: false, ended: false, source: "published", planId: "p",
    ...partial,
  };
}

function setup(seats: SeatOccurrence[]) {
  const world = sampleWorld(NOW);
  world.seats = seats;
  const backend = createMemoryBackend(world);
  const tools = buildAgentTools({ backend, requestText: null, approvedByUser: () => true });
  const run = (name: keyof typeof tools, input: unknown) => ((tools[name] as unknown as { execute: Exec }).execute)(input, { toolCallId: `t-${Math.random()}`, messages: [] });
  return { world, run };
}

describe("sem vaga: oferecer troca ou escalar mesmo assim", () => {
  it("plantão cheio: lista quem está, sem ids, e devolve as opções", async () => {
    const { run } = setup([seat({ id: "s-tarde:2026-11-30", brokerIds: ["u-bruno", "u-ana2"] })]);
    const result = await run("plantao_cadeiras_livres", { corretor_id: "u-carla", quantidade: 1, de: "2026-11-30", ate: "2026-11-30", turno: "tarde", modalidade: "presencial" });
    expect(result.ok).toBe(true);
    expect(result.error?.code).toBe("sem_vagas");
    expect(result.message).toContain("Sem vaga livre para Carla Mendes");
    expect(result.message).toContain("seg 30/11, 13:30–19:00, Presencial · Tarde: cheio (2 de 2). Estão: Bruno Castro");
    expect(result.message).not.toMatch(/s-tarde|u-bruno|ocorrencia/);
    const opcoes = (result.data as { opcoes: Array<{ ocorrencia_id: string; cheio: boolean; escalados: Array<{ nome: string }> }> }).opcoes;
    expect(opcoes[0]).toMatchObject({ ocorrencia_id: "s-tarde:2026-11-30", cheio: true });
  });

  it("fora do tipo: diz o motivo e \"adiciona\" vira escalar com fora_do_tipo", async () => {
    const { world, run } = setup([seat({ id: "s-tarde:2026-11-30", allowedBrokerIds: ["u-bruno"], maximumBrokers: null })]);
    const search = await run("plantao_cadeiras_livres", { corretor_id: "u-carla", quantidade: 1, de: "2026-11-30", ate: "2026-11-30", turno: "tarde" });
    expect(search.message).toContain("fora do tipo da unidade dela");
    const done = await run("plantao_escalar_em_vagas", { corretor_id: "u-carla", ocorrencia_ids: ["s-tarde:2026-11-30"], fora_do_tipo: true });
    expect(done.ok).toBe(true);
    expect(world.seats[0]!.brokerIds).toContain("u-carla");
  });

  it("acima do máximo só com a flag; sem ela explica as saídas", async () => {
    const { world, run } = setup([seat({ id: "s-tarde:2026-11-30", brokerIds: ["u-bruno", "u-ana2"] })]);
    const refused = await run("plantao_escalar_em_vagas", { corretor_id: "u-carla", ocorrencia_ids: ["s-tarde:2026-11-30"] });
    expect(refused.ok).toBe(false);
    expect(refused.message).toContain("cheio");
    const done = await run("plantao_escalar_em_vagas", { corretor_id: "u-carla", ocorrencia_ids: ["s-tarde:2026-11-30"], acima_do_maximo: true });
    expect(done.ok).toBe(true);
    expect(world.seats[0]!.brokerIds).toEqual(["u-bruno", "u-ana2", "u-carla"]);
  });

  it("trocar: passar a cadeira tira quem estava e põe a pessoa pedida", async () => {
    const { world, run } = setup([seat({ id: "s-tarde:2026-11-30", brokerIds: ["u-bruno"], maximumBrokers: 1 })]);
    const done = await run("plantao_passar_cadeira", { de_corretor_id: "u-bruno", para_corretor_id: "u-carla", ocorrencia_id: "s-tarde:2026-11-30" });
    expect(done.ok).toBe(true);
    expect(world.seats[0]!.brokerIds).toEqual(["u-carla"]);
  });

  it("escalar como exceção sempre pede o toque, mesmo com uma vaga", () => {
    const entry = AGENT_CATALOG.plantao_escalar_em_vagas as CatalogEntry;
    expect(confirmLevelFor(entry, { ocorrencia_ids: ["a:2026-11-30"] })).toBe("direto");
    expect(confirmLevelFor(entry, { ocorrencia_ids: ["a:2026-11-30"], fora_do_tipo: true })).toBe("toque");
    expect(confirmLevelFor(entry, { ocorrencia_ids: ["a:2026-11-30"], acima_do_maximo: true })).toBe("toque");
  });

  it("blockedSeats ignora o que já terminou e onde a pessoa já está", () => {
    const list = blockedSeats([
      seat({ id: "a:2026-11-30", brokerIds: ["u-bruno", "u-ana2"] }),
      seat({ id: "b:2026-11-30", brokerIds: ["u-carla"], maximumBrokers: 1 }),
      seat({ id: "c:2026-11-30", ended: true, brokerIds: ["u-bruno", "u-ana2"] }),
    ], "u-carla");
    expect(list.map((item) => item.occurrence.id)).toEqual(["a:2026-11-30"]);
  });
});

describe("adicionar num plantão dito não depende de vaga livre", () => {
  it("a escala diz, para quem vai entrar, o que é cheio e fora do tipo", async () => {
    const { run } = setup([
      seat({ id: "s-tarde:2026-11-30", brokerIds: ["u-bruno", "u-ana2"] }),
      seat({ id: "s-manha:2026-12-04", dutyDate: "2026-12-04", startsAt: "09:00", endsAt: "13:30", scheduleName: "Presencial · Manhã", allowedBrokerIds: ["u-bruno"], maximumBrokers: null }),
    ]);
    const tarde = await run("plantao_escala", { de: "2026-11-30", ate: "2026-11-30", turno: "tarde", plantao_texto: "Presencial", para_adicionar_id: "u-carla" });
    expect(tarde.message).toContain("[cheio]");
    const manha = await run("plantao_escala", { de: "2026-12-04", ate: "2026-12-04", turno: "manha", plantao_texto: "Presencial", para_adicionar_id: "u-carla" });
    expect(manha.message).toContain("[fora do tipo da unidade de Carla Mendes]");
    expect(manha.message).not.toMatch(/s-manha|u-carla/);
  });

  it("sem as flags, nada grava e a volta pede a mesma chamada com elas; com elas, adiciona os dois", async () => {
    const { world, run } = setup([
      seat({ id: "s-tarde:2026-11-30", brokerIds: ["u-bruno", "u-ana2"] }),
      seat({ id: "s-manha:2026-12-04", dutyDate: "2026-12-04", startsAt: "09:00", endsAt: "13:30", scheduleName: "Presencial · Manhã", allowedBrokerIds: ["u-bruno"], maximumBrokers: null }),
    ]);
    const ids = ["s-tarde:2026-11-30", "s-manha:2026-12-04"];
    const first = await run("plantao_escalar_em_vagas", { corretor_id: "u-carla", ocorrencia_ids: ids });
    expect(first.ok).toBe(false);
    expect(first.error?.code).toBe("confirmar_excecao");
    expect(first.error?.fix).toContain("fora_do_tipo: true e acima_do_maximo: true");
    expect(world.seats.every((item) => !item.brokerIds.includes("u-carla"))).toBe(true);
    const done = await run("plantao_escalar_em_vagas", { corretor_id: "u-carla", ocorrencia_ids: ids, fora_do_tipo: true, acima_do_maximo: true });
    expect(done.ok).toBe(true);
    expect(world.seats.every((item) => item.brokerIds.includes("u-carla"))).toBe(true);
  });
});
