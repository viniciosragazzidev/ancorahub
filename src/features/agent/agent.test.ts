import { describe, expect, it } from "vitest";

import { createMemoryBackend, sampleWorld } from "./backend-memory";
import { AGENT_CATALOG } from "./catalog-meta";
import { matchPeople } from "./people-match";
import { approvalFor, confirmLevelFor, isToolVisible } from "./policy";
import { pickSeats, seatLabel, shiftOf } from "./seats";
import { buildAgentTools, spDateKey } from "./tools";
import type { SeatOccurrence, ToolResult } from "./types";

// Sábado, 21/11/2026, 10:00 em São Paulo.
const NOW = new Date("2026-11-21T13:00:00Z");

function seat(partial: Partial<SeatOccurrence> & { id: string; dutyDate: string }): SeatOccurrence {
  return {
    scheduleId: partial.id.split(":")[0]!,
    scheduleName: "Plantão",
    startsAt: "09:00",
    endsAt: "13:00",
    typeId: "t",
    typeName: "PME",
    attendanceMode: "presencial",
    maximumBrokers: 3,
    minimumBrokers: 1,
    brokerIds: [],
    allowedBrokerIds: ["ana"],
    started: false,
    ended: false,
    source: "published",
    planId: "p",
    ...partial,
  };
}

type Exec = (input: unknown, options: { toolCallId: string; messages: [] }) => Promise<ToolResult>;
function exec(tools: ReturnType<typeof buildAgentTools>, name: keyof ReturnType<typeof buildAgentTools>, input: unknown, toolCallId = `call-${Math.random()}`) {
  return ((tools[name] as unknown as { execute: Exec }).execute)(input, { toolCallId, messages: [] });
}

describe("busca de pessoas", () => {
  const { people } = sampleWorld(NOW);
  it("acha uma pessoa só pelo nome completo", () => {
    const match = matchPeople("Ana Souza", people);
    expect(match.kind).toBe("one");
  });
  it("primeiro nome repetido vira escolha", () => {
    const match = matchPeople("Ana", people);
    expect(match.kind).toBe("many");
    if (match.kind === "many") expect(match.people.map((person) => person.id).sort()).toEqual(["u-ana-lima", "u-ana-souza"]);
  });
  it("ignora acento e caixa", () => {
    expect(matchPeople("bruno CASTRO", people).kind).toBe("one");
  });
  it("inativo não aparece; vem como dica", () => {
    const match = matchPeople("Diego", people);
    expect(match.kind).toBe("none");
    if (match.kind === "none") expect(match.inactive.map((person) => person.id)).toEqual(["u-diego"]);
  });
});

describe("dar cadeiras (escolha das vagas)", () => {
  const seats = [
    seat({ id: "a:2026-11-22", dutyDate: "2026-11-22" }),
    seat({ id: "b:2026-11-22", dutyDate: "2026-11-22", startsAt: "10:00", endsAt: "14:00" }),
    seat({ id: "a:2026-11-23", dutyDate: "2026-11-23", brokerIds: ["x", "y", "z"] }),
    seat({ id: "a:2026-11-24", dutyDate: "2026-11-24", brokerIds: ["ana"] }),
    seat({ id: "c:2026-11-24", dutyDate: "2026-11-24", startsAt: "12:00", endsAt: "16:00" }),
    seat({ id: "a:2026-11-25", dutyDate: "2026-11-25", allowedBrokerIds: [] }),
    seat({ id: "a:2026-11-26", dutyDate: "2026-11-26", startsAt: "14:00", endsAt: "18:00" }),
    seat({ id: "a:2026-11-21", dutyDate: "2026-11-21", started: true }),
  ];

  it("pega as próximas vagas livres, uma por plantão, sem choque de horário nem lotado", () => {
    const pick = pickSeats(seats, "ana", 5);
    expect(pick.picked.map((choice) => choice.occurrence.id)).toEqual(["a:2026-11-22", "a:2026-11-26"]);
  });
  it("não usa plantão de tipo fora da unidade sem pedir; conta quantos havia", () => {
    expect(pickSeats(seats, "ana", 5).outsideTypeAvailable).toBe(1);
    const forced = pickSeats(seats, "ana", 5, { includeOutsideType: true });
    expect(forced.picked.map((choice) => choice.occurrence.id)).toContain("a:2026-11-25");
  });
  it("filtra por dia da semana e turno", () => {
    expect(pickSeats(seats, "ana", 5, { weekdays: [0] }).picked.map((choice) => choice.occurrence.id)).toEqual(["a:2026-11-22"]);
    expect(pickSeats(seats, "ana", 5, { shift: "tarde" }).picked.map((choice) => choice.occurrence.id)).toEqual(["a:2026-11-26"]);
  });
  it("uma cadeira por dia, salvo pedido", () => {
    const day = [
      seat({ id: "m:2026-11-27", dutyDate: "2026-11-27", startsAt: "09:00", endsAt: "13:00" }),
      seat({ id: "t:2026-11-27", dutyDate: "2026-11-27", startsAt: "13:00", endsAt: "18:00" }),
      seat({ id: "m:2026-11-28", dutyDate: "2026-11-28" }),
    ];
    expect(pickSeats(day, "ana", 3).picked.map((choice) => choice.occurrence.id)).toEqual(["m:2026-11-27", "m:2026-11-28"]);
    expect(pickSeats(day, "ana", 3, { maxPerDay: 3 }).picked).toHaveLength(3);
  });
  it("rótulo legível e turno", () => {
    expect(seatLabel(seats[0]!)).toBe("dom 22/11, 09:00–13:00, Plantão");
    expect(shiftOf("13:00")).toBe("tarde");
    expect(shiftOf("18:30")).toBe("noite");
  });
});

describe("política", () => {
  const director = { role: "director", viewAs: false, writesEnabled: true };
  it("escrita some do catálogo sem a chave da empresa e no Ver como", () => {
    expect(isToolVisible(AGENT_CATALOG.plantao_escalar_em_vagas, { ...director, writesEnabled: false })).toBe(false);
    expect(isToolVisible(AGENT_CATALOG.plantao_escalar_em_vagas, { ...director, viewAs: true })).toBe(false);
    expect(isToolVisible(AGENT_CATALOG.plantao_escala, { ...director, viewAs: true })).toBe(true);
  });
  it("uma vaga é direta; várias pedem toque", () => {
    expect(confirmLevelFor(AGENT_CATALOG.plantao_escalar_em_vagas, { ocorrencia_ids: ["a"] })).toBe("direto");
    expect(confirmLevelFor(AGENT_CATALOG.plantao_escalar_em_vagas, { ocorrencia_ids: ["a", "b"] })).toBe("toque");
    expect(approvalFor(AGENT_CATALOG.plantao_escalar_em_vagas, director, { ocorrencia_ids: ["a", "b"] }).type).toBe("user-approval");
  });
  it("turno que leu texto de cliente sobe para toque", () => {
    expect(confirmLevelFor(AGENT_CATALOG.plantao_escalar_em_vagas, { ocorrencia_ids: ["a"] }, { readUntrustedText: true })).toBe("toque");
  });
  it("gestor e corretor não usam o agente do diretor", () => {
    expect(approvalFor(AGENT_CATALOG.plantao_escala, { ...director, role: "manager" }, {}).type).toBe("denied");
  });
});

describe("ferramentas no mundo em memória", () => {
  it("dar 3 cadeiras: acha vagas, escala, grava a trilha e desfaz", async () => {
    const backend = createMemoryBackend(sampleWorld(NOW));
    const tools = buildAgentTools({ backend, requestText: "dê 3 cadeiras para a Ana Souza", approvedByUser: () => true });
    const free = await exec(tools, "plantao_cadeiras_livres", { corretor_id: "u-ana-souza", quantidade: 3 });
    expect(free.ok).toBe(true);
    const vagas = (free.data as { vagas: Array<{ ocorrencia_id: string }> }).vagas;
    expect(vagas).toHaveLength(3);
    const done = await exec(tools, "plantao_escalar_em_vagas", { corretor_id: "u-ana-souza", ocorrencia_ids: vagas.map((vaga) => vaga.ocorrencia_id) }, "call-escalar");
    expect(done.ok).toBe(true);
    expect(done.actionId).toBe("acao-1");
    expect(done.undo?.tool).toBe("plantao_tirar_de_vagas");
    expect(backend.world.seats.filter((item) => item.brokerIds.includes("u-ana-souza"))).toHaveLength(3);
    expect(backend.actions[0]).toMatchObject({ approval: "user", status: "done", requestText: "dê 3 cadeiras para a Ana Souza" });

    // Reenvio da mesma chamada não escala de novo.
    const again = await exec(tools, "plantao_escalar_em_vagas", { corretor_id: "u-ana-souza", ocorrencia_ids: vagas.map((vaga) => vaga.ocorrencia_id) }, "call-escalar");
    expect(again.actionId).toBe("acao-1");
    expect(backend.actions).toHaveLength(1);

    const undone = await exec(tools, "plantao_tirar_de_vagas", done.undo!.input);
    expect(undone.ok).toBe(true);
    expect(backend.world.seats.filter((item) => item.brokerIds.includes("u-ana-souza"))).toHaveLength(0);
  });

  it("corretor inativo ou que não é corretor não ganha cadeira", async () => {
    const backend = createMemoryBackend(sampleWorld(NOW));
    const tools = buildAgentTools({ backend, requestText: null, approvedByUser: () => false });
    expect((await exec(tools, "plantao_cadeiras_livres", { corretor_id: "u-diego", quantidade: 2 })).error?.code).toBe("inativo");
    expect((await exec(tools, "plantao_cadeiras_livres", { corretor_id: "u-gestor", quantidade: 2 })).error?.code).toBe("papel");
  });

  it("falha do servidor: nada feito, sem Desfazer, erro legível", async () => {
    const world = sampleWorld(NOW);
    world.failWrites = true;
    const backend = createMemoryBackend(world);
    const tools = buildAgentTools({ backend, requestText: null, approvedByUser: () => false });
    const free = await exec(tools, "plantao_cadeiras_livres", { corretor_id: "u-ana-souza", quantidade: 1 });
    const id = (free.data as { vagas: Array<{ ocorrencia_id: string }> }).vagas[0]!.ocorrencia_id;
    const result = await exec(tools, "plantao_escalar_em_vagas", { corretor_id: "u-ana-souza", ocorrencia_ids: [id] });
    expect(result.ok).toBe(false);
    expect(result.undo).toBeUndefined();
    expect(result.message).toContain("Não escalei");
  });

  it("escala da pessoa: quantas cadeiras ela tem", async () => {
    const backend = createMemoryBackend(sampleWorld(NOW));
    const tools = buildAgentTools({ backend, requestText: null, approvedByUser: () => false });
    const result = await exec(tools, "plantao_escala", { corretor_id: "u-carla", de: spDateKey(NOW), ate: "2026-12-04" });
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/Carla Mendes tem \d+ cadeiras?/);
  });
});
