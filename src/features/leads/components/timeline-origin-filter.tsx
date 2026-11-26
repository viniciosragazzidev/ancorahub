"use client";

import { useCallback, useEffect, useState } from "react";
import { Gear, Sparkle, Users } from "@/components/huge-icons";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import {
  TIMELINE_FILTER_LABELS,
  TIMELINE_ORIGIN_FILTERS,
  TIMELINE_ORIGIN_LABELS,
  isTimelineOriginFilter,
  timelineFilterStorageKey,
  type TimelineOrigin,
  type TimelineOriginFilter,
} from "@/features/leads/timeline-origin";

/** Filtro escolhido, lembrado por usuário neste navegador. */
export function useTimelineOriginFilter(viewerId?: string | null) {
  const key = timelineFilterStorageKey(viewerId);
  const [filter, setFilter] = useState<TimelineOriginFilter>("all");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(key);
      if (isTimelineOriginFilter(saved)) setFilter(saved);
    } catch {
      // Sem armazenamento: fica em Tudo.
    }
  }, [key]);
  const choose = useCallback((next: TimelineOriginFilter) => {
    setFilter(next);
    try {
      window.localStorage.setItem(key, next);
    } catch {
      // Sem armazenamento: vale só nesta visita.
    }
  }, [key]);
  return [filter, choose] as const;
}

export function TimelineOriginSegments({ value, onValueChange }: { value: TimelineOriginFilter; onValueChange: (value: TimelineOriginFilter) => void }) {
  return <SegmentedControl
    label="Quem fez"
    value={value}
    onValueChange={(next) => { if (isTimelineOriginFilter(next)) onValueChange(next); }}
    options={TIMELINE_ORIGIN_FILTERS.map((option) => ({ value: option, label: TIMELINE_FILTER_LABELS[option] }))}
  />;
}

const originIcons = { team: Users, ai: Sparkle, automatic: Gear } as const;

/** Rótulo neutro da origem: ícone e texto, sem cor. */
export function TimelineOriginTag({ origin }: { origin: TimelineOrigin }) {
  const Icon = originIcons[origin];
  return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" data-origin={origin}>
    <Icon size={12} aria-hidden="true" />
    {TIMELINE_ORIGIN_LABELS[origin]}
  </span>;
}
