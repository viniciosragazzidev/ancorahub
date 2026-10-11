"use client";

import "@/components/arc/venancor-scope.css";

import { notFound } from "next/navigation";
import { useState } from "react";

import { RecognizeSheet } from "@/features/journey/components/recognize-sheet";

/** Dev-only showcase of the supervisor's "Reconhecer com pontos". */
export default function RecognizeShowcasePage() {
  const [open, setOpen] = useState(true);
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="arc-venancor min-h-dvh bg-[var(--surface)] p-4">
      <h1 className="text-xl font-medium">Perfil de Ana Lima</h1>
      <button type="button" className="mt-4 h-11 rounded-full bg-[var(--surface-muted)] px-4 text-sm" onClick={() => setOpen(true)}>Reconhecer com pontos</button>
      <RecognizeSheet brokerId="u1" brokerName="Ana Lima" open={open} onOpenChange={setOpen} onRecognize={async (input) => ({ ok: true, data: { eventId: "e1", brokerId: input.brokerId, points: input.points, remainingWeeklyPoints: 100 - input.points, replayed: false } })} />
    </main>
  );
}
