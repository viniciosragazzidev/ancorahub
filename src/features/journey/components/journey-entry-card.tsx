import Link from "next/link";
import { ChevronRight, Trophy } from "lucide-react";

import type { BrokerJourneyData } from "@/features/engagement/journey-types";

import { LevelRing } from "./level-ring";

/**
 * Entrada da Jornada dentro do Desempenho (Início reorganizado, BROKER_NAV_REORG): o nível com o anel de progresso,
 * os pontos da semana e as missões abertas, e um toque para abrir /jornada. A seta de lá volta para o Desempenho.
 */
export function JourneyEntryCard({ journey }: { journey: BrokerJourneyData | null }) {
  const available = Boolean(journey?.available);
  const level = journey?.level;
  const openMissions = journey?.missions.filter((mission) => mission.progress.eligible && !mission.progress.completed).length ?? 0;
  const nextLine = !available || !level
    ? "Sua jornada está sendo preparada."
    : level.nextLevel
      ? `Faltam ${level.pointsToNext} pts para o nível ${level.nextLevel.index + 1}.`
      : "Você está no nível mais alto.";

  return (
    <section aria-labelledby="performance-journey-title" className="grid gap-3">
      <h2 id="performance-journey-title" className="text-base font-semibold">Minha jornada</h2>
      <Link
        href="/jornada?de=desempenho"
        className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-3xl bg-(--surface-muted) p-4 shadow-(--shadow-resting) transition-[background-color,transform] duration-(--duration-fast) ease-(--ease-standard) hover:bg-(--surface) active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        {available && level ? (
          <LevelRing index={level.level.index} percentage={level.percentage} size={64} />
        ) : (
          <span aria-hidden="true" className="grid size-16 place-items-center rounded-full bg-(--surface) text-(--text-muted)">
            <Trophy className="size-6" strokeWidth={1.75} />
          </span>
        )}
        <span className="grid min-w-0 gap-1">
          <span className="truncate text-base font-semibold text-(--foreground)">{available && level ? level.level.name : "Jornada"}</span>
          <span className="text-sm text-(--text-secondary)">{nextLine}</span>
          {available ? (
            <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-(--text-muted)">
              <span><strong className="font-semibold text-(--foreground) tabular-nums">{journey?.week.points ?? 0}</strong> pts na semana</span>
              <span><strong className="font-semibold text-(--foreground) tabular-nums">{openMissions}</strong> {openMissions === 1 ? "missão aberta" : "missões abertas"}</span>
            </span>
          ) : null}
        </span>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-(--chat-action-text,var(--accent-strong))">
          <span className="max-sm:sr-only">Ver minha jornada</span>
          <ChevronRight className="size-4 transition-transform duration-(--duration-fast) group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
        </span>
      </Link>
    </section>
  );
}
