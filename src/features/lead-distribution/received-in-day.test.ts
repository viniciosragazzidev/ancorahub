import { describe, expect, it } from "vitest";

import { chooseBroker, defaultIntelligentDistributionPolicy, resolveDistributionCandidate, type RankedBroker } from "./domain";
import { countReceivedInDayByBroker, getDutyScheduleReceiptScope, pickNextByReceivedInDay, type DayReceipt } from "./received-in-day";

const since = new Date("2026-10-26T22:00:00.000Z"); // 19:00 de 26/10 em São Paulo
const at = (hhmm: string) => new Date(`2026-10-27T${hhmm}:00.000-03:00`);

function broker(id: string, overrides: Partial<RankedBroker> = {}): RankedBroker {
  return { id, createdAt: new Date("2026-01-01T00:00:00.000Z"), activeLeads: 0, capacity: null, onDuty: true, conversionRate: 0, slaRate: 0, manualPriority: 0, idleSince: null, rankingScore: 0, ...overrides };
}

/** Seeded random, so the shuffled ties are reproducible. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return state / 2 ** 31;
  };
}

describe("DEC-154: nivelamento pelo dia da operação", () => {
  function runBurst(leads: number, ids: string[], start: Map<string, number>, seed: number) {
    const received = new Map(start);
    const random = seeded(seed);
    for (let lead = 0; lead < leads; lead += 1) {
      // Each pick is serialized by the lock: it sees the count written by the previous one.
      const candidates = ids.map((id) => broker(id, { receivedInDuty: received.get(id) ?? 0, activeLeads: Math.floor(random() * 5) }));
      const decision = resolveDistributionCandidate(candidates, defaultIntelligentDistributionPolicy, "capacity", random);
      const locked = pickNextByReceivedInDay(decision.eligible.map((candidate) => candidate.id), received);
      expect(locked).toBe(decision.selected?.id);
      received.set(locked!, (received.get(locked!) ?? 0) + 1);
    }
    return ids.map((id) => received.get(id) ?? 0);
  }

  it("(a) um burst de N leads com M corretores disponíveis termina nivelado (diferença máxima 1)", () => {
    for (const [leads, brokers, seed] of [[5, 2, 1], [23, 4, 7], [40, 6, 3], [9, 9, 11], [3, 5, 5], [17, 3, 13]] as const) {
      const ids = Array.from({ length: brokers }, (_, index) => `b${index}`);
      const counts = runBurst(leads, ids, new Map(), seed);
      expect(counts.reduce((sum, value) => sum + value, 0)).toBe(leads);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    }
  });

  it("(a) quem já tinha recebido no dia não leva o burst: os outros alcançam primeiro", () => {
    const counts = runBurst(10, ["a", "b", "c", "d"], new Map([["a", 2]]), 9);
    expect(counts).toEqual([3, 3, 3, 3]);
  });

  it("(a) a escolha sob a trava refaz a ordem com a contagem nova, mesmo se a pré-leitura estiver velha", () => {
    // Five jobs read "everyone has 0" at the same time; under the lock each sees the previous offer.
    const order = ["ana", "bia", "caio"];
    const received = new Map<string, number>();
    const picks: string[] = [];
    for (let lead = 0; lead < 5; lead += 1) {
      const pick = pickNextByReceivedInDay(order, received)!;
      picks.push(pick);
      received.set(pick, (received.get(pick) ?? 0) + 1);
    }
    expect(picks).toEqual(["ana", "bia", "caio", "ana", "bia"]);
  });

  it("(a) quem está no plantão ativo vem antes, mesmo com mais recebidos", () => {
    const received = new Map([["on", 4], ["off", 0]]);
    expect(pickNextByReceivedInDay(["off", "on"], received, { on: 0, off: 1 })).toBe("on");
  });

  it("(a) corretor fora do mapa de plantão conta como fora do plantão, não como ativo", () => {
    // "solto" não está no mapa e tem 0 recebidos; "plantao" está no plantão com 3.
    const received = new Map([["solto", 0], ["plantao", 3]]);
    expect(pickNextByReceivedInDay(["solto", "plantao"], received, { plantao: 0 })).toBe("plantao");
  });

  it("(b) oferta EXPIRED e DECLINED contam; CANCELLED não", () => {
    const receipts: DayReceipt[] = [
      { brokerId: "lento", leadId: "l1", receivedAt: at("09:01"), offerStatus: "EXPIRED" },
      { brokerId: "lento", leadId: "l2", receivedAt: at("09:05"), offerStatus: "DECLINED" },
      { brokerId: "lento", leadId: "l3", receivedAt: at("09:06"), offerStatus: "LOST" },
      { brokerId: "sem-canal", leadId: "l4", receivedAt: at("09:02"), offerStatus: "CANCELLED" },
      { brokerId: "sem-canal", leadId: "l5", receivedAt: at("09:03"), offerStatus: "PENDING" },
    ];
    const counts = countReceivedInDayByBroker(receipts, since);
    expect(counts.get("lento")).toBe(3);
    expect(counts.get("sem-canal")).toBe(1);
  });

  it("(b) o mesmo lead conta uma vez por corretor, e o dia anterior fica de fora", () => {
    const counts = countReceivedInDayByBroker([
      { brokerId: "a", leadId: "l1", receivedAt: at("09:00"), offerStatus: "EXPIRED" },
      { brokerId: "a", leadId: "l1", receivedAt: at("10:00") },
      { brokerId: "a", leadId: "l1", receivedAt: at("10:00"), offerStatus: "ACCEPTED" },
      { brokerId: "a", leadId: "old", receivedAt: new Date("2026-10-26T21:59:00.000Z") },
      { brokerId: null, leadId: "l9", receivedAt: at("09:00") },
    ], since);
    expect(counts.get("a")).toBe(1);
    expect(counts.size).toBe(1);
  });

  it("(c) o recebimento de outro plantão não penaliza o corretor neste plantão", () => {
    const counts = countReceivedInDayByBroker([
      { brokerId: "duplo", leadId: "m1", dutyScheduleId: "manha", receivedAt: at("08:10") },
      { brokerId: "duplo", leadId: "m2", dutyScheduleId: "manha", receivedAt: at("10:30"), offerStatus: "EXPIRED" },
      { brokerId: "duplo", leadId: "t1", dutyScheduleId: "tarde", receivedAt: at("14:00") },
      { brokerId: "duplo", leadId: "t2", dutyScheduleId: "tarde", receivedAt: at("14:05") },
      { brokerId: "colega", leadId: "c1", dutyScheduleId: "tarde", receivedAt: at("14:07") },
      { brokerId: "colega", leadId: "c2", dutyScheduleId: "tarde", receivedAt: at("14:08") },
    ], since, { duplo: "tarde", colega: "tarde" });
    expect(counts.get("duplo")).toBe(2);
    expect(counts.get("colega")).toBe(2);
    expect(pickNextByReceivedInDay(["duplo", "colega"], counts)).toBe("duplo");
  });

  it("(c) a fila sem plantão ignora indicações vinculadas a plantões", () => {
    const counts = countReceivedInDayByBroker([
      { brokerId: "fila", leadId: "shifted", dutyScheduleId: "presencial", receivedAt: at("14:00") },
      { brokerId: "fila", leadId: "unscoped", dutyScheduleId: null, receivedAt: at("14:05") },
      { brokerId: "colega", leadId: "shifted-colleague", dutyScheduleId: "presencial", receivedAt: at("14:07") },
    ], since, {});
    expect(counts.get("fila")).toBe(1);
    expect(counts.has("colega")).toBe(false);
  });

  it("(c) a prévia de cada plantão usa o mesmo escopo de recebimentos da escolha", () => {
    const receipts: DayReceipt[] = [
      { brokerId: "duplo", leadId: "manha-1", dutyScheduleId: "manha", receivedAt: at("09:00") },
      { brokerId: "duplo", leadId: "tarde-1", dutyScheduleId: "tarde", receivedAt: at("14:00") },
      { brokerId: "colega", leadId: "tarde-2", dutyScheduleId: "tarde", receivedAt: at("14:05") },
    ];
    const scheduleScope = getDutyScheduleReceiptScope({ duplo: "tarde", colega: "tarde" }, true);
    const previewCounts = countReceivedInDayByBroker(receipts, since, scheduleScope);
    expect(previewCounts).toEqual(new Map([["duplo", 1], ["colega", 1]]));
    expect(pickNextByReceivedInDay(["duplo", "colega"], previewCounts)).toBe("duplo");
  });

  it("(d) chooseBroker com ranking desligado respeita os recebidos no dia antes da carteira", () => {
    const pick = chooseBroker([
      { id: "carteira-leve", createdAt: new Date(), activeLeads: 0, capacity: null, receivedInDuty: 4 },
      { id: "dia-leve", createdAt: new Date(), activeLeads: 9, capacity: null, receivedInDuty: 1 },
    ], "capacity");
    expect(pick?.id).toBe("dia-leve");

    const policy = { ...defaultIntelligentDistributionPolicy, ranking: { ...defaultIntelligentDistributionPolicy.ranking, enabled: false } };
    const decision = resolveDistributionCandidate([
      broker("carteira-leve", { activeLeads: 0, receivedInDuty: 4 }),
      broker("dia-leve", { activeLeads: 9, receivedInDuty: 1 }),
    ], policy, "capacity");
    expect(decision.selected?.id).toBe("dia-leve");
  });

  it("(d) chooseBroker: plantão ativo antes, e round_robin continua pela conta mais antiga", () => {
    expect(chooseBroker([
      { id: "fora", createdAt: new Date(), activeLeads: 0, capacity: null, receivedInDuty: 0, onDuty: false },
      { id: "plantao", createdAt: new Date(), activeLeads: 0, capacity: null, receivedInDuty: 3, onDuty: true },
    ], "capacity")?.id).toBe("plantao");
    expect(chooseBroker([
      { id: "nova", createdAt: new Date("2026-05-01"), activeLeads: 0, capacity: null, receivedInDuty: 0 },
      { id: "antiga", createdAt: new Date("2026-01-01"), activeLeads: 0, capacity: null, receivedInDuty: 7 },
    ], "round_robin")?.id).toBe("antiga");
  });
});
