"use client";

import "@/components/arc/venancor-scope.css";

import { notFound, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { ChatHome } from "@/components/chat/chat-home";
import { TOUR_STORAGE_KEY } from "@/components/chat/tour/tour-steps";
import type { ThreadSummary } from "@/components/chat/types";
import type { FirstStep } from "@/features/assist/first-steps";

/** Dev-only showcase of the broker Início with the next action and first steps. /dev/inicio?next=urgent|calm|none&steps=1 */
const thread = (values: Partial<ThreadSummary>): ThreadSummary => ({ id: "t", kind: "assistant", name: "Âncora", preview: "Sem avisos novos.", at: null, unread: false, waitingYou: false, href: "/dashboard/c/ancora", shape: "logo", hue: null, ...values });
const steps: FirstStep[] = [
  { key: "photo", title: "Coloque sua foto", detail: "Os clientes e a equipe reconhecem você.", href: "/settings?tab=conta", done: true },
  { key: "whatsapp", title: "Conecte seu WhatsApp", detail: "Para mandar a primeira mensagem pelo app.", href: "/settings?tab=whatsapp", done: false },
  { key: "availability", title: "Diga quando você atende", detail: "Dias e horários em que recebe leads.", href: "/settings?tab=disponibilidade", done: true },
  { key: "tour", title: "Faça o tour de 3 minutos", detail: "Mostra onde fica cada coisa.", href: "/dashboard?tour=1", done: false },
  { key: "first_contact", title: "Faça seu primeiro atendimento", detail: "Aceite um lead e mande a primeira mensagem.", href: "/minha-fila", done: false },
];

function Showcase() {
  const params = useSearchParams();
  // The welcome card and the tour would cover the screen in a screenshot.
  useState(() => { try { window.localStorage.setItem("ancora:lite-welcome:2026-10-chat", "1"); window.localStorage.setItem(TOUR_STORAGE_KEY, "skipped"); } catch { /* ignore */ } return null; });
  const kind = params.get("next") ?? "urgent";
  const next = kind === "none" ? null : kind === "calm"
    ? { label: "Fechar a missão", detail: "Falta 1 para \"Zerar os retornos vencidos\" (+20 pts).", href: "/jornada", urgent: false }
    : { label: "Atender Carla", detail: "O prazo do primeiro contato já passou (há 18 min).", href: "/leads/l1", urgent: true };
  return (
    <ChatHome
      viewerName="Vinicios Ragazzi"
      nowIso="2026-10-10T15:00:00.000Z"
      canQuote
      assistants={[thread({}), thread({ id: "j", assistant: "jornada" as never, name: "Jornada", preview: "Nível 2 · 340 pts nesta semana", href: "/dashboard/c/jornada", shape: "mochi", hue: 85 })]}
      leads={[thread({ id: "l1", kind: "lead", leadId: "l1", name: "Carla Mendes", preview: "Oi, queria saber do plano PME", waitingYou: true, href: "/leads/l1", initials: "CM", shape: "logo", hue: null })]}
      summary={{ receivedToday: 3, acceptedToday: 2, inServiceNow: 4, slaAtRiskNow: 1, duty: null, goal: null, next }}
      firstSteps={params.get("steps") === "1" ? steps : null}
    />
  );
}

export default function HomeShowcasePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <main className="arc-venancor"><Suspense fallback={null}><Showcase /></Suspense></main>;
}
