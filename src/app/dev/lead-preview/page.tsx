import "@/components/arc/venancor-scope.css";

import { notFound } from "next/navigation";

import { LightLeadDetail } from "@/features/broker-workspace/components/light-lead-detail";

/**
 * Dev-only print of the broker's lead screen (2026-10-17) with sample data, in two states:
 * /dev/lead-preview?state=aceite (waiting for acceptance) and ?state=atendimento (in contact, client replied 5 min ago).
 */
export default async function LeadPreviewPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { state } = await searchParams;
  const now = new Date();
  const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

  const aceite = state !== "atendimento";
  const lead = {
    id: "preview-lead",
    nome: "Paulo Henrique Lima",
    telefone: aceite ? null : "(21) 98765-4321",
    email: aceite ? null : "paulo.lima@exemplo.com",
    status: aceite ? "distributed" : "in_contact",
    createdAt: minutesAgo(40),
    assignedAt: minutesAgo(aceite ? 6 : 95),
    dutyName: "PRESENCIAL TARDE",
    isCurrentBroker: true,
    tipo: "PME",
    livesCount: 4,
    city: "Niterói",
    urgency: "Esta semana",
    summary: "Empresa com 4 vidas procurando plano para equipe comercial.",
    clientInfo: [{ key: "vidas", label: "Vidas", value: "4" }],
  };

  return (
    <div className="arc-venancor h-[100dvh] min-h-0 bg-(--surface) text-(--foreground)">
      <LightLeadDetail
        variant="panel"
        lead={lead}
        requirements={[]}
        documents={[]}
        carriers={[]}
        activity={{
          lastClientAt: aceite ? null : minutesAgo(5),
          lastBrokerAt: aceite ? null : minutesAgo(80),
          nextAction: null,
          now,
        }}
        conversation={<div className="flex h-full min-h-0 items-center justify-center p-6 text-sm text-(--text-secondary)">Conversa de exemplo</div>}
      />
    </div>
  );
}
