"use client";

import "@/components/arc/venancor-scope.css";

import { notFound, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import type { LeaderboardBroker, LeaderboardTeam } from "@/features/engagement/journey-types";
import { TeamStandings } from "@/features/journey/components/team-standings";

/** Dev-only showcase of the supervisor boards. /dev/equipe-placar?state=full|empty|solo */
const week = { periodKey: "2026-W41", startsAt: "2026-10-06", endsAt: "2026-10-12" };
const broker = (id: string, name: string, points: number, position: number, change: number | null): LeaderboardBroker => ({ brokerId: id, name, imageUrl: null, branchId: "b1", supervisorId: "me", points, previousPoints: points - 30, position, previousPosition: change === null ? null : position + change, positionChange: change, optedOut: false });
const team = (id: string, name: string, avg: number, size: number, position: number, change: number | null): LeaderboardTeam => ({ supervisorId: id, name, imageUrl: null, branchId: "b1", activeBrokers: size, totalPoints: avg * size, averagePoints: avg, previousAveragePoints: avg - 10, position, previousPosition: change === null ? null : position + change, positionChange: change });

function Showcase() {
  const params = useSearchParams();
  const state = params.get("state") ?? "full";
  const brokers = state === "empty" ? [] : [
    broker("a", "Mariana Couto", 520, 1, 1), broker("b", "Rafael Antunes Bittencourt de Albuquerque", 488, 2, -1), broker("c", "Júlia Prado", 455, 3, 0),
    broker("d", "Paulo Henrique", 300, 4, 2), broker("e", "Ana Beatriz", 120, 5, -2), broker("f", "Carla Mendes", 0, 6, null),
  ];
  const teams = state === "solo" ? null : { ...week, teams: [team("x", "Time Barra", 412, 6, 1, 0), team("me", "Time Mar", 381, 6, 2, 1), team("y", "Equipe Centro Norte com nome bem longo", 290, 9, 3, -1), team("z", "Time Sul", 120, 3, 4, 0)] };
  return <TeamStandings initialTab={params.get("tab") === "teams" ? "teams" : "team"} data={{ supervisorId: "me", internal: { ...week, supervisorId: "me", brokers }, teams }} />;
}

export default function TeamBoardShowcasePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <main><Suspense fallback={null}><Showcase /></Suspense></main>;
}
