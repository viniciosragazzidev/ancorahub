import { describe, expect, it } from "vitest";

import { defaultIntelligentDistributionPolicy } from "./domain";
import { chooseManualQueuePick, dutyQueueHistorySince, mergeEligibleOrderKeepingBlockedSlots, manualQueueSettingKeyForBroker, pickManualQueueBroker, previewQueueOrder, reconcileManualQueueOrder, rotateManualQueueAfterPick, type DutyQueueCandidate } from "./duty-queue-order";

function candidate(id: string, overrides: Partial<DutyQueueCandidate> = {}): DutyQueueCandidate {
  return {
    id,
    name: id,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    activeLeads: 0,
    capacity: null,
    onDuty: true,
    receivedInDuty: 0,
    conversionRate: 0,
    slaRate: 0,
    manualPriority: 0,
    idleSince: null,
    rankingScore: 0,
    ...overrides,
  };
}

describe("fila visual e rodízio por plantão", () => {
  it("limita os desempates de histórico aos últimos 30 dias", () => {
    const now = new Date("2026-10-27T18:00:00.000Z");
    expect(dutyQueueHistorySince(now)).toEqual(new Date("2026-09-27T18:00:00.000Z"));
  });

  it("resolve a chave manual somente pela ocorrência do corretor escolhido", () => {
    const scope = {
      scheduleIdByBroker: { ana: "manha", bia: "tarde" },
      dutyDateBySchedule: { manha: "2026-10-27", tarde: "2026-10-27" },
    };
    expect(manualQueueSettingKeyForBroker(scope, "ana")).toBe("manual-queue:manha:2026-10-27");
    expect(manualQueueSettingKeyForBroker(scope, "bia")).toBe("manual-queue:tarde:2026-10-27");
    expect(manualQueueSettingKeyForBroker(scope, null)).toBeNull();
  });

  it("a prévia automática usa o mesmo resolver e aponta o selecionado", () => {
    const result = previewQueueOrder({
      candidates: [candidate("ana", { receivedInDuty: 3 }), candidate("bia", { receivedInDuty: 1 })],
      policy: defaultIntelligentDistributionPolicy,
      strategy: "capacity",
      receivedByBroker: new Map([["ana", 3], ["bia", 1]]),
      tierByBroker: { ana: 0, bia: 0 },
    });
    expect(result.nextBrokerId).toBe("bia");
    expect(result.order.map((item) => item.id)).toEqual(["bia", "ana"]);
    const actualPick = chooseManualQueuePick({
      lockAcquired: false,
      automaticBrokerId: result.nextBrokerId,
      pendingBrokerIds: result.order.map((item) => item.id),
      scheduleIdByBroker: { ana: "manha", bia: "manha" },
      queueBySchedule: {},
      rosterBrokerIdsBySchedule: { manha: ["ana", "bia"] },
    });
    expect(actualPick.brokerId).toBe(result.nextBrokerId);
  });

  it("empate real fica sinalizado e uma ordem manual remove a indicação de sorteio", () => {
    const candidates = [candidate("ana"), candidate("bia")];
    const automatic = previewQueueOrder({ candidates, policy: defaultIntelligentDistributionPolicy, strategy: "capacity" });
    expect(automatic.tiedBrokerIds).toHaveLength(2);
    const manual = previewQueueOrder({ candidates, policy: defaultIntelligentDistributionPolicy, strategy: "capacity", manualBrokerIds: ["bia", "ana"] });
    expect(manual.order.map((item) => item.id)).toEqual(["bia", "ana"]);
    expect(manual.tiedBrokerIds).toEqual([]);
    expect(manual.manual).toBe(true);
  });

  it("não chama de empate quando o desempate de carteira já decide", () => {
    const result = previewQueueOrder({
      candidates: [candidate("ana", { activeLeads: 2 }), candidate("bia", { activeLeads: 1 })],
      policy: defaultIntelligentDistributionPolicy,
      strategy: "capacity",
      receivedByBroker: new Map([["ana", 0], ["bia", 0]]),
      tierByBroker: { ana: 0, bia: 0 },
    });
    expect(result.nextBrokerId).toBe("bia");
    expect(result.tiedBrokerIds).toEqual([]);
  });

  it("mantém a ordem salva, acrescenta corretor novo ao fim e roda quem recebeu", () => {
    const reconciled = reconcileManualQueueOrder(["ana", "bia"], ["bia", "caio", "ana"]);
    expect(reconciled).toEqual(["ana", "bia", "caio"]);
    expect(rotateManualQueueAfterPick(reconciled, "ana")).toEqual(["bia", "caio", "ana"]);
  });

  it("pula bloqueado nesta rodada sem apagar nem mover sua posição", () => {
    const order = ["paula", "bia", "caio"];
    const result = previewQueueOrder({
      candidates: [
        candidate("paula", { blockedReason: "Pausado" }),
        candidate("bia"),
        candidate("caio"),
      ],
      policy: defaultIntelligentDistributionPolicy,
      strategy: "capacity",
      manualBrokerIds: order,
    });
    expect(result.nextBrokerId).toBe("bia");
    expect(result.blocked.map((item) => item.id)).toEqual(["paula"]);
    expect(reconcileManualQueueOrder(order, ["paula", "bia", "caio"])).toEqual(order);
    expect(pickManualQueueBroker(order, ["bia", "caio"])).toBe("bia");
  });

  it("ao rodar o escolhido, mantém o bloqueado na mesma posição", () => {
    const result = chooseManualQueuePick({
      lockAcquired: true,
      automaticBrokerId: "ana",
      pendingBrokerIds: ["ana", "caio"],
      scheduleIdByBroker: { ana: "manha", caio: "manha" },
      queueBySchedule: { manha: ["ana", "bia", "caio"] },
      rosterBrokerIdsBySchedule: { manha: ["ana", "caio"] },
    });
    expect(result).toEqual({
      brokerId: "ana",
      scheduleId: "manha",
      nextOrder: ["caio", "bia", "ana"],
      manual: true,
    });
  });

  it("arrastar elegíveis mantém os bloqueados nas mesmas posições salvas", () => {
    expect(mergeEligibleOrderKeepingBlockedSlots(
      ["paula", "bia", "caio", "duda"],
      ["paula", "bia", "caio", "duda"],
      ["duda", "bia", "caio"],
      ["paula"],
    )).toEqual(["paula", "duda", "bia", "caio"]);
  });

  it("sem trava usa o próximo automático e não ativa nem reescreve rodízio", () => {
    const result = chooseManualQueuePick({
      lockAcquired: false,
      automaticBrokerId: "bia",
      pendingBrokerIds: ["ana", "bia"],
      scheduleIdByBroker: { ana: "manha", bia: "manha" },
      queueBySchedule: { manha: ["ana", "bia"] },
      rosterBrokerIdsBySchedule: { manha: ["ana", "bia"] },
    });
    expect(result).toEqual({ brokerId: "bia", scheduleId: null, nextOrder: null, manual: false });
  });

  it("sem fila manual ativa, mantém a seleção automática após voltar ao automático", () => {
    const result = chooseManualQueuePick({
      lockAcquired: true,
      automaticBrokerId: "bia",
      pendingBrokerIds: ["ana", "bia"],
      scheduleIdByBroker: { ana: "manha", bia: "manha" },
      queueBySchedule: {},
      rosterBrokerIdsBySchedule: { manha: ["ana", "bia"] },
    });
    expect(result).toEqual({ brokerId: "bia", scheduleId: null, nextOrder: null, manual: false });
  });

  it("uma fila manual salva também prevalece sobre round_robin no plantão escolhido", () => {
    const result = chooseManualQueuePick({
      lockAcquired: true,
      automaticBrokerId: "mais-antigo",
      pendingBrokerIds: ["mais-antigo", "mais-novo"],
      scheduleIdByBroker: { "mais-antigo": "manha", "mais-novo": "manha" },
      queueBySchedule: { manha: ["mais-novo", "mais-antigo"] },
      rosterBrokerIdsBySchedule: { manha: ["mais-antigo", "mais-novo"] },
    });
    expect(result.brokerId).toBe("mais-novo");
    expect(result.nextOrder).toEqual(["mais-antigo", "mais-novo"]);
  });

  it("um rodízio de manhã não altera a fila da tarde", () => {
    const result = chooseManualQueuePick({
      lockAcquired: true,
      automaticBrokerId: "bia",
      pendingBrokerIds: ["ana", "bia", "caio"],
      scheduleIdByBroker: { ana: "manha", bia: "manha", caio: "tarde" },
      queueBySchedule: { manha: ["bia", "ana"], tarde: ["caio"] },
      rosterBrokerIdsBySchedule: { manha: ["ana", "bia"], tarde: ["caio"] },
    });
    expect(result).toEqual({ brokerId: "bia", scheduleId: "manha", nextOrder: ["ana", "bia"], manual: true });
    expect(pickManualQueueBroker(["caio"], ["caio"])).toBe("caio");
  });
});

