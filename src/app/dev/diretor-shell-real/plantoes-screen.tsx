"use client";

/** ?tela=plantoes: a aba Plantões da Distribuição 1:1 (27/11/2026) com dados de exemplo, na moldura real. */
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { MonthlyDutyPlanner } from "@/app/(dashboard)/leads/distribuicao/plantao/_components/monthly-duty-planner";
import { DutyOperationsWorkspace } from "@/app/(dashboard)/leads/distribuicao/plantao/_components/duty-operations-workspace";
import p from "@/app/(dashboard)/leads/distribuicao/plantao/_components/plantoes-1a1.module.css";
import { DistributionHead1a1 } from "@/app/(dashboard)/leads/distribuicao/_components/resumo-1a1-shell";
import s from "@/app/(dashboard)/leads/distribuicao/_components/resumo-1a1.module.css";
import type { DutyQueueOrderPreview } from "@/features/lead-distribution/duty-queue-order-queries";
import type { DutyRosterSnapshot } from "@/features/lead-distribution/roster-queries";

const tz = "America/Sao_Paulo";
const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
const month = todayKey.slice(0, 7);
const monthStart = new Date(`${month}-01T03:00:00Z`);
const nextMonth = (() => { const [y, m] = month.split("-").map(Number); return new Date(Date.UTC(y, m, 1, 3)); })();
const nowClock = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
const todayDow = new Date(`${todayKey}T12:00:00Z`).getUTCDay();

const branches = [
  { id: "b-20", name: "Matriz 20º Andar" },
  { id: "b-ce", name: "Centro" },
  { id: "b-nt", name: "Niterói" },
];
const types = [
  { id: "t-pme", name: "PME", colorHue: 255, attendanceMode: "presencial", branchIds: ["b-20"], status: "active", defaultStartsAt: "09:00", defaultEndsAt: "13:00", defaultMinimumBrokers: 3, defaultMaximumBrokers: 6 },
  { id: "t-ind", name: "Individual", colorHue: 150, attendanceMode: "presencial", branchIds: ["b-nt"], status: "active", defaultStartsAt: "13:30", defaultEndsAt: "18:00", defaultMinimumBrokers: 2, defaultMaximumBrokers: null },
  { id: "t-ade", name: "Adesão", colorHue: 30, attendanceMode: "online", branchIds: [], status: "active", defaultStartsAt: "09:00", defaultEndsAt: "18:00", defaultMinimumBrokers: 3, defaultMaximumBrokers: null },
];
const typeOf = (id: string) => types.find((type) => type.id === id)!;

function schedule(id: string, name: string, typeId: string, dayOfWeek: number, startsAt: string, endsAt: string, extra: Record<string, unknown> = {}) {
  const type = typeOf(typeId);
  return {
    id, branchId: null, branchName: null, queueId: "q-1", queueName: `Fila ${type.name}`, name, typeId, typeName: type.name, typeHue: type.colorHue,
    dayOfWeek, startsAt: `${startsAt}:00`, endsAt: `${endsAt}:00`, priority: 0, minimumBrokers: type.defaultMinimumBrokers, maximumBrokers: type.defaultMaximumBrokers,
    maxLeadsPerBroker: 8, shiftSplitAt: null, attendanceMode: type.attendanceMode, status: "active", timezone: tz, validFrom: monthStart, validUntil: nextMonth,
    webhookCredentialId: null, credentialName: null, presencePhotoChoice: "default", linkedQueues: [{ id: "q-1", name: `Fila ${type.name}` }], linkedQueueId: "q-1",
    typeBranchIds: type.branchIds, ...extra,
  };
}

// Plantão de hoje acontecendo agora (das 00:00 até 23:59), para o "Agora".
const schedules = [
  schedule("s-pme", "PME Centro", "t-pme", 1, "09:00", "13:00"),
  schedule("s-pme-qua", "PME Centro", "t-pme", 3, "09:00", "13:00"),
  schedule("s-ade", "Adesão Online", "t-ade", 2, "09:00", "18:00"),
  schedule("s-ind", "Individual Niterói", "t-ind", 4, "13:30", "18:00"),
  schedule("s-now", "Adesão Online", "t-ade", todayDow, nowClock < "23:00" ? "00:00" : "00:00", "23:59", { maximumBrokers: 6 }),
  schedule("s-old", "PME Barra", "t-pme", 1, "09:00", "13:00", { validFrom: new Date(Date.UTC(2026, 8, 1, 3)), validUntil: monthStart }),
];

const brokers = ["Vitória Augusto", "Sara Soares", "Raiana Nunes", "Juliana Portela", "Edinaldo Luiz", "Marcos Teixeira", "Ana Paula Reis", "Bruno Cardoso"].map((name, index) => ({
  id: `br-${index}`, name, branchId: branches[index % 3].id, branchName: branches[index % 3].name, internalCode: `C${100 + index}`, availabilityStatus: index === 4 ? "paused" : "available",
}));

const snapshot = {
  branches,
  queues: [{ id: "q-1", branchId: "b-20", name: "Fila PME" }],
  credentials: [{ id: "c-1", name: "Meta Lead Ads · Âncora Saúde" }],
  types,
  schedules,
  brokers,
  pendingBrokers: [],
  assignments: brokers.slice(0, 4).map((broker, index) => ({ id: `as-${index}`, scheduleId: "s-now", brokerId: broker.id, brokerName: broker.name, dayOfWeek: todayDow, startsAt: "00:00:00", endsAt: "23:59:00" })),
  publishedAssignments: [],
  history: [
    { scheduleId: "s-now", action: "duty_schedule.updated", actorName: "Edinaldo Luiz", createdAt: new Date(Date.UTC(2026, 10, 24, 21, 2)) },
    { scheduleId: "s-now", action: "duty_schedule.created", actorName: "Edinaldo Luiz", createdAt: new Date(Date.UTC(2026, 10, 3, 12, 15)) },
  ],
  photoSettingReady: true,
  unitPhotoDefaults: { "b-20": "always" },
} as unknown as DutyRosterSnapshot;

const stats = { turns: 3, skips: 0, accepted: 3, avgAcceptSeconds: 42, arrivedAt: null };
const queueOrders: DutyQueueOrderPreview[] = [
  {
    scheduleId: "s-now", dutyDate: todayKey, scheduleName: "Adesão Online", queueName: "Fila Adesão · 09:00 às 18:00", strategy: "round_robin" as DutyQueueOrderPreview["strategy"],
    order: brokers.slice(0, 4).map((broker, index) => ({ id: broker.id, name: broker.name, receivedInDuty: 3 - Math.min(index, 2), activeLeads: 1, position: index + 1, isNext: index === 0, tie: false, ...stats, turns: 3 - Math.min(index, 2), skips: index === 1 ? 1 : 0 })),
    blocked: [{ id: brokers[4].id, name: brokers[4].name, reason: "Em pausa", ...stats, skips: 3 }],
    savedBrokerIds: brokers.slice(0, 5).map((broker) => broker.id), manual: false, rotation: true,
    current: { id: brokers[3].id, name: brokers[3].name, offeredAt: new Date(Date.now() - 90_000).toISOString() },
    previous: { id: brokers[2].id, name: brokers[2].name, offeredAt: new Date(Date.now() - 600_000).toISOString(), outcome: "accepted" },
  },
  {
    scheduleId: "s-ind", dutyDate: todayKey, scheduleName: "Individual Niterói", queueName: "Fila Niterói · 13:30 às 18:00", strategy: "round_robin" as DutyQueueOrderPreview["strategy"],
    order: brokers.slice(5, 8).map((broker, index) => ({ id: broker.id, name: broker.name, receivedInDuty: 4 - index, activeLeads: 2 - Math.min(index, 2), position: index + 1, isNext: index === 0, tie: false, ...stats })),
    blocked: [], savedBrokerIds: brokers.slice(5, 8).map((broker) => broker.id), manual: true, rotation: false, current: null, previous: null,
  },
];

// A escala do mês com uma proposta de exemplo (a ação real exige sessão): ?tela=plantoes&escala=1 abre a gaveta.
const occ = (id: string, scheduleId: string, name: string, typeId: string, day: string, people: number[], extra: Record<string, unknown> = {}) => ({
  id, scheduleId, scheduleName: name, typeId, dutyDate: `${month}-${day}`, startsAt: "09:00:00", endsAt: "13:00:00", minimumBrokers: 3, maximumBrokers: 6,
  assignedCount: people.length, attendanceMode: typeOf(typeId).attendanceMode, ended: false, started: false, allowedBrokerIds: brokers.map((broker) => broker.id),
  brokers: people.map((index) => ({ id: brokers[index].id, name: brokers[index].name, code: brokers[index].internalCode, branchId: brokers[index].branchId, branchName: brokers[index].branchName, origin: index % 2 ? "existing" : "generated", forced: false, pending: false })),
  ...extra,
});
const planView = {
  id: "plan-1", monthKey: month, status: "draft", rangeFrom: `${month}-01`, rangeUntil: `${month}-30`, publishedAt: null, replacesPublished: false, canEditSeats: true,
  totalAssigned: 11, belowMinimum: 1, problems: [], warnings: ["Adesão Online em 30/11 tem só 2 corretores para o mínimo de 3."], publishedOccurrenceIds: [],
  settings: { brokers: [], generatedTypeKeys: ["t-pme", "t-ade"], excludedDates: [`${month}-20`] },
  brokers: brokers.map((broker) => ({ id: broker.id, name: broker.name, code: broker.internalCode, branchId: broker.branchId, branchName: broker.branchName, pending: false })),
  occurrences: [
    occ("o1", "s-pme", "PME Centro", "t-pme", "30", [0, 1, 2]),
    occ("o2", "s-ade", "Adesão Online", "t-ade", "30", [3, 5]),
    occ("o3", "s-pme", "PME Centro", "t-pme", "02", [0, 6, 7], { ended: true }),
  ],
};
const plansState = { plans: { [month]: planView }, loading: new Set<string>(), failed: new Set<string>(), load: async () => {}, setPlan: () => {} };

export function PlantoesShellScreen() {
  const showPlan = useSearchParams()?.get("escala") === "1";
  const [planOpen, setPlanOpen] = useState(showPlan);
  return (
    <main className={`arc-venancor ${s.gx} ${s.page}`} data-skin="diretor">
      <DistributionHead1a1 available={38} waiting={12} />
      <div className={p.gx} style={{ display: "contents" }}>
        <DutyOperationsWorkspace snapshot={snapshot} queueOrders={queueOrders} canPlanMonthlySchedule queues={[{ id: "q-1", name: "Fila PME" }, { id: "q-2", name: "Fila Adesão" }]} />
        {showPlan ? (
          <MonthlyDutyPlanner
            brokers={snapshot.brokers}
            branches={snapshot.branches}
            types={snapshot.types}
            enabled
            canEdit
            month={month}
            open={planOpen}
            onOpenChange={setPlanOpen}
            schedules={snapshot.schedules}
            plansState={plansState as unknown as Parameters<typeof MonthlyDutyPlanner>[0]["plansState"]}
            onCreateSchedule={() => setPlanOpen(false)}
          />
        ) : null}
      </div>
    </main>
  );
}
