"use client";

import "@/components/arc/venancor-scope.css";

import { notFound } from "next/navigation";
import { useMemo, useState } from "react";

import { ChatScreen } from "@/components/chat/chat-screen";
import { buildAssistantScript } from "@/features/broker-workspace/chat/assistant-scripts";
import type { BrokerWorkspaceData } from "@/features/broker-workspace/queries";

/** Dev-only showcase of the Agenda conversation: swipe a return to cancel it, "Já falei", reschedule. */
const now = new Date("2026-10-11T12:00:00-03:00");
const START = [
  { id: "00000000-0000-4000-8000-000000000001", leadId: "l1", leadName: "Carla Mendes", title: "Retornar contato", dueAt: new Date("2026-10-11T09:00:00-03:00"), priority: "normal" as const, href: "/leads/l1#tarefas" },
  { id: "00000000-0000-4000-8000-000000000002", leadId: "l2", leadName: "Paulo Henrique", title: "Retornar contato hoje", dueAt: new Date("2026-10-11T18:00:00-03:00"), priority: "normal" as const, href: "/leads/l2#tarefas" },
  { id: "00000000-0000-4000-8000-000000000003", leadId: "l3", leadName: "Júlia Prado", title: "Retornar contato", dueAt: new Date("2026-10-11T19:30:00-03:00"), priority: "normal" as const, href: "/leads/l3#tarefas" },
];

export default function AgendaShowcasePage() {
  const [agenda, setAgenda] = useState(START);
  const script = useMemo(() => buildAssistantScript("agenda", { data: { agenda } as unknown as BrokerWorkspaceData, now }), [agenda]);
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="arc-venancor h-dvh bg-[var(--surface)]">
      <ChatScreen
        identity={{ name: "Agenda", shape: "cubo", hue: 150 }}
        backHref="/dev/agenda"
        script={script}
        instant
        runAction={async (action) => {
          await new Promise((resolve) => setTimeout(resolve, 400));
          const taskId = String(action.payload.taskId ?? "");
          // Stands in for router.refresh: the fresh data arrives a moment after the answer.
          if (action.name === "lead.reopenReturn") setTimeout(() => setAgenda((current) => [...current, START.find((item) => item.id === taskId)!].sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())), 60);
          else setTimeout(() => setAgenda((current) => current.filter((item) => item.id !== taskId)), 60);
          if (action.name === "lead.cancelReturn") return { ok: true, message: `Cancelei o retorno de ${action.payload.leadName}.`, followUp: [{ type: "question", id: `undo-${Date.now()}`, prompt: "Foi sem querer?", choices: [{ id: "undo", label: "Desfazer", action: { kind: "server", name: "lead.reopenReturn", payload: { taskId } } }] }] };
          if (action.name === "lead.reopenReturn") return { ok: true, message: "Pronto, o retorno voltou para a sua Agenda." };
          if (action.name === "lead.completeReturn") return { ok: true, message: "Boa. Tirei esse retorno da sua Agenda." };
          return { ok: true, message: "Combinado. Te lembro amanhã de manhã e ele aparece na sua Agenda." };
        }}
      />
    </main>
  );
}
