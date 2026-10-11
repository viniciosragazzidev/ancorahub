"use client";

import "@/components/arc/venancor-scope.css";

import { notFound } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ChatScreen } from "@/components/chat/chat-screen";
import type { ChatBlock } from "@/components/chat/types";

/**
 * Dev-only: a long lead conversation that refreshes like realtime does
 * (router.refresh every few seconds), to check scrolling stays smooth.
 */
const LINES = [
  "Oi, boa tarde! Vi o anúncio do plano de saúde e queria saber os valores.",
  "Olá! Claro, me conta quantas pessoas e as idades, por favor?",
  "Somos eu (34), minha esposa (32) e dois filhos (5 e 8).",
  "Perfeito. Tem preferência de hospital ou região?",
  "Aqui em Nova Iguaçu, se tiver o Hospital Geral perto seria ótimo. E queria saber se tem coparticipação, porque já tive plano assim e não gostei muito.",
  "Entendi. Vou montar duas opções, uma com e outra sem coparticipação, e te mando aqui.",
];

function blocks(revision: number): ChatBlock[] {
  return Array.from({ length: 120 }, (_, index) => {
    const text = LINES[index % LINES.length] ?? "";
    const from = index % 2 === 0 ? "client" : "broker";
    return { type: "whatsapp", id: `m-${index}`, text, at: `${String(9 + Math.floor(index / 12)).padStart(2, "0")}:${String((index * 7) % 60).padStart(2, "0")}`, from } as ChatBlock;
  }).concat([{ type: "assistant", id: "tail", text: revision >= 0 ? "Conversa de teste." : "" }]);
}

export default function ConversaShowcasePage() {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("static") === "1") return;
    const timer = window.setInterval(() => setRevision((value) => value + 1), 1500);
    return () => window.clearInterval(timer);
  }, []);
  const script = useMemo(() => ({ blocks: blocks(revision) }), [revision]);
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="arc-venancor h-dvh bg-[var(--surface)]">
      <ChatScreen identity={{ name: "Carla Mendes", shape: "mochi", hue: null, initials: "CM" }} backHref="/dev/conversa" script={script} instant />
    </main>
  );
}
