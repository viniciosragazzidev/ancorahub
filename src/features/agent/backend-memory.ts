import type { AgentActionRecord, AgentBackend, DutyNow } from "./backend";
import type { Announcement, Branch, LeadSummary, PendingInvite, Person, SeatOccurrence } from "./types";

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
  /** Presença por `${ocorrencia}|${corretor}` (sem registro = pendente). */
  presence?: Record<string, "confirmed" | "pending" | "absent">;
  /** Plantões presenciais pedem motivo para liberar sem foto. */
  presencialNeedsNote?: boolean;
  /** Ordem manual do rodízio por plantão. */
  queueOrder?: Record<string, string[]>;
  /** Escalações marcadas como online dentro de plantão presencial. */
  onlineHere?: string[];
  /** Convites de presença reenviados (assignmentId). */
  invites?: string[];
  /** Meses com rascunho por publicar (no mundo de teste os outros estão publicados). */
  draftMonths?: string[];
  /** Dias tirados da escala (feriado). */
  excludedDays?: string[];
  /** Leads do mundo de teste; `scheduleId` = plantão em cuja fila o lead sem dono espera. */
  leads?: Array<LeadSummary & { scheduleId?: string | null }>;
  notes?: Array<{ leadId: string; text: string }>;
  tasks?: Array<{ leadId: string; title: string; dueAt: string | null; assigneeIds: string[] }>;
  offersResent?: string[];
  whatsappOff?: string[];
  branches?: Branch[];
  pending?: PendingInvite[];
  messages?: Array<{ userId: string; body: string }>;
  announcement?: Announcement | null;
};

export function createMemoryBackend(world: MemoryWorld): AgentBackend & { world: MemoryWorld; actions: Array<AgentActionRecord & { id: string; undone?: boolean }> } {
  const actions: Array<AgentActionRecord & { id: string; undone?: boolean }> = [];
  let counter = 0;
  // Plantões rodando (começou e não terminou) e, com horizonte, os que começam nas próximas horas.
  const dutyWindows = (horizonHours: number): DutyNow[] => {
    const names = new Map(world.people.map((person) => [person.id, person]));
    const nowMs = world.now.getTime();
    const startOf = (seat: SeatOccurrence) => Date.parse(`${seat.dutyDate}T${seat.startsAt.slice(0, 5)}:00-03:00`);
    return world.seats
      .filter((seat) => !seat.ended && (seat.started || (startOf(seat) > nowMs && startOf(seat) <= nowMs + horizonHours * 3_600_000)))
      .map((seat) => ({
        scheduleId: seat.scheduleId,
        scheduleName: seat.scheduleName,
        dutyDate: seat.dutyDate,
        startsAt: seat.startsAt,
        endsAt: seat.endsAt,
        minimumBrokers: seat.minimumBrokers,
        queueName: null,
        running: seat.started,
        brokers: seat.brokerIds.map((id) => ({
          id,
          assignmentId: `${seat.id}|${id}`,
          name: names.get(id)?.name ?? "Corretor",
          presence: world.presence?.[`${seat.id}|${id}`] ?? (seat.started ? "confirmed" as const : "pending" as const),
          pausedHere: (world.pausedHere ?? []).includes(`${seat.id}|${id}`),
          pausedGlobal: names.get(id)?.availability === "paused",
        })),
      }));
  };
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
      return dutyWindows(0).filter((duty) => duty.running);
    },
    async dutySoon() {
      if (world.dutyNow) return world.dutyNow;
      return dutyWindows(24);
    },
    async markAbsence(_scheduleId, assignmentId, absent) {
      if (world.failWrites) throw new Error("Falha simulada do servidor.");
      const current = world.presence?.[assignmentId] ?? "pending";
      if (absent && current === "absent") throw new Error("Falta já registrada.");
      if (!absent && current !== "absent") throw new Error("Não há falta para desfazer.");
      world.presence = { ...(world.presence ?? {}), [assignmentId]: absent ? "absent" : "pending" };
    },
    async releasePresence(_scheduleId, assignmentId, note) {
      if (world.failWrites) return { ok: false, reason: "Falha simulada do servidor." };
      const seat = world.seats.find((item) => assignmentId.startsWith(`${item.id}|`));
      if (seat?.attendanceMode === "presencial" && world.presencialNeedsNote !== false && !note) {
        return { ok: false, reason: "Plantão presencial sem foto: escreva o motivo da liberação.", needsNote: true };
      }
      world.presence = { ...(world.presence ?? {}), [assignmentId]: "confirmed" };
      return { ok: true };
    },
    async queueOrders() {
      return dutyWindows(0).filter((duty) => duty.running).map((duty) => {
        const ids = duty.brokers.filter((broker) => !broker.pausedHere && !broker.pausedGlobal && broker.presence !== "absent").map((broker) => broker.id);
        const saved = world.queueOrder?.[duty.scheduleId];
        const ordered = saved ? [...saved.filter((id) => ids.includes(id)), ...ids.filter((id) => !saved.includes(id))] : ids;
        const name = (id: string) => duty.brokers.find((broker) => broker.id === id)?.name ?? "Corretor";
        return {
          scheduleId: duty.scheduleId,
          dutyDate: duty.dutyDate,
          scheduleName: duty.scheduleName,
          order: ordered.map((id, index) => ({ id, name: name(id), position: index + 1, isNext: index === 0 })),
          blocked: duty.brokers.filter((broker) => !ids.includes(broker.id)).map((broker) => ({ id: broker.id, name: broker.name, reason: broker.presence === "absent" ? "Falta" : "Pausado" })),
          manual: Boolean(saved),
        };
      });
    },
    async setQueueOrder(scheduleId, _dutyDate, brokerIds) {
      if (world.failWrites) throw new Error("Falha simulada do servidor.");
      world.queueOrder = { ...(world.queueOrder ?? {}), [scheduleId]: brokerIds };
    },
    async resetQueueOrder(scheduleId) {
      if (world.failWrites) throw new Error("Falha simulada do servidor.");
      const next = { ...(world.queueOrder ?? {}) };
      delete next[scheduleId];
      world.queueOrder = next;
    },
    async setOnlineMode(_scheduleId, assignmentId, online) {
      if (world.failWrites) throw new Error("Falha simulada do servidor.");
      const set = new Set(world.onlineHere ?? []);
      if (online) set.add(assignmentId); else set.delete(assignmentId);
      world.onlineHere = [...set];
    },
    async sendPresenceInvite(_scheduleId, assignmentId) {
      if (world.failWrites) throw new Error("Falha simulada do servidor.");
      world.invites = [...(world.invites ?? []), assignmentId];
      return { delivered: true };
    },
    async monthPlan(monthKey) {
      const seats = world.seats.filter((seat) => seat.dutyDate.startsWith(monthKey));
      if (!seats.length) return null;
      const draft = (world.draftMonths ?? []).includes(monthKey);
      return {
        id: `plano-${monthKey}`,
        monthKey,
        status: draft ? "draft" as const : "published" as const,
        occurrences: seats.filter((seat) => !seat.ended).length,
        assigned: seats.reduce((sum, seat) => sum + seat.brokerIds.length, 0),
        belowMinimum: seats.filter((seat) => !seat.ended && seat.brokerIds.length < seat.minimumBrokers).length,
        problems: [],
        warnings: [],
        replacesPublished: false,
        people: new Set(seats.flatMap((seat) => seat.brokerIds)).size,
      };
    },
    async publishPlan(planId) {
      if (world.failWrites) throw new Error("Falha simulada do servidor.");
      const monthKey = planId.replace("plano-", "");
      if (!(world.draftMonths ?? []).includes(monthKey)) throw new Error("Esta proposta não está mais em rascunho.");
      world.draftMonths = (world.draftMonths ?? []).filter((item) => item !== monthKey);
    },
    async excludeDay(_monthKey, dutyDate, restore) {
      if (world.failWrites) throw new Error("Falha simulada do servidor.");
      const day = `${dutyDate.slice(8, 10)}/${dutyDate.slice(5, 7)}`;
      if (restore) {
        world.excludedDays = (world.excludedDays ?? []).filter((item) => item !== dutyDate);
        return `O dia ${day} volta na próxima vez que você gerar a escala.`;
      }
      const onDay = world.seats.filter((seat) => seat.dutyDate === dutyDate && !seat.started);
      for (const seat of onDay) seat.brokerIds = [];
      world.seats = world.seats.filter((seat) => !(seat.dutyDate === dutyDate && !seat.started));
      world.excludedDays = [...(world.excludedDays ?? []), dutyDate];
      return `O dia ${day} saiu da escala (${onDay.length} plantões).`;
    },
    async searchLeads(filter) {
      const text = filter.text?.trim().toLowerCase();
      return (world.leads ?? [])
        .filter((lead) => !text || lead.name.toLowerCase().includes(text) || (lead.phoneTail ?? "").includes(text))
        .filter((lead) => !filter.withoutBroker || (!lead.brokerId && lead.distributionStatus === "unassigned"))
        .filter((lead) => !filter.brokerId || lead.brokerId === filter.brokerId)
        .filter((lead) => !filter.status || lead.status === filter.status)
        .slice(0, filter.limit)
        .map(({ scheduleId: _scheduleId, ...lead }) => ({ ...lead }));
    },
    async leadById(leadId) {
      const lead = (world.leads ?? []).find((item) => item.id === leadId);
      if (!lead) return null;
      const { scheduleId: _scheduleId, ...rest } = lead;
      return { ...rest };
    },
    async dutyAvailableLeads(scheduleId) {
      return (world.leads ?? []).filter((lead) => lead.scheduleId === scheduleId && !lead.brokerId && lead.distributionStatus === "unassigned")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map(({ scheduleId: _scheduleId, ...lead }) => ({ ...lead }));
    },
    async assignDutyLead(scheduleId, brokerId, leadId) {
      if (world.failWrites) throw new Error("Falha simulada do servidor.");
      const duty = dutyWindows(0).find((item) => item.running && item.scheduleId === scheduleId);
      const broker = duty?.brokers.find((item) => item.id === brokerId);
      if (!broker) throw new Error("Corretor fora da escala.");
      if (broker.presence === "absent") throw new Error("Corretor com falta neste plantão.");
      if (broker.pausedHere) throw new Error("Corretor pausado neste plantão. Retome antes de atribuir.");
      const lead = (world.leads ?? []).find((item) => item.id === leadId);
      if (!lead || lead.brokerId || lead.scheduleId !== scheduleId) throw new Error("Lead não está disponível neste plantão.");
      lead.brokerId = brokerId;
      lead.brokerName = broker.name;
      lead.distributionStatus = "assigned";
    },
    async giveLead(leadId, brokerId) {
      if (world.failWrites) throw new Error("Falha simulada do servidor.");
      const lead = (world.leads ?? []).find((item) => item.id === leadId);
      if (!lead) throw new Error("Lead não encontrado.");
      if (lead.brokerId === brokerId) throw new Error("Selecione outro corretor para reiniciar o atendimento.");
      if (lead.status === "lost" || lead.status === "converted") throw new Error("Leads encerrados não podem ser reatribuídos.");
      lead.brokerId = brokerId;
      lead.brokerName = world.people.find((person) => person.id === brokerId)?.name ?? null;
      lead.distributionStatus = "assigned";
    },
    async transferPortfolio(fromId, toId) {
      if (world.failWrites) throw new Error("Falha simulada do servidor.");
      const toName = world.people.find((person) => person.id === toId)?.name ?? null;
      const moved = (world.leads ?? []).filter((lead) => lead.brokerId === fromId && lead.status !== "converted" && lead.status !== "lost");
      for (const lead of moved) { lead.brokerId = toId; lead.brokerName = toName; }
      return `${moved.length} leads transferidos.`;
    },
    async resendOffer(leadId) {
      if (world.failWrites) throw new Error("Falha simulada do servidor.");
      const lead = (world.leads ?? []).find((item) => item.id === leadId);
      if (!lead?.brokerId) throw new Error("Este lead não tem corretor para reenviar a oferta.");
      world.offersResent = [...(world.offersResent ?? []), leadId];
    },
    async changeStage(leadIds, status, lostReason) {
      if (world.failWrites) throw new Error("Falha simulada do servidor.");
      if (status === "lost" && !lostReason) throw new Error("Informe o motivo da perda.");
      const changed: string[] = [];
      for (const lead of world.leads ?? []) if (leadIds.includes(lead.id)) { lead.status = status; changed.push(lead.id); }
      return changed;
    },
    async addNote(leadId, text) {
      if (world.failWrites) throw new Error("Falha simulada do servidor.");
      world.notes = [...(world.notes ?? []), { leadId, text }];
    },
    async createTask(leadId, title, dueAt, assigneeIds) {
      if (world.failWrites) throw new Error("Falha simulada do servidor.");
      world.tasks = [...(world.tasks ?? []), { leadId, title, dueAt, assigneeIds }];
    },
    async distributeUnassigned() {
      if (world.failWrites) throw new Error("Falha simulada do servidor.");
      const waiting = (world.leads ?? []).filter((lead) => !lead.brokerId && lead.distributionStatus === "unassigned");
      for (const lead of waiting) lead.distributionStatus = "queued";
      return `${waiting.length} leads entraram na distribuição.`;
    },
    async whatsappDisconnected() {
      return world.whatsappOff ?? [];
    },
    async listBranches() {
      return world.branches ?? [{ id: "b-centro", name: "Centro", active: true }, { id: "b-barra", name: "Barra", active: true }];
    },
    async invite(input) {
      if (world.failWrites) throw new Error("Falha simulada do servidor.");
      if (world.people.some((person) => person.name.toLowerCase() === input.name.toLowerCase())) throw new Error("Já existe um acesso com este nome.");
      const id = `conv-${(world.pending ?? []).length + 1}`;
      world.pending = [...(world.pending ?? []), { id, name: input.name, email: input.email, status: "PENDING", expiresAt: null }];
      return { invitationId: id, whatsappStatus: "queued" };
    },
    async pendingInvites() {
      return (world.pending ?? []).filter((item) => item.status === "PENDING");
    },
    async resendInvite(invitationId) {
      if (!(world.pending ?? []).some((item) => item.id === invitationId)) throw new Error("Convite ou membro não encontrado.");
    },
    async revokeInvite(invitationId) {
      const item = (world.pending ?? []).find((invite) => invite.id === invitationId);
      if (!item || item.status !== "PENDING") throw new Error("Este convite não está mais pendente.");
      item.status = "REVOKED";
    },
    async changeUnit(userId, branchId) {
      if (world.failWrites) throw new Error("Falha simulada do servidor.");
      const person = world.people.find((item) => item.id === userId);
      const branch = (world.branches ?? [{ id: "b-centro", name: "Centro", active: true }, { id: "b-barra", name: "Barra", active: true }]).find((item) => item.id === branchId);
      if (!person || !branch) throw new Error("Pessoa ou unidade não encontrada.");
      person.branchId = branch.id;
      person.branchName = branch.name;
    },
    async setMemberActive(userId, active) {
      if (world.failWrites) throw new Error("Falha simulada do servidor.");
      const person = world.people.find((item) => item.id === userId);
      if (!person) throw new Error("Pessoa não encontrada.");
      person.status = active ? "active" : "inactive";
    },
    async messageBroker(userId, body) {
      if (world.failWrites) throw new Error("Falha simulada do servidor.");
      world.messages = [...(world.messages ?? []), { userId, body }];
    },
    async homeAnnouncement() {
      return world.announcement ?? null;
    },
    async saveHomeAnnouncement(value) {
      if (world.failWrites) throw new Error("Falha simulada do servidor.");
      world.announcement = value;
    },
    async unassignLead(leadId) {
      if (world.failWrites) throw new Error("Falha simulada do servidor.");
      const lead = (world.leads ?? []).find((item) => item.id === leadId);
      if (!lead?.brokerId) throw new Error("A atribuição deste lead não pode ser removida neste estado.");
      lead.brokerId = null;
      lead.brokerName = null;
      lead.distributionStatus = "manual_hold";
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
  const at = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60_000).toISOString();
  const lead = (id: string, name: string, extra: Partial<LeadSummary & { scheduleId: string | null }>) => ({
    id, name, status: "new", brokerId: null, brokerName: null, queueName: "Fila PME", temperature: "warm", distributionStatus: "unassigned", createdAt: at(30), phoneTail: id.slice(-4), scheduleId: null, ...extra,
  });
  const leads = [
    lead("l-0001", "Maria Souza", { scheduleId: "s-manha", createdAt: at(50), temperature: "hot" }),
    lead("l-0002", "João Pereira", { scheduleId: "s-manha", createdAt: at(40) }),
    lead("l-0003", "Paula Reis", { scheduleId: "s-manha", createdAt: at(20), temperature: "cold" }),
    lead("l-0004", "Rafael Lima", { scheduleId: "s-manha", createdAt: at(10), temperature: "hot" }),
    lead("l-0005", "Maria Clara Nunes", { brokerId: "u-carla", brokerName: "Carla Mendes", distributionStatus: "assigned", status: "in_contact", createdAt: at(300) }),
    lead("l-0006", "Sérgio Alves", { brokerId: "u-bruno", brokerName: "Bruno Castro", distributionStatus: "assigned", status: "negotiation", createdAt: at(900) }),
  ];
  return { now, people, seats, leads };
}
