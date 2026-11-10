import { describe, expect, it } from "vitest";

import { defaultIntelligentDistributionPolicy, KEEP_ORDER_RANDOM, rankBrokers, resolveDistributionCandidate, resolveWeightedDistributionCandidate, shuffle, type RankedBroker } from "./domain";
import { previewQueueOrder, type DutyQueueCandidate } from "./duty-queue-order";
import {
  buildPlantaoLoadFactors,
  buildPlantaoPriorityOfferMetadata,
  clampPlantaoWeight,
  compareEffectiveLoad,
  computeAdaptiveWeight,
  DEFAULT_PLANTAO_PRIORITY_SETTINGS,
  effectiveLoadKey,
  elapsedDutyMinutes,
  isPlantaoExpiryGuardTripped,
  isPlantaoShareCapExceeded,
  normalizePlantaoPrioritySettings,
  plantaoPrioritySettingKey,
  resolvePlantaoTypeWeight,
  type PlantaoPriorityDecision,
} from "./plantao-priority-core";
import { pickNextByReceivedInDay } from "./received-in-day-core";

const policy = defaultIntelligentDistributionPolicy;
const createdAt = new Date("2026-01-01T00:00:00.000Z");

function broker(id: string, receivedInDuty: number, extra: Partial<RankedBroker> = {}): RankedBroker {
  return { id, createdAt, activeLeads: 0, capacity: null, onDuty: true, receivedInDuty, conversionRate: 0, slaRate: 0, manualPriority: 0, idleSince: null, unstartedLeads: 0, rankingScore: 0, ...extra };
}

/** Gerador determinístico (LCG) para cenários aleatórios reprodutíveis. */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/** Distribui `leads` leads entre plantões de 1 corretor pela escolha sob trava. */
function simulate(factorByBroker: Record<string, number> | null, leads: number, order: string[]) {
  const received = new Map(order.map((id) => [id, 0]));
  for (let index = 0; index < leads; index++) {
    const picked = pickNextByReceivedInDay(order, received, Object.fromEntries(order.map((id) => [id, 0])), factorByBroker)!;
    received.set(picked, (received.get(picked) ?? 0) + 1);
  }
  return Object.fromEntries(received);
}

describe("configuração da prioridade por tipo de plantão", () => {
  it("fica desligada quando a chave não existe ou é inválida", () => {
    expect(normalizePlantaoPrioritySettings(undefined)).toEqual(DEFAULT_PLANTAO_PRIORITY_SETTINGS);
    expect(normalizePlantaoPrioritySettings("x").mode).toBe("off");
    expect(normalizePlantaoPrioritySettings({ mode: "talvez" }).mode).toBe("off");
    expect(plantaoPrioritySettingKey("t1")).toBe("plantao_priority_t1");
  });

  it("trava o peso entre 1,0 e 1,3 e só aceita quente e morno", () => {
    const settings = normalizePlantaoPrioritySettings({ mode: "shadow", temps: ["hot", "cold", "warm"], cap: 5, types: { premium: { base: 2 }, pme: { base: 0.5, adaptive: true } } });
    expect(settings.mode).toBe("shadow");
    expect(settings.temps).toEqual(["hot", "warm"]);
    expect(settings.cap).toBe(1.3);
    expect(settings.types.premium).toEqual({ base: 1.3, adaptive: false });
    expect(settings.types.pme).toEqual({ base: 1, adaptive: true });
    expect(clampPlantaoWeight(1.15)).toBe(1.15);
    expect(clampPlantaoWeight(1.25, 1.2)).toBe(1.2);
  });
});

describe("carga efetiva compartilhada", () => {
  it("w=1 não muda nada: sem fator diferente não há fatores", () => {
    expect(buildPlantaoLoadFactors({ brokerIds: ["a", "b"], scheduleIdByBroker: { a: "s1", b: "s2" }, weightScaledBySchedule: { s1: 1000, s2: 1000 } })).toBeNull();
    // Mesmo com fatores iguais a ordem é exatamente a da contagem crua.
    const brokers = [broker("a", 3), broker("b", 1), broker("c", 2), broker("d", 1)];
    const random = seeded(7);
    const baseline = rankBrokers(brokers, policy, new Date(), random).map((item) => item.id);
    const equal = rankBrokers(baseline.map((id) => ({ ...brokers.find((item) => item.id === id)!, loadFactor: 1000 })), policy, new Date(), KEEP_ORDER_RANDOM).map((item) => item.id);
    expect(equal).toEqual(baseline);
    expect(compareEffectiveLoad(4, undefined, 2, undefined)).toBe(2);
  });

  it("w=1,2 dá 6:5 entre Premium e o outro plantão", () => {
    const factors = { premium: 1200, outro: 1000 };
    expect(simulate(factors, 11, ["outro", "premium"])).toEqual({ outro: 5, premium: 6 });
    expect(simulate(factors, 110, ["premium", "outro"])).toEqual({ premium: 60, outro: 50 });
    // Sem peso, metade para cada.
    expect(simulate(null, 110, ["premium", "outro"])).toEqual({ premium: 55, outro: 55 });
  });

  it("empate exato continua empate (6/1,2 = 5/1) e mantém a ordem recebida", () => {
    expect(compareEffectiveLoad(6, 1200, 5, 1000)).toBe(0);
    expect(effectiveLoadKey(6, 1200)).toBe(effectiveLoadKey(5, 1000));
    expect(effectiveLoadKey(0, 1200)).toBe(effectiveLoadKey(0, 1000));
    const received = new Map([["outro", 5], ["premium", 6]]);
    expect(pickNextByReceivedInDay(["outro", "premium"], received, {}, { premium: 1200, outro: 1000 })).toBe("outro");
    expect(pickNextByReceivedInDay(["premium", "outro"], received, {}, { premium: 1200, outro: 1000 })).toBe("premium");
  });

  it("lead frio ignora o peso", () => {
    const common = { base: 1.2, cap: 1.3, temps: ["hot", "warm"], shareCap: 1.3 };
    expect(resolvePlantaoTypeWeight({ ...common, temperature: "cold" })).toEqual({ w: 1, reason: "temperatura_fora" });
    expect(resolvePlantaoTypeWeight({ ...common, temperature: null })).toEqual({ w: 1, reason: "temperatura_fora" });
    expect(resolvePlantaoTypeWeight({ ...common, temperature: "hot" })).toEqual({ w: 1.2, reason: "peso_base" });
    expect(resolvePlantaoTypeWeight({ ...common, temperature: "warm", temps: ["hot"] })).toEqual({ w: 1, reason: "temperatura_fora" });
  });

  it("escolha sob trava = ranking (mesma função, 500 cenários aleatórios)", () => {
    const random = seeded(42);
    for (let scenario = 0; scenario < 500; scenario++) {
      const size = 2 + Math.floor(random() * 6);
      const brokers = Array.from({ length: size }, (_, index) => broker(`b${index}`, Math.floor(random() * 8), {
        loadFactor: [1000, 1100, 1150, 1200, 1300][Math.floor(random() * 5)] * (60 + Math.floor(random() * 500)),
        activeLeads: Math.floor(random() * 3),
      }));
      const ranked = rankBrokers(brokers, policy, new Date(), random);
      const received = new Map(ranked.map((item) => [item.id, item.receivedInDuty ?? 0]));
      const factors = Object.fromEntries(ranked.map((item) => [item.id, item.loadFactor!]));
      const locked = pickNextByReceivedInDay(ranked.map((item) => item.id), received, Object.fromEntries(ranked.map((item) => [item.id, 0])), factors);
      expect(locked).toBe(ranked[0].id);
    }
  });

  it("prévia da fila = ranking", () => {
    const candidates: DutyQueueCandidate[] = [
      { ...broker("ana", 4), name: "Ana" },
      { ...broker("bia", 5), name: "Bia" },
      { ...broker("caio", 3), name: "Caio" },
    ];
    // Ana e Bia no Premium (1,2), Caio no outro plantão (1,0).
    const factors = { ana: 1200, bia: 1200, caio: 1000 };
    const ranking = resolveWeightedDistributionCandidate(candidates, factors, policy, "capacity");
    const preview = previewQueueOrder({
      candidates,
      policy,
      strategy: "capacity",
      receivedByBroker: new Map(candidates.map((item) => [item.id, item.receivedInDuty ?? 0])),
      tierByBroker: { ana: 0, bia: 0, caio: 0 },
      factorByBroker: factors,
    });
    // 4/1,2 = 3,33 > 3/1 = 3: Caio continua na frente; Ana antes de Bia.
    expect(ranking.selected?.id).toBe("caio");
    expect(preview.nextBrokerId).toBe(ranking.selected?.id);
    expect(preview.order.map((item) => item.id)).toEqual(ranking.eligible.map((item) => item.id));
    // Com Caio em 4, Ana passa (3,33 < 4).
    const shifted = candidates.map((item) => item.id === "caio" ? { ...item, receivedInDuty: 4 } : item);
    const preview2 = previewQueueOrder({ candidates: shifted, policy, strategy: "capacity", receivedByBroker: new Map(shifted.map((item) => [item.id, item.receivedInDuty ?? 0])), tierByBroker: { ana: 0, bia: 0, caio: 0 }, factorByBroker: factors });
    expect(preview2.nextBrokerId).toBe("ana");
    expect(resolveWeightedDistributionCandidate(shifted, factors, policy, "capacity").selected?.id).toBe("ana");
  });

  it("KEEP_ORDER_RANDOM não embaralha (o modo sombra só mede o efeito do peso)", () => {
    const items = Array.from({ length: 50 }, (_, index) => index);
    expect(shuffle(items, KEEP_ORDER_RANDOM)).toEqual(items);
  });
});

describe("proteções", () => {
  const hot = { base: 1.2, cap: 1.3, temps: ["hot", "warm"], shareCap: 1.3, temperature: "hot" };

  it("teto de fatia: Premium acima de 1,3× a fatia justa volta a peso 1", () => {
    // 4 de 10 escalados = 40% justo; teto 52%. 60 de 100 ofertas = 60% → excede.
    const over = { typeOffers: 60, totalOffers: 100, typeBrokers: 4, totalBrokers: 10 };
    expect(isPlantaoShareCapExceeded(over, 1.3)).toBe(true);
    expect(resolvePlantaoTypeWeight({ ...hot, share: over })).toEqual({ w: 1, reason: "teto_de_fatia" });
    // 50% < 52% → mantém.
    expect(resolvePlantaoTypeWeight({ ...hot, share: { ...over, typeOffers: 50 } })).toEqual({ w: 1.2, reason: "peso_base" });
    // Exatamente no teto (52%) não excede.
    expect(isPlantaoShareCapExceeded({ ...over, typeOffers: 52 }, 1.3)).toBe(false);
    // Amostra pequena no começo do dia: não aplica.
    expect(isPlantaoShareCapExceeded({ typeOffers: 5, totalOffers: 5, typeBrokers: 1, totalBrokers: 10 }, 1.3)).toBe(false);
  });

  it("expiração acima de 12% em 2 h volta a peso 1", () => {
    expect(isPlantaoExpiryGuardTripped({ expired: 3, resolved: 25 })).toBe(false); // 12%
    expect(isPlantaoExpiryGuardTripped({ expired: 4, resolved: 25 })).toBe(true); // 16%
    expect(isPlantaoExpiryGuardTripped({ expired: 0, resolved: 0 })).toBe(false);
    expect(resolvePlantaoTypeWeight({ ...hot, expiry: { expired: 4, resolved: 25 } })).toEqual({ w: 1, reason: "expiracao_alta" });
  });

  it("Premium cheio ou pausado: o lead vai para o outro plantão, sem travar", () => {
    const factors = { premium1: 1300, premium2: 1300, outro: 1000 };
    // Premium no limite da fila (capacity) sai do ranking; o outro recebe mesmo com mais leads.
    const full = [broker("premium1", 0, { capacity: 2, activeLeads: 2 }), broker("premium2", 1, { capacity: 2, activeLeads: 2 }), broker("outro", 9)];
    expect(resolveWeightedDistributionCandidate(full, factors, policy, "capacity").selected?.id).toBe("outro");
    // Premium pausado nem entra nos candidatos: sem diferença de peso, sem fatores.
    expect(buildPlantaoLoadFactors({ brokerIds: ["outro", "outro2"], scheduleIdByBroker: { outro: "s2", outro2: "s2" }, weightScaledBySchedule: { s1: 1300, s2: 1000 } })).toBeNull();
    // Na escolha sob trava, um corretor sem fator volta para a comparação crua (nunca bloqueia).
    expect(pickNextByReceivedInDay(["x", "y"], new Map([["x", 2], ["y", 1]]), {}, { x: 1300 })).toBe("y");
  });

  it("rajada da tarde: nivela por recebidos ÷ minutos cumpridos", () => {
    const since = new Date("2026-11-09T22:00:00.000Z"); // 19:00 SP
    const now = new Date("2026-11-10T16:00:00.000Z"); // 13:00 SP
    const morningStart = new Date("2026-11-10T11:00:00.000Z"); // 08:00 SP
    expect(elapsedDutyMinutes(morningStart, since, now)).toBe(300);
    expect(elapsedDutyMinutes(now, since, now)).toBe(60); // tarde acabou de abrir: mínimo de 1 h
    const factors = buildPlantaoLoadFactors({
      brokerIds: ["manha", "tarde"],
      scheduleIdByBroker: { manha: "s-manha", tarde: "s-tarde" },
      weightScaledBySchedule: { "s-manha": 1000, "s-tarde": 1000 },
      elapsedMinutesBySchedule: { "s-manha": 300, "s-tarde": 60 },
    })!;
    // Manhã com 10 leads em 5 h = 2/h. A tarde recebe 2 e depois alterna (antes recebia 10 seguidos).
    const received = new Map([["manha", 10], ["tarde", 0]]);
    const picks: string[] = [];
    for (let index = 0; index < 4; index++) {
      const picked = pickNextByReceivedInDay(["manha", "tarde"], received, {}, factors)!;
      picks.push(picked);
      received.set(picked, received.get(picked)! + 1);
    }
    expect(picks).toEqual(["tarde", "tarde", "manha", "tarde"]);
    // Um corretor sem minutos conhecidos desliga o nivelamento por horas do grupo todo.
    expect(buildPlantaoLoadFactors({ brokerIds: ["manha", "x"], scheduleIdByBroker: { manha: "s-manha" }, weightScaledBySchedule: { "s-manha": 1000 }, elapsedMinutesBySchedule: { "s-manha": 300 } })).toBeNull();
  });
});

describe("peso adaptativo (desligado por padrão)", () => {
  it("sem amostra mínima mantém o peso anterior", () => {
    expect(computeAdaptiveWeight({ sales: 29, leads: 1000, globalSales: 100, globalLeads: 5000, previous: 1.15 })).toMatchObject({ w: 1.15, reason: "amostra_insuficiente" });
    expect(computeAdaptiveWeight({ sales: 40, leads: 149, globalSales: 100, globalLeads: 5000, previous: 1.1 })).toMatchObject({ w: 1.1, reason: "amostra_insuficiente" });
  });

  it("encolhe a taxa para a média global com α=200", () => {
    // r_global = 2%; tipo: 60/1000 = 6%. r̂ = (60 + 200·0,02)/(1200) = 64/1200 = 5,33%.
    const result = computeAdaptiveWeight({ sales: 60, leads: 1000, globalSales: 100, globalLeads: 5000, previous: 1 });
    expect(result.shrunkRate).toBeCloseTo(64 / 1200, 10);
    // Alvo = 1 + 0,5·(2,67 − 1) = 1,83 → teto 1,3. Passo máximo: 1,0 → 1,05.
    expect(result.target).toBe(1.3);
    expect(result.w).toBe(1.05);
  });

  it("anda no máximo ±0,05 por dia e respeita o clamp 1,0–1,3", () => {
    // Taxa igual à global: alvo 1,0. De 1,3 desce só até 1,25.
    expect(computeAdaptiveWeight({ sales: 40, leads: 2000, globalSales: 100, globalLeads: 5000, previous: 1.3 }).w).toBe(1.25);
    // Taxa abaixo da global nunca vai abaixo de 1,0.
    expect(computeAdaptiveWeight({ sales: 30, leads: 5000, globalSales: 100, globalLeads: 5000, previous: 1.02 }).w).toBe(1);
    // Perto do alvo, chega nele sem passar.
    const near = computeAdaptiveWeight({ sales: 44, leads: 2000, globalSales: 100, globalLeads: 5000, previous: 1.03 });
    expect(near.w).toBeCloseTo(near.target!, 3);
    // Teto configurado menor que 1,3.
    expect(computeAdaptiveWeight({ sales: 200, leads: 1000, globalSales: 100, globalLeads: 5000, previous: 1.18, cap: 1.2 }).w).toBe(1.2);
  });
});

describe("registro no offer_sent", () => {
  const decision: PlantaoPriorityDecision = {
    mode: "shadow",
    factorByBroker: { a: 1200, b: 1000 },
    scheduleIdByBroker: { a: "premium", b: "presencial" },
    weightBySchedule: { premium: 1.2, presencial: 1 },
    reasonBySchedule: { premium: "peso_base", presencial: "sem_peso" },
    typeIdBySchedule: { premium: "t-premium", presencial: "t-presencial" },
    hoursLeveling: false,
  };

  it("modo sombra: a oferta real é a de hoje; a ponderada só é registrada", () => {
    expect(buildPlantaoPriorityOfferMetadata({ decision, offeredBrokerId: "b", baselineBrokerId: "b", weightedBrokerId: "a" })).toEqual({
      mode: "shadow", w: 1.2, chosenScheduleId: "premium", baselineScheduleId: "presencial", chosenTypeId: "t-premium", baselineTypeId: "t-presencial", changed: true, reason: "peso_base", hoursLeveling: false,
    });
    expect(buildPlantaoPriorityOfferMetadata({ decision, offeredBrokerId: "b", baselineBrokerId: "b", weightedBrokerId: "b" }).changed).toBe(false);
  });

  it("modo on: a oferta real é a ponderada", () => {
    const meta = buildPlantaoPriorityOfferMetadata({ decision: { ...decision, mode: "on" }, offeredBrokerId: "a", baselineBrokerId: "b", weightedBrokerId: "a" });
    expect(meta).toMatchObject({ mode: "on", chosenScheduleId: "premium", baselineScheduleId: "presencial", changed: true, w: 1.2 });
  });

  it("baseline sem peso devolve a mesma escolha de hoje", () => {
    const brokers = [broker("a", 2), broker("b", 1)];
    const baseline = resolveDistributionCandidate(brokers, policy, "capacity", seeded(3));
    expect(resolveWeightedDistributionCandidate(baseline.eligible, { a: 1000, b: 1000 }, policy, "capacity").selected?.id).toBe(baseline.selected?.id);
  });
});
