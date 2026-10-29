"use client";

import { useState } from "react";

import { DutyQueueOrderBoard } from "@/app/(dashboard)/leads/distribuicao/plantao/_components/duty-queue-order-board";
import { Button } from "@/components/ui/button";
import type { DutyQueueOrderPreview } from "@/features/lead-distribution/duty-queue-order-queries";

type Broker = { id: string; name: string; arrivedAt: string };

const brokers: Broker[] = [
  { id: "44444444-4444-4444-8444-444444444401", name: "Jaciara Rosario", arrivedAt: "2026-10-29T08:41:00-03:00" },
  { id: "44444444-4444-4444-8444-444444444402", name: "Mateus Bordini", arrivedAt: "2026-10-29T08:47:00-03:00" },
  { id: "44444444-4444-4444-8444-444444444403", name: "Luzia Rezende", arrivedAt: "2026-10-29T08:58:00-03:00" },
  { id: "44444444-4444-4444-8444-444444444404", name: "Cesar Mendes", arrivedAt: "2026-10-29T10:40:00-03:00" },
];

type Turn = { brokerId: string; outcome: "accepted" | "skip" };

/** Dev only: walks the rotation one lead at a time to see the turn strip and the rows move. */
export function RotationDemo() {
  const [order, setOrder] = useState(brokers.map((broker) => broker.id));
  const [current, setCurrent] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);

  function nextLead(outcome: "accepted" | "skip") {
    if (current) setTurns((list) => [...list, { brokerId: current, outcome }]);
    const [first, ...rest] = order;
    setCurrent(first);
    setOrder([...rest, first]);
  }

  const byId = new Map(brokers.map((broker) => [broker.id, broker]));
  const waiting = order.filter((id) => id !== current);
  const last = turns.at(-1) ?? null;
  const statsOf = (id: string) => {
    const own = turns.filter((turn) => turn.brokerId === id);
    return {
      turns: own.length + (current === id ? 1 : 0),
      skips: own.filter((turn) => turn.outcome === "skip").length,
      accepted: own.filter((turn) => turn.outcome === "accepted").length,
      avgAcceptSeconds: own.some((turn) => turn.outcome === "accepted") ? 70 : null,
      arrivedAt: byId.get(id)!.arrivedAt,
    };
  };
  const preview: DutyQueueOrderPreview = {
    scheduleId: "44444444-4444-4444-8444-444444444444",
    dutyDate: "2026-10-29",
    scheduleName: "Presencial manhã",
    queueName: "FILA PF - RENAN",
    strategy: "capacity",
    order: waiting.map((id, index) => ({ id, name: byId.get(id)!.name, receivedInDuty: 0, activeLeads: 1, position: index + 1, isNext: index === 0, tie: false, ...statsOf(id) })),
    blocked: current ? [{ id: current, name: byId.get(current)!.name, reason: "Oferta aguardando resposta", ...statsOf(current) }] : [],
    savedBrokerIds: order,
    manual: false,
    rotation: true,
    current: current ? { id: current, name: byId.get(current)!.name, offeredAt: "2026-10-29T11:30:00-03:00" } : null,
    previous: last ? { id: last.brokerId, name: byId.get(last.brokerId)!.name, offeredAt: "2026-10-29T11:22:00-03:00", outcome: last.outcome } : null,
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => nextLead("accepted")}>Próximo lead (aceito)</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => nextLead("skip")}>Próximo lead (pulou)</Button>
      </div>
      <DutyQueueOrderBoard previews={[preview]} canReorder={false} />
    </div>
  );
}
