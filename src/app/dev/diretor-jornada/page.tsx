"use client";

import { notFound, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { ENGAGEMENT_RULES } from "@/features/engagement/catalog";
import { DirectorJourneyPanel, type DirectorJourneyData } from "@/features/journey/components/director/director-journey-panel";

/** Dev-only showcase of the director journey panel. /dev/diretor-jornada?tab=overview|campaigns|rules|audit&state=full|empty */
const period = { periodKey: "2026-W41", startsAt: "2026-10-06", endsAt: "2026-10-12" };
const ok = async () => ({ ok: true as const });

function data(empty: boolean): DirectorJourneyData {
  return {
    canManageRules: true,
    dashboard: {
      available: true, period,
      adoption: { activeBrokers: 48, scoringBrokers: empty ? 0 : 31, percentage: empty ? 0 : 65 },
      pointsByRule: empty ? [] : [
        { ruleKey: "contact.first", label: "Primeiro contato", points: 4820, events: 402 },
        { ruleKey: "offer.fast_accept", label: "Aceite rápido", points: 1290, events: 430 },
        { ruleKey: "mission.completed", label: "Missões", points: 2150, events: 61 },
        { ruleKey: "note.service", label: "Atendimento registrado", points: 870, events: 290 },
        { ruleKey: "return.on_time", label: "Retorno em dia", points: 640, events: 128 },
      ],
      units: empty ? [] : [
        { branchId: "b1", branchName: "Centro", points: 4200, adoption: { activeBrokers: 18, scoringBrokers: 14, percentage: 78 }, brokers: [] },
        { branchId: "b2", branchName: "Barra da Tijuca", points: 3650, adoption: { activeBrokers: 16, scoringBrokers: 10, percentage: 63 }, brokers: [] },
        { branchId: "b3", branchName: "Nova Iguaçu", points: 1920, adoption: { activeBrokers: 14, scoringBrokers: 7, percentage: 50 }, brokers: [] },
      ],
      teams: empty ? [] : [
        { supervisorId: "s1", name: "Time Barra", imageUrl: null, branchId: "b2", activeBrokers: 6, totalPoints: 2472, averagePoints: 412, previousAveragePoints: 380, position: 1, previousPosition: 1, positionChange: 0 },
        { supervisorId: "s2", name: "Time Mar", imageUrl: null, branchId: "b1", activeBrokers: 6, totalPoints: 2286, averagePoints: 381, previousAveragePoints: 300, position: 2, previousPosition: 3, positionChange: 1 },
      ],
      topMissions: empty ? [] : [
        { missionId: "m1", title: "Todo primeiro contato em até 5 min", kind: "daily", completed: 38 },
        { missionId: "m3", title: "Semana PME: 3 cotações PME", kind: "campaign", completed: 9 },
      ],
    },
    campaigns: empty ? [] : [
      { id: "c1", kind: "campaign", title: "Semana PME", description: "3 cotações PME até domingo.", metric: "contacts.evidenced", target: 3, bonusPoints: 100, period: "campaign", audience: {}, startsAt: "2026-10-06T03:00:00.000Z", endsAt: "2026-10-12T23:59:00.000Z", status: "active", createdBy: "d", createdAt: "2026-10-05T12:00:00.000Z" },
      { id: "c2", kind: "campaign", title: "Ninguém esperando", description: null as unknown as string, metric: "sla.no_breach", target: 5, bonusPoints: 80, period: "campaign", audience: {}, startsAt: "2026-09-29T03:00:00.000Z", endsAt: "2026-10-05T23:59:00.000Z", status: "inactive", createdBy: "d", createdAt: "2026-09-28T12:00:00.000Z" },
    ],
    audience: { available: true, branches: [{ id: "b1", name: "Centro", branchId: "b1" }, { id: "b2", name: "Barra da Tijuca", branchId: "b2" }], teams: [{ id: "s1", name: "Time Barra", branchId: "b2" }], duties: [{ id: "d1", name: "PME Tarde", branchId: null }], brokers: [{ id: "u1", name: "Ana Lima", branchId: "b1" }, { id: "u2", name: "Bruno Reis", branchId: "b1" }] },
    rules: { available: true, rules: Object.values(ENGAGEMENT_RULES) },
    risk: {
      available: true, period,
      brokers: empty ? [] : [{ brokerId: "u9", name: "Diego Faria", branchId: "b1", points: 1240, rules: [{ ruleKey: "note.service", label: "Atendimento registrado", points: 300, events: 100, zScore: 3.4, outlier: true }], repeatedNotes: 12, unusualContacts: 0 }],
      events: empty ? [] : [
        { id: "e1", brokerId: "u9", brokerName: "Diego Faria", ruleKey: "note.service", points: 3, occurredAt: "2026-10-10T14:00:00.000Z", reversedAt: null, detail: "Atendimento registrado · Lead Carla" },
        { id: "e2", brokerId: "u1", brokerName: "Ana Lima", ruleKey: "contact.first", points: 15, occurredAt: "2026-10-10T13:20:00.000Z", reversedAt: "2026-10-10T15:00:00.000Z", detail: "Primeiro contato em 2 min" },
      ],
    },
  };
}

function Showcase() {
  const params = useSearchParams();
  const tab = (params.get("tab") ?? "overview") as "overview" | "campaigns" | "rules" | "audit";
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">Jornada da equipe</h1>
      <DirectorJourneyPanel initialTab={tab} data={data(params.get("state") === "empty")} actions={{ createCampaign: async () => ({ ok: false, message: "Vitrine" }), pauseCampaign: ok, updateRule: ok, restoreRules: ok, reverseEvent: ok }} />
    </div>
  );
}

export default function DirectorJourneyShowcasePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <main><Suspense fallback={null}><Showcase /></Suspense></main>;
}
