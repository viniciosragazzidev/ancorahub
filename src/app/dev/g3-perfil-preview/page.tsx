"use client";

import "@/components/arc/venancor-scope.css";

import { notFound, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { SupervisorBrokerProfile, type SupervisorBrokerProfileProps } from "@/features/supervisor-workspace/broker-profile/supervisor-broker-profile";

/** Dev-only preview of the G3 broker profile with fake data. /dev/g3-perfil-preview?view=gestor|supervisor */
// Fixed clock: server and client must render the same text (no Date.now() here).
const now = Date.parse("2026-10-15T15:00:00-03:00");
const day = 86_400_000;
const iso = (offsetDays: number) => new Date(now + offsetDays * day).toISOString();

const sharedProfile = {
  member: { userId: "broker-ana", name: "Ana Souza", image: null, branchName: "Central", availabilityStatus: "on_duty", email: "ana.souza@exemplo.com", phone: "11999990000", brokerCode: "C-0142", statusLabel: "Ativo" },
  metrics: { portfolio: 38, inService: 9, withoutFirstContact: 2, sales: 4, overdueTasks: 3, qualified: 11, lost: 5 },
  recentLeads: [
    { id: "lead-1", name: "Mariana Costa", status: "quote_sent", queueName: "PME", assignedAt: iso(-1), createdAt: iso(-2) },
    { id: "lead-2", name: "Carlos Lima", status: "in_contact", queueName: "Familiar", assignedAt: iso(-2), createdAt: iso(-3) },
    { id: "lead-3", name: "Beatriz Almeida", status: "negotiation", queueName: null, assignedAt: iso(-4), createdAt: iso(-5) },
  ],
  whatsappHref: "https://wa.me/5511999990000",
  notes: [
    { id: "n-1", kind: "melhoria" as const, body: "Retomar o roteiro de qualificação antes da cotação.", createdAt: iso(-1), followUpAt: iso(-2) },
    { id: "n-2", kind: "elogio" as const, body: "Ótima condução na reunião com a família da Mariana.", createdAt: iso(-3), followUpAt: null },
    { id: "n-3", kind: "acompanhamento" as const, body: "Ver se a documentação do Carlos avançou.", createdAt: iso(-4), followUpAt: iso(6) },
  ],
  recognitions: [
    { id: "r-1", points: 20, reason: "Virada de meta da semana", occurredAt: iso(-2) },
    { id: "r-2", points: 10, reason: "Atendimento rápido no sábado", occurredAt: iso(-6) },
  ],
  performance: {
    window: 7 as const,
    items: [
      { key: "accepted", label: "Aceites", value: "14", trend: "up" as const, better: "up" as const },
      { key: "accept-time", label: "Tempo mediano para aceitar", value: "1 min 05 s", trend: "down" as const, better: "down" as const },
      { key: "on-time", label: "Primeiro contato no prazo", value: "86%", trend: "flat" as const, better: "up" as const },
    ],
  },
  ranking: { medianAcceptSeconds: 65, positions: ["2º nos que mais aceitam"], periodDays: 7 },
  joinedAt: iso(-200),
  pulse: {
    week: [2, 3, 1, 4, 2, 1, 1].map((accepted, index) => ({ date: `d${index}`, label: ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"][index]!, accepted })),
    medianAcceptSeconds: 65,
    teamMedianSeconds: 88,
    onTimeContactRate: 86,
    funnel: [
      { status: "distributed", label: "Novos", total: 3 },
      { status: "in_contact", label: "Em atendimento", total: 4 },
      { status: "quote_sent", label: "Cotações", total: 2 },
      { status: "negotiation", label: "Negociação", total: 2 },
      { status: "documentation_pending", label: "Documentação", total: 1 },
    ],
    attention: [
      { id: "lead-9", name: "Roberto Dias", status: "in_contact", assignedAt: iso(-3), stageEnteredAt: iso(-4), firstContactAt: iso(-3) },
    ],
  },
};

const gestorProps: SupervisorBrokerProfileProps = {
  ...sharedProfile,
  situation: { dutyToday: undefined, newLeads: 3, nextTask: { title: "Retornar a cotação da Mariana", dueAt: iso(-1), leadId: "lead-1", leadName: "Mariana Costa" }, whatsapp: { connected: true, connectedAt: iso(-40) } },
  relationshipHref: "/relacionamento?brokerId=broker-ana",
  showSupervisorActions: false,
  managementActions: <p style={{ margin: 0, fontSize: 13, color: "#6b6b6b" }}>Ações de gestão (dados e acesso) ficam aqui.</p>,
};

const supervisorProps: SupervisorBrokerProfileProps = {
  ...sharedProfile,
  situation: {
    dutyToday: { scheduleName: "Manhã", startsAt: "08:00", endsAt: "12:00", paused: false, presence: "confirmed" },
    newLeads: 3,
    nextTask: { title: "Ligar de volta para a cliente", dueAt: iso(0.4), leadId: "lead-2", leadName: "Carlos Lima" },
    whatsapp: { connected: false, connectedAt: null },
  },
  relationshipHref: "/relacionamento",
  showSupervisorActions: true,
};

function Showcase() {
  const view = useSearchParams().get("view") === "gestor" ? "gestor" : "supervisor";
  return <SupervisorBrokerProfile key={view} {...(view === "gestor" ? gestorProps : supervisorProps)} />;
}

export default function G3ProfilePreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <Suspense><Showcase /></Suspense>;
}
