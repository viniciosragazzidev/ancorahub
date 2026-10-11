"use client";

import "@/components/arc/venancor-scope.css";

import { notFound, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import type { JourneyCelebration, JourneyMissionCard } from "@/features/engagement/journey-types";
import { CelebrationLayer } from "@/features/journey/components/celebration-layer";
import { JourneyScreen, type JourneyScreenData } from "@/features/journey/components/journey-screen";
import { LightChrome } from "@/components/light/light-chrome";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ViewAsBanner } from "@/features/super-admin/components/view-as";
import { LiteMicroTour } from "@/components/chat/tour/lite-tour";

/**
 * Dev-only showcase of the broker Journey with fixtures, for screenshots
 * (scripts/dev-shot.mjs). 404 outside development.
 *   /dev/jornada?state=full|empty|max|optout&celebrate=points|mission|achievement|level
 */
const NOW = "2026-10-10T15:00:00.000Z";

function mission(id: string, kind: JourneyMissionCard["kind"], title: string, description: string, metric: JourneyMissionCard["metric"], progress: number, target: number, bonus: number, eligible = true): JourneyMissionCard {
  const completed = progress >= target;
  return {
    id, kind, title, description, metric, target, bonusPoints: bonus, period: kind === "weekly" ? "weekly" : "daily", audience: {}, startsAt: null, endsAt: null, status: "active",
    progress: { missionId: id, subjectId: "me", periodKey: "2026-10-10", progress: Math.min(progress, target), target, percentage: Math.round(Math.min(progress, target) / target * 100), remaining: Math.max(0, target - progress), eligible, completed, completedAt: completed ? NOW : null },
  };
}

const broker = (id: string, name: string, points: number, position: number, change: number | null = null) => ({ brokerId: id, name, imageUrl: null, branchId: "b1", supervisorId: "s1", points, previousPoints: points - 20, position, previousPosition: change === null ? null : position + change, positionChange: change, optedOut: false });

function fixture(state: string): JourneyScreenData {
  const empty = state === "empty";
  const max = state === "max";
  return {
    available: true,
    optedOut: state === "optout",
    week: { periodKey: "2026-W41", startsAt: "2026-10-06", endsAt: "2026-10-12", brokerId: "me", points: empty ? 0 : 340, previousPoints: empty ? 0 : 290, pointsChange: empty ? 0 : 50, totalPoints: max ? 18240 : empty ? 0 : 1640 },
    level: max
      ? { level: { index: 4, name: "Mestre", threshold: 15000 }, nextLevel: null, totalPoints: 18240, pointsInLevel: 3240, pointsToNext: 0, percentage: 100 }
      : empty
        ? { level: { index: 0, name: "Iniciante", threshold: 0 }, nextLevel: { index: 1, name: "Consultor", threshold: 500 }, totalPoints: 0, pointsInLevel: 0, pointsToNext: 500, percentage: 0 }
        : { level: { index: 1, name: "Consultor", threshold: 500 }, nextLevel: { index: 2, name: "Especialista", threshold: 2000 }, totalPoints: 1640, pointsInLevel: 1140, pointsToNext: 360, percentage: 76 },
    streak: { current: empty ? 0 : 4, best: 6, lastDutyDate: "2026-10-10" },
    missions: empty ? [] : [
      mission("m1", "daily", "Todo primeiro contato em até 5 min", "Mande a primeira mensagem rápido em cada lead de hoje.", "contacts.fast_coverage", 2, 3, 30),
      mission("m2", "daily", "Zerar os retornos vencidos", "Conclua os retornos que passaram do horário.", "returns.cleared", 4, 4, 20),
      mission("m3", "campaign", "Semana PME: 3 cotações PME", "Campanha da direção até domingo.", "contacts.evidenced", 1, 3, 100),
      mission("m4", "team", "Equipe sem SLA estourado hoje", "Todo mundo da equipe dentro do prazo.", "sla.no_breach", 7, 9, 15),
      mission("m5", "daily", "Confirmar presença no plantão", "Confirme quando o plantão começar.", "offers.fast_coverage", 0, 1, 10, false),
      mission("w1", "weekly", "5 dias com contato no prazo", "Dias de plantão com todo primeiro contato no prazo.", "contacts.days_on_time", 4, 5, 80),
    ],
    achievements: [
      { key: "lightning", name: "Raio", description: "10 primeiros contatos em até 5 min.", current: 10, target: 10, percentage: 100, enabled: true, earned: true, earnedAt: "2026-10-08T14:00:00.000Z" },
      { key: "steady_duty", name: "Plantão firme", description: "5 presenças confirmadas seguidas.", current: 3, target: 5, percentage: 60, enabled: true, earned: false, earnedAt: null },
      { key: "returns_on_time", name: "Retorno em dia", description: "20 retornos concluídos no prazo.", current: empty ? 12 : 20, target: 20, percentage: empty ? 60 : 100, enabled: true, earned: !empty, earnedAt: "2026-10-02T14:00:00.000Z" },
      { key: "nobody_waiting", name: "Ninguém esperando", description: "Uma semana inteira sem prazo estourado.", current: 0, target: 1, percentage: 0, enabled: true, earned: false, earnedAt: null },
      { key: "first_sale", name: "Primeira venda", description: "Sua primeira venda aprovada no sistema.", current: 0, target: 1, percentage: 0, enabled: true, earned: false, earnedAt: null },
      { key: "family_protected", name: "Família protegida", description: "Primeira venda de plano familiar.", current: 0, target: 1, percentage: 0, enabled: true, earned: false, earnedAt: null },
      { key: "business_cared", name: "Empresa cuidada", description: "Primeira venda PME.", current: 0, target: 1, percentage: 0, enabled: true, earned: false, earnedAt: null },
      { key: "comeback", name: "Virada", description: "Venda de um lead que estava frio.", current: 0, target: 1, percentage: 0, enabled: false, earned: false, earnedAt: null },
    ],
    leaderboard: empty ? null : {
      periodKey: "2026-W41", startsAt: "2026-10-06", endsAt: "2026-10-12", totalParticipants: 23, gapToNext: 40,
      topThree: [broker("a", "Mariana Couto", 520, 1, 1), broker("b", "Rafael Antunes Bittencourt", 488, 2, -1), broker("c", "Júlia Prado", 455, 3, 0)],
      self: { ...broker("me", "Vinicios Ragazzi", 340, 7, 2), optedOut: state === "optout" },
    },
    celebrations: [],
    ledger: empty ? [] : [
      { id: "l1", ruleKey: "contact.first", label: "Primeiro contato em 2 min", detail: "Lead Carla Mendes", points: 15, occurredAt: "2026-10-10T14:40:00.000Z", reversed: false },
      { id: "l2", ruleKey: "offer.fast_accept", label: "Aceite rápido", detail: "Lead Carla Mendes", points: 3, occurredAt: "2026-10-10T14:38:00.000Z", reversed: false },
      { id: "l3", ruleKey: "mission.completed", label: "Missão concluída", detail: "Zerar os retornos vencidos", points: 20, occurredAt: "2026-10-10T13:10:00.000Z", reversed: false },
      { id: "l4", ruleKey: "note.service", label: "Atendimento registrado", detail: "Lead Paulo Henrique", points: 3, occurredAt: "2026-10-09T19:05:00.000Z", reversed: false },
      { id: "l5", ruleKey: "contact.first", label: "Primeiro contato em 12 min", detail: "Lead Débora Lins", points: 10, occurredAt: "2026-10-09T16:22:00.000Z", reversed: true },
      { id: "l6", ruleKey: "return.on_time", label: "Retorno em dia", detail: "Lead Ana Beatriz", points: 5, occurredAt: "2026-10-08T12:00:00.000Z", reversed: false },
    ],
  };
}

function celebration(kind: string): JourneyCelebration[] {
  const base = { userId: "me", priority: 1, createdAt: NOW, seenAt: null };
  if (kind === "points") return [{ ...base, id: "c1", kind: "points", payload: { kind: "points", points: 15, ruleKey: "contact.first", label: "Primeiro contato em 2 min" } }];
  if (kind === "mission") return [{ ...base, id: "c2", kind: "mission", payload: { kind: "mission", missionId: "m2", title: "Zerar os retornos vencidos", bonusPoints: 20, periodKey: "2026-10-10" } }];
  if (kind === "achievement") return [{ ...base, id: "c3", kind: "achievement", payload: { kind: "achievement", badgeKey: "lightning", name: "Raio" } }];
  if (kind === "level") return [{ ...base, id: "c4", kind: "level", payload: { kind: "level", level: { index: 2, name: "Especialista", threshold: 2000 }, totalPoints: 2010 } }];
  return [];
}

function Showcase() {
  const params = useSearchParams();
  const state = params.get("state") ?? "full";
  const data = useMemo(() => fixture(state), [state]);
  const [seen, setSeen] = useState<string[]>([]);
  const items = celebration(params.get("celebrate") ?? "").filter((item) => !seen.includes(item.id));
  // ?chrome=1: inside the real Lite chrome (scroll container, header), to check scrolling.
  const screen = <JourneyScreen data={data} />;
  return (
    <>
      {params.get("chrome") === "1" ? (
        // Same wrapper as the real app shell (app-shell.tsx, Lite branch).
        <SidebarProvider defaultOpen={false} open={false} className="min-h-dvh flex-col overflow-x-hidden" style={{ "--sidebar-width": "0px", "--header-height": "3.5rem" } as React.CSSProperties}>
          {/* ?viewas=1: with the "Ver como" strip above the app. */}
          {params.get("viewas") === "1" ? <ViewAsBanner viewingAs={{ name: "Carla Mendes", role: "broker" }} /> : null}
          <LightChrome audience="broker" journeyEnabled>{screen}</LightChrome>
        </SidebarProvider>
      ) : screen}
      {params.get("tour") === "jornada" ? <LiteMicroTour pathname="/jornada" /> : null}
      <CelebrationLayer items={items} onSeen={(ids) => setSeen((current) => [...current, ...ids])} />
    </>
  );
}

export default function JourneyShowcasePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <main><Suspense fallback={null}><Showcase /></Suspense></main>;
}
