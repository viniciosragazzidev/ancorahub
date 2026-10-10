"use client";

import "@/components/arc/venancor-scope.css";
import { useEffect, useRef } from "react";
import { RankingPreferences } from "@/features/journey/ranking-preferences";
import type { JourneyActionResult } from "@/features/journey/actions";
import css from "./preview.module.css";

/** Fixture-only route: no authentication, server writes or database reads. */
export function RankingPreview({ state }: { state: string }) {
  const root = useRef<HTMLDivElement>(null);
  const clicked = useRef(false);
  useEffect(() => {
    if (!clicked.current && ["pending", "error", "success"].includes(state)) {
      clicked.current = true;
      root.current?.querySelector<HTMLButtonElement>('[role="switch"]')?.click();
    }
  }, [state]);
  const saveAction = (): Promise<JourneyActionResult> => state === "pending" ? new Promise(() => undefined) : Promise.resolve(state === "error" ? { ok: false, message: "Não foi possível salvar. Tente novamente." } : { ok: true });
  return <main className={`arc-venancor ${css.page}`}>
    <h1 className={css.title}>Placar</h1>
    <div ref={root}><RankingPreferences initialOptOut={state === "optout"} schemaReady={state !== "unavailable"} saveAction={saveAction} /></div>
  </main>;
}
