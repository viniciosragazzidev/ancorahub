import type { AgentActionRecord, AgentBackend, DutyNow } from "./backend";
import type { Person, SeatOccurrence } from "./types";

/**
 * Mundo em memória para o laboratório e os testes: a mesma interface do backend real, com as mesmas regras
 * principais (plantão terminado ou começado, já escalado, lotado, fora do tipo). Plano §6.2 e §6.3.
 */
export type MemoryWorld = {
  now: Date;
  people: Person[];
  seats: SeatOccurrence[];
  dutyNow?: DutyNow[];
  /** Falha simulada em addSeat/removeSeat (painel do laboratório). */
  failWrites?: boolean;
  /** Pausados só no plantão: `${ocorrencia}|${corretor}`. */
  pausedHere?: string[];
};

export function createMemoryBackend(world: MemoryWorld): AgentBackend & { world: MemoryWorld; actions: Array<AgentActionRecord & { id: string; undone?: boolean }> } {
  const actions: Array<AgentActionRecord & { id: string; undone?: boolean }> = [];
  let counter = 0;
  return {
    world,
    actions,
    now: () => world.now,
    async listPeople() {
      return world.people.map((person) => ({ ...person }));
    },
    async listSeats({ from, until }) {
      return world.seats.filter((seat) => seat.dutyDate >= from && seat.dutyDate <= until).map((seat) => ({ ...seat, brokerIds: [...seat.brokerIds] }));
    },
    async dutyNow() {
      if (world.dutyNow) return world.dutyNow;
      // Plantões que começaram e não terminaram, com quem está escalado (presença confirmada no mundo de teste).
      const names = new Map(world.people.map((person) => [person.id, person]));
      return world.seats.filter((seat) => seat.started && !seat.ended).map((seat) => ({
        scheduleId: seat.scheduleId,
        scheduleName: seat.scheduleName,
        dutyDate: seat.dutyDate,
        startsAt: seat.startsAt,
        endsAt: seat.endsAt,
        minimumBrokers: seat.minimumBrokers,
        queueName: null,
        brokers: seat.brokerIds.map((id) => ({
          id,
          assignmentId: `${seat.id}|${id}`,
          name: names.get(id)?.name ?? "Corretor",
          presence: "confirmed" as const,
          pausedHere: (world.pausedHere ?? []).includes(`${seat.id}|${id}`),
          pausedGlobal: names.get(id)?.availability === "paused",
        })),
      }));
    },
    async pauseOnDuty(_scheduleId, assignmentId, paused) {
      if (world.failWrites) throw new Error("Falha simulada do servidor.");
      const set = new Set(world.pausedHere ?? []);
      if (paused) set.add(assignmentId); else set.delete(assignmentId);
      world.pausedHere = [...set];
    },
    async setAvailability(brokerIds, target) {
      if (world.failWrites) throw new Error("Falha simulada do servidor.");
      for (const person of world.people) if (brokerIds.includes(person.id) && person.role === "broker") person.availability = target;
    },
    async addSeat(occurrence, brokerId, force) {
      if (world.failWrites) throw new Error("Falha simulada do servidor.");
      const seat = world.seats.find((item) => item.id === occurrence.id);
      if (!seat) throw new Error("Este plantão não está na escala publicada.");
      if (seat.ended) throw new Error("Este plantão já terminou. Não é possível escalar corretores nele.");
      if (seat.brokerIds.includes(brokerId)) throw new Error("Este corretor já está neste plantão.");
      if (!seat.allowedBrokerIds.includes(brokerId) && !force) throw new Error("A unidade deste corretor não participa deste tipo de plantão. Confirme para escalar mesmo assim.");
      if (seat.maximumBrokers !== null && seat.brokerIds.length >= seat.maximumBrokers) throw new Error("Plantão lotado.");
      seat.brokerIds.push(brokerId);
    },
    async removeSeat(occurrence, brokerId) {
      if (world.failWrites) throw new Error("Falha simulada do servidor.");
      const seat = world.seats.find((item) => item.id === occurrence.id);
      if (!seat || !seat.brokerIds.includes(brokerId)) throw new Error("Este corretor não está neste plantão.");
      if (seat.started) throw new Error("Este plantão já começou. Não é possível remover corretor dele.");
      seat.brokerIds = seat.brokerIds.filter((id) => id !== brokerId);
    },
    async record(entry) {
      if (actions.some((action) => action.toolCallId === entry.toolCallId)) return null;
      counter += 1;
      const id = `acao-${counter}`;
      actions.push({ ...entry, id });
      return id;
    },
    async recorded(toolCallId) {
      const found = actions.find((action) => action.toolCallId === toolCallId);
      return found ? { id: found.id, message: found.message, status: found.status } : null;
    },
  };
}

/** Mundo de exemplo: 6 pessoas (duas Anas), 3 plantões por dia nos próximos 14 dias. */
export function sampleWorld(now: Date): MemoryWorld {
  const people: Person[] = [
    { id: "u-ana-souza", name: "Ana Souza", role: "broker", jobTitle: "broker", status: "active", availability: "available", branchId: "b-centro", branchName: "Centro" },
    { id: "u-ana-lima", name: "Ana Paula Lima", role: "broker", jobTitle: "broker", status: "active", availability: "available", branchId: "b-barra", branchName: "Barra" },
    { id: "u-bruno", name: "Bruno Castro", role: "broker", jobTitle: "broker", status: "active", availability: "paused", branchId: "b-centro", branchName: "Centro" },
    { id: "u-carla", name: "Carla Mendes", role: "broker", jobTitle: "broker", status: "active", availability: "available", branchId: "b-centro", branchName: "Centro" },
    { id: "u-diego", name: "Diego Rocha", role: "broker", jobTitle: "broker", status: "inactive", availability: "offline", branchId: "b-barra", branchName: "Barra" },
    { id: "u-gestor", name: "Marcos Gestor", role: "manager", jobTitle: "manager", status: "active", availability: "available", branchId: "b-centro", branchName: "Centro" },
  ];
  const brokers = people.filter((person) => person.role === "broker").map((person) => person.id);
  const today = new Date(now.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
  const schedules = [
    { id: "s-manha", name: "Plantão Manhã", startsAt: "09:00", endsAt: "13:00", typeId: "t-pme", typeName: "PME", mode: "presencial" as const, max: 3 },
    { id: "s-tarde", name: "Plantão Tarde", startsAt: "13:00", endsAt: "18:00", typeId: "t-pme", typeName: "PME", mode: "presencial" as const, max: 3 },
    { id: "s-online", name: "Plantão Online", startsAt: "18:00", endsAt: "22:00", typeId: "t-online", typeName: "Online", mode: "online" as const, max: 2 },
  ];
  const minutesNow = Number(new Date(now.getTime() - 3 * 3_600_000).toISOString().slice(11, 13)) * 60 + Number(new Date(now.getTime() - 3 * 3_600_000).toISOString().slice(14, 16));
  const seats: SeatOccurrence[] = [];
  for (let day = 0; day < 14; day += 1) {
    const dutyDate = new Date(Date.parse(`${today}T12:00:00Z`) + day * 86_400_000).toISOString().slice(0, 10);
    for (const [index, schedule] of schedules.entries()) {
      const start = Number(schedule.startsAt.slice(0, 2)) * 60;
      const end = Number(schedule.endsAt.slice(0, 2)) * 60;
      const started = day === 0 && minutesNow >= start;
      seats.push({
        id: `${schedule.id}:${dutyDate}`,
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        dutyDate,
        startsAt: schedule.startsAt,
        endsAt: schedule.endsAt,
        typeId: schedule.typeId,
        typeName: schedule.typeName,
        attendanceMode: schedule.mode,
        maximumBrokers: schedule.max,
        minimumBrokers: 2,
        // Alguns já cheios e alguns com gente, para o "onde falta gente".
        brokerIds: (day * 3 + index) % 7 === 0 ? brokers.slice(1, 1 + schedule.max) : (day * 3 + index) % 5 === 0 ? ["u-carla"] : [],
        allowedBrokerIds: schedule.typeId === "t-online" ? brokers.filter((id) => id !== "u-ana-lima") : brokers,
        started,
        ended: day === 0 && minutesNow >= end,
        source: "published",
        planId: "plano-lab",
      });
    }
  }
  return { now, people, seats };
}
