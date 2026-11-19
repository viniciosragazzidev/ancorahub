"use client";

import "@/components/arc/venancor-scope.css";

import { notFound } from "next/navigation";

import { AssistantChat } from "@/components/chat/assistant-chat";
import { buildAncoraScript } from "@/features/broker-workspace/chat/assistant-scripts";

/** Dev-only showcase of the Sasá conversation (only requests to the assistant since 19/11). */

export default function AncoraShowcasePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="arc-venancor h-dvh bg-[var(--surface)]">
      <AssistantChat identity={{ name: "Sasá", shape: "sasa", hue: 175 }} script={buildAncoraScript({ now: new Date("2026-10-10T15:00:00Z") })} instant />
    </main>
  );
}
