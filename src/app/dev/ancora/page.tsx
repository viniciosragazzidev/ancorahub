"use client";

import "@/components/arc/venancor-scope.css";

import { notFound } from "next/navigation";

import { AssistantChat } from "@/components/chat/assistant-chat";
import { buildAncoraScript } from "@/features/broker-workspace/chat/assistant-scripts";

/** Dev-only showcase of the Âncora conversation with notices styled as in Notificações. */
const at = (iso: string) => new Date(iso);
const notifications = [
  { id: "1", title: "Escala de outubro publicada", message: "Seus plantões já estão no app.", type: "duty.schedule_published", readAt: at("2026-10-09T12:00:00Z"), createdAt: at("2026-10-09T11:00:00Z"), leadId: null },
  { id: "2", title: "Recado da gestão", message: "Reunião de alinhamento amanhã às 9h.", type: "relationship.notice", readAt: null, createdAt: at("2026-10-10T12:10:00Z"), leadId: null },
  { id: "3", title: "Lead sem contato", message: "Carla Mendes está esperando há 18 min.", type: "lead_unworked", readAt: null, createdAt: at("2026-10-10T14:40:00Z"), leadId: "l1" },
  { id: "4", title: "Lead novo para você", message: "Paulo Henrique, PME, 3 vidas.", type: "agent.lead_assigned", readAt: null, createdAt: at("2026-10-10T14:52:00Z"), leadId: "l2" },
];

export default function AncoraShowcasePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="arc-venancor h-dvh bg-[var(--surface)]">
      <AssistantChat identity={{ name: "Jack", shape: "jack", hue: null }} script={buildAncoraScript({ notifications, now: at("2026-10-10T15:00:00Z") })} instant />
    </main>
  );
}
