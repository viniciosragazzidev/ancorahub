import { notFound } from "next/navigation";

import "@/components/arc/venancor-scope.css";
import { DutyQueueOrderBoard } from "@/app/(dashboard)/leads/distribuicao/plantao/_components/duty-queue-order-board";
import type { DutyQueueOrderPreview } from "@/features/lead-distribution/duty-queue-order-queries";
import { RotationDemo } from "./rotation-demo";

const previews: DutyQueueOrderPreview[] = [
  {
    scheduleId: "11111111-1111-4111-8111-111111111111",
    dutyDate: "2026-10-27",
    scheduleName: "Presencial tarde",
    queueName: "PME Centro",
    strategy: "capacity",
    order: [
      { id: "11111111-1111-4111-8111-111111111101", name: "Ana Beatriz de Oliveira Nascimento", receivedInDuty: 1, activeLeads: 2, position: 1, isNext: true, tie: true, turns: 0, skips: 0, accepted: 0, avgAcceptSeconds: null, arrivedAt: null },
      { id: "11111111-1111-4111-8111-111111111102", name: "Roberto Carlos Fernandes da Silva", receivedInDuty: 1, activeLeads: 3, position: 2, isNext: false, tie: true, turns: 0, skips: 0, accepted: 0, avgAcceptSeconds: null, arrivedAt: null },
      { id: "11111111-1111-4111-8111-111111111103", name: "Camila Rocha", receivedInDuty: 2, activeLeads: 1, position: 3, isNext: false, tie: false, turns: 0, skips: 0, accepted: 0, avgAcceptSeconds: null, arrivedAt: null },
    ],
    blocked: [{ id: "11111111-1111-4111-8111-111111111104", name: "Paulo Henrique Mendes", reason: "Pausado neste plantão", turns: 0, skips: 0, accepted: 0, avgAcceptSeconds: null, arrivedAt: null }],
    savedBrokerIds: ["11111111-1111-4111-8111-111111111101", "11111111-1111-4111-8111-111111111104", "11111111-1111-4111-8111-111111111102", "11111111-1111-4111-8111-111111111103"],
    manual: false,
    rotation: false,
    current: null,
    previous: null,
  },
  {
    scheduleId: "22222222-2222-4222-8222-222222222222",
    dutyDate: "2026-10-27",
    scheduleName: "Presencial manhã",
    queueName: "Fila PF e familiar",
    strategy: "round_robin",
    order: [
      { id: "22222222-2222-4222-8222-222222222201", name: "Fernanda Costa", receivedInDuty: 0, activeLeads: 1, position: 1, isNext: true, tie: false, turns: 0, skips: 0, accepted: 0, avgAcceptSeconds: null, arrivedAt: null },
      { id: "22222222-2222-4222-8222-222222222202", name: "Diego Almeida", receivedInDuty: 2, activeLeads: 2, position: 2, isNext: false, tie: false, turns: 0, skips: 0, accepted: 0, avgAcceptSeconds: null, arrivedAt: null },
    ],
    blocked: [],
    savedBrokerIds: ["22222222-2222-4222-8222-222222222201", "22222222-2222-4222-8222-222222222202"],
    manual: true,
    rotation: false,
    current: null,
    previous: null,
  },
  {
    scheduleId: "33333333-3333-4333-8333-333333333333",
    dutyDate: "2026-10-27",
    scheduleName: "Plantão comercial estendido",
    queueName: "PME Zona Norte",
    strategy: "capacity",
    order: [
      { id: "33333333-3333-4333-8333-333333333301", name: "Mariana Lopes de Carvalho", receivedInDuty: 0, activeLeads: 0, position: 1, isNext: true, tie: false, turns: 0, skips: 0, accepted: 0, avgAcceptSeconds: null, arrivedAt: null },
      { id: "33333333-3333-4333-8333-333333333302", name: "Lucas Ferreira", receivedInDuty: 3, activeLeads: 4, position: 2, isNext: false, tie: false, turns: 0, skips: 0, accepted: 0, avgAcceptSeconds: null, arrivedAt: null },
    ],
    blocked: [{ id: "33333333-3333-4333-8333-333333333303", name: "João Pedro de Souza", reason: "Intervalo entre ofertas", turns: 0, skips: 0, accepted: 0, avgAcceptSeconds: null, arrivedAt: null }],
    savedBrokerIds: ["33333333-3333-4333-8333-333333333301", "33333333-3333-4333-8333-333333333302", "33333333-3333-4333-8333-333333333303"],
    manual: false,
    rotation: false,
    current: null,
    previous: null,
  },
];

export default function DutyQueuePreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="arc-venancor h-dvh overflow-y-auto overscroll-contain bg-[var(--surface-muted)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <header className="grid gap-1">
          <p className="m-0 text-sm text-[var(--muted-foreground)]">Prévia de desenvolvimento</p>
          <h1 className="m-0 text-2xl font-semibold text-[var(--foreground)]">Fila visual do plantão</h1>
        </header>
        <RotationDemo />
        <DutyQueueOrderBoard previews={previews} canReorder />
      </div>
    </main>
  );
}
