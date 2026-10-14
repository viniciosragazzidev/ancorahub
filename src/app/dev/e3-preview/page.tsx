"use client";

import "@/components/arc/venancor-scope.css";

import { notFound, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { TeamConversationView } from "@/features/team-conversations/team-conversation-view";
import { TeamConversationsList } from "@/features/team-conversations/team-conversations-list";

/** Dev-only showcase of the team messages. /dev/e3-preview?view=conversa */
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

function Showcase() {
  const params = useSearchParams();
  if (params.get("view") === "conversa") {
    return <TeamConversationView conversation={{ leadId: "l1", leadName: "Carla Souza", brokerName: "Paulo Dias", messages: [
      { id: "1", body: "Oi! Vi o anúncio do plano de saúde, queria saber valores.", at: minutesAgo(95), fromClient: true, byAi: false, mediaKind: null },
      { id: "2", body: "Olá, Carla! Sou o assistente da Âncora. Para quantas pessoas seria o plano?", at: minutesAgo(94), fromClient: false, byAi: true, mediaKind: null },
      { id: "3", body: "Para mim e meu marido, os dois com 34 anos.", at: minutesAgo(90), fromClient: true, byAi: false, mediaKind: null },
      { id: "4", body: "Oi Carla, aqui é o Paulo! Já separei três opções com coparticipação. Posso te mandar agora?", at: minutesAgo(40), fromClient: false, byAi: false, mediaKind: null },
      { id: "5", body: "", at: minutesAgo(38), fromClient: false, byAi: false, mediaKind: "document" },
      { id: "6", body: "Tem plano para 2 pessoas com rede em Niterói?", at: minutesAgo(12), fromClient: true, byAi: false, mediaKind: null },
    ] }} />;
  }
  return <TeamConversationsList scopeLabel="unidade" conversations={[
    { leadId: "l1", leadName: "Carla Souza", brokerId: "b1", brokerName: "Paulo Dias", lastBody: "Tem plano para 2 pessoas com rede em Niterói?", lastAt: minutesAgo(12), lastFromClient: true, lastByAi: false, messages: 6 },
    { leadId: "l2", leadName: "Bruno Lima", brokerId: "b2", brokerName: "Ana Reis", lastBody: "Te mando a cotação já já", lastAt: minutesAgo(30), lastFromClient: false, lastByAi: false, messages: 9 },
    { leadId: "l3", leadName: "Marina Alves", brokerId: "b1", brokerName: "Paulo Dias", lastBody: "Quais documentos preciso enviar?", lastAt: minutesAgo(65), lastFromClient: true, lastByAi: false, messages: 14 },
    { leadId: "l4", leadName: "Juliana Prado", brokerId: null, brokerName: null, lastBody: "Para quantas pessoas seria o plano?", lastAt: minutesAgo(180), lastFromClient: false, lastByAi: true, messages: 2 },
    { leadId: "l5", leadName: "Roberto Nunes", brokerId: "b3", brokerName: "Gleice Fajardo", lastBody: "Fechado, obrigado!", lastAt: minutesAgo(60 * 26), lastFromClient: true, lastByAi: false, messages: 21 },
  ]} />;
}

export default function TeamMessagesShowcasePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <div className="arc-venancor min-h-dvh bg-(--background)"><Suspense><Showcase /></Suspense></div>;
}
