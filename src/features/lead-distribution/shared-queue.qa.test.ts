import { describe, expect, it } from "vitest";
import { defaultIntelligentDistributionPolicy, rankBrokers, resolveDistributionCandidate, type RankedBroker } from "./domain";

/**
 * QA da fila compartilhada: 2+ plantões ativos no mesmo horário disputando a
 * MESMA fila. Leads divididos por menor carga (receivedInDuty do dia da
 * operação), respeitando capacidade dura da fila, exclusão (falta/presencial
 * sem check-in bloqueiam upstream), cooldown e plantão inativo.
 *
 * Cobre só as funções puras de domínio (rankBrokers /
 * resolveDistributionCandidate); pacing (offer-pacing.ts) e presença
 * (duty-presence-domain.ts) já têm seus próprios arquivos de teste.
 */

const now = new Date("2026-10-05T12:00:00.000Z");
const fixedRandom = () => 0;

// Ranking ligado: é o default do tenant e o único caminho que ranqueia por
// menor carga do plantão (receivedInDuty) — ver teste documental no final.
const policy = defaultIntelligentDistributionPolicy;
const policySemRanking = { ...defaultIntelligentDistributionPolicy, ranking: { ...defaultIntelligentDistributionPolicy.ranking, enabled: false } };

function makeBroker(id: string, overrides: Partial<RankedBroker> = {}): RankedBroker {
  return {
    id,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    activeLeads: 0,
    capacity: null,
    onDuty: true,
    receivedInDuty: 0,
    conversionRate: 0,
    slaRate: 0,
    manualPriority: 0,
    idleSince: null,
    lastAssignedAt: null,
    unstartedLeads: 0,
    rankingScore: 0,
    ...overrides,
  };
}

/** Simulates the engine handing one lead out: the winner's duty load grows. */
function pickOnce(brokers: RankedBroker[]): { picked: RankedBroker | null; state: RankedBroker[] } {
  const decision = resolveDistributionCandidate(brokers, policy, "capacity", fixedRandom);
  if (!decision.selected) return { picked: null, state: brokers };
  return {
    picked: decision.selected,
    state: brokers.map((broker) => broker.id === decision.selected!.id ? { ...broker, receivedInDuty: broker.receivedInDuty! + 1 } : broker),
  };
}

describe("fila compartilhada — ranking entre plantões (rankBrokers/resolveDistributionCandidate)", () => {
  it("entre dois plantões na mesma fila, vence o corretor com menor receivedInDuty, mesmo sendo do outro plantão", () => {
    const plantao1 = makeBroker("a1", { receivedInDuty: 3 });
    const plantao2 = makeBroker("b1", { receivedInDuty: 1 });

    const ranked = rankBrokers([plantao1, plantao2], policy, now, fixedRandom);

    expect(ranked[0].id).toBe("b1");
  });

  it("rodadas consecutivas alternam os leads entre os plantões até as cargas se igualarem (menor carga do dia)", () => {
    // Empate de carga do dia é desempatado pela carteira ativa (critério 5).
    let state = [
      makeBroker("a1", { receivedInDuty: 0, activeLeads: 5 }),
      makeBroker("b1", { receivedInDuty: 0, activeLeads: 1 }),
    ];

    const order: string[] = [];
    for (let round = 0; round < 4; round += 1) {
      const result = pickOnce(state);
      expect(result.picked).not.toBeNull();
      order.push(result.picked!.id);
      state = result.state;
    }

    expect(order).toEqual(["b1", "a1", "b1", "a1"]);
  });

  it("totais por plantão somam o total da fila: partição dos elegíveis cobre todos os corretores, sem duplicar", () => {
    const fila = [
      makeBroker("a1", { receivedInDuty: 2 }),
      makeBroker("a2", { receivedInDuty: 0 }),
      makeBroker("b1", { receivedInDuty: 1 }),
      makeBroker("b2", { receivedInDuty: 0 }),
    ];

    const decision = resolveDistributionCandidate(fila, policy, "capacity", fixedRandom);

    const plantao1 = decision.eligible.filter((broker) => broker.id.startsWith("a"));
    const plantao2 = decision.eligible.filter((broker) => broker.id.startsWith("b"));

    expect(decision.eligible).toHaveLength(fila.length);
    expect(plantao1).toHaveLength(2);
    expect(plantao2).toHaveLength(2);
    expect([...plantao1, ...plantao2].map((broker) => broker.id).sort()).toEqual(fila.map((broker) => broker.id).sort());
  });

  it("6 leads distribuídos na fila compartilhada caem por plantão de forma equilibrada (diferença ≤ 1)", () => {
    let state = [
      makeBroker("a1", { receivedInDuty: 1 }),
      makeBroker("a2", { receivedInDuty: 1 }),
      makeBroker("b1", { receivedInDuty: 1 }),
      makeBroker("b2", { receivedInDuty: 1 }),
    ];

    let delivered = 0;
    const perPlantao = { a: 0, b: 0 };
    for (let round = 0; round < 6; round += 1) {
      const result = pickOnce(state);
      expect(result.picked).not.toBeNull();
      delivered += 1;
      perPlantao[result.picked!.id[0] as "a" | "b"] += 1;
      state = result.state;
    }

    expect(delivered).toBe(6);
    expect(Math.abs(perPlantao.a - perPlantao.b)).toBeLessThanOrEqual(1);
  });

  it("capacidade da fila é dura: corretor no limite (activeLeads >= capacity) nunca recebe, mesmo onDuty e com menor carga do dia", () => {
    const noLimite = makeBroker("a1", { activeLeads: 2, capacity: 2, receivedInDuty: 0 });
    const comVaga = makeBroker("b1", { activeLeads: 1, capacity: 2, receivedInDuty: 5 });

    const decision = resolveDistributionCandidate([noLimite, comVaga], policy, "capacity", fixedRandom);

    expect(decision.eligible.map((broker) => broker.id)).toEqual(["b1"]);
    expect(decision.selected?.id).toBe("b1");
  });

  it("todos os elegíveis no limite da fila: selected=null → o lead permanece 'Aguardando corretor'", () => {
    const cheio1 = makeBroker("a1", { activeLeads: 2, capacity: 2 });
    const cheio2 = makeBroker("b1", { activeLeads: 2, capacity: 2 });

    const decision = resolveDistributionCandidate([cheio1, cheio2], policy, "capacity", fixedRandom);

    expect(decision.eligible).toEqual([]);
    expect(decision.selected).toBeNull();
  });

  it("corretor com falta registrada ou presencial sem check-in (excluído upstream) fica fora da disputa mesmo com menor carga", () => {
    const excluido = makeBroker("b1", { receivedInDuty: 0 });
    const ativo = makeBroker("a1", { receivedInDuty: 4 });
    const comFaltaOuPresencialPendente = { ...policy, excludedBrokerIds: ["b1"] };

    const decision = resolveDistributionCandidate([excluido, ativo], comFaltaOuPresencialPendente, "capacity", fixedRandom);

    expect(decision.eligible.map((broker) => broker.id)).toEqual(["a1"]);
    expect(decision.selected?.id).toBe("a1");
  });

  it("cooldown de 5 minutos: com cargas iguais, quem recebeu há pouco perde para quem está descansado", () => {
    const agoraRecebeu = makeBroker("a1", { receivedInDuty: 1, lastAssignedAt: new Date(now.getTime() - 60_000) });
    const descansado = makeBroker("b1", { receivedInDuty: 1, lastAssignedAt: new Date(now.getTime() - 20 * 60_000) });

    const ranked = rankBrokers([agoraRecebeu, descansado], policy, now, fixedRandom);

    expect(ranked[0].id).toBe("b1");
  });

  it("plantão inativo (onDuty=false) perde para corretor em plantão ativo mesmo tendo menor carga", () => {
    const emPlantao = makeBroker("a1", { onDuty: true, receivedInDuty: 5 });
    const plantaoInativo = makeBroker("b1", { onDuty: false, receivedInDuty: 0 });

    const ranked = rankBrokers([emPlantao, plantaoInativo], policy, now, fixedRandom);

    expect(ranked[0].id).toBe("a1");
  });

  it("ACHADO: com ranking inteligente desligado, a estratégia capacity ignora receivedInDuty — fila compartilhada NÃO equilibra por carga do plantão (domain.ts:190-192)", () => {
    // chooseBroker ordena só por activeLeads (carteira ativa): o corretor com
    // menos carga do dia (receivedInDuty) não sobe. Na fila compartilhada,
    // desligar o ranking desliga o balanceamento entre plantões.
    const menosCargaNoDia = makeBroker("a1", { receivedInDuty: 0, activeLeads: 5 });
    const maisCargaNoDia = makeBroker("b1", { receivedInDuty: 4, activeLeads: 1 });

    const decision = resolveDistributionCandidate([menosCargaNoDia, maisCargaNoDia], policySemRanking, "capacity", fixedRandom);

    expect(decision.selected?.id).toBe("b1");
  });
});
