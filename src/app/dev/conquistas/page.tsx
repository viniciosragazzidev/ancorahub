"use client";

import "@/components/arc/venancor-scope.css";

import { notFound } from "next/navigation";

import { AchievementHost, announceAchievement } from "@/components/lite/celebration/achievement-host";

/** Dev-only: as telas de conquista do corretor (presença confirmada e WhatsApp conectado). /dev/conquistas */
export default function AchievementsShowcasePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="arc-venancor" style={{ display: "grid", gap: 12, padding: 24, maxWidth: 360 }}>
      <AchievementHost />
      <button type="button" onClick={() => announceAchievement({ kind: "duty", key: `d${Date.now()}`, scheduleName: "TESTE", until: "19:00", mode: "online" })}>Presença confirmada</button>
      <button type="button" onClick={() => announceAchievement({ kind: "whatsapp", key: `w${Date.now()}`, phoneSuffix: "4321" })}>WhatsApp conectado</button>
    </main>
  );
}
