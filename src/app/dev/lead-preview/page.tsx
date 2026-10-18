import "@/components/arc/venancor-scope.css";

import { notFound } from "next/navigation";

import { buildLeadConversationScript } from "@/features/broker-workspace/chat/lead-script";
import { LeadConversation } from "@/features/broker-workspace/chat/lead-conversation";
import { LightLeadDetail } from "@/features/broker-workspace/components/light-lead-detail";

/**
 * Dev-only print of the broker's lead screen (2026-10-17) with sample data, in two states:
 * /dev/lead-preview?state=aceite (waiting for acceptance) and ?state=atendimento (in contact, client replied 5 min ago).
 * Same frame as production: the conversation rail on the left on computers (.lite-split) and the real conversation.
 */
export default async function LeadPreviewPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { state } = await searchParams;
  const now = new Date();
  const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

  const aceite = state !== "atendimento";
  const nextAction = "Enviar a cotação da Bradesco e da SulAmérica para 4 vidas";
  const lead = {
    id: "preview-lead",
    nome: "Paulo Henrique Lima de Albuquerque",
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
    summary: "Empresa com 4 vidas procurando plano para equipe comercial. Hoje tem Amil e acha caro; quer rede boa em Niterói e no Centro do Rio.",
    clientInfo: [
      { key: "vidas", label: "Vidas", value: "4" },
      { key: "idades", label: "Idades", value: "34, 31, 8 e 5" },
      { key: "plano", label: "Plano atual", value: "Amil 400" },
      { key: "orcamento", label: "Orçamento", value: "Até R$ 1.800" },
    ],
  };
  const script = buildLeadConversationScript({
    lead: { ...lead, slaFirstContactMinutes: 15, potentialSale: false, branchName: "Niterói" },
    events: [],
    viewerId: "preview",
    now,
    whatsappUrl: aceite ? null : "https://wa.me/5521987654321",
    hideArrival: true,
    panel: true,
    advice: { nextBestAction: nextAction, pendingFrom: aceite ? null : "BROKER" },
    messages: aceite ? [] : [
      { id: "m1", body: "Oi! Quero um plano para minha empresa, somos 4.", direction: "inbound", sentAt: minutesAgo(90) },
      { id: "m2", body: "Olá, Paulo! Sou a assistente da Âncora. Quantas vidas e quais idades?", direction: "outbound", senderRole: "assistant", sentAt: minutesAgo(89) },
      { id: "m3", body: "4 vidas: 34, 31, 8 e 5 anos.", direction: "inbound", sentAt: minutesAgo(88) },
      { id: "m4", body: "Oi Paulo, aqui é o Vinicios, seu corretor. Já vou montar as opções.", direction: "outbound", sentAt: minutesAgo(80) },
      { id: "m5", body: "Perfeito, prefiro algo com rede boa em Niterói. Consegue me mandar hoje ainda?", direction: "inbound", sentAt: minutesAgo(5) },
    ],
  });

  return (
    <div className="arc-venancor h-[100dvh] min-h-0 bg-(--surface) text-(--foreground)">
      <div className="lite-split">
        <aside className="lite-rail" aria-label="Painel lateral" />
        <div className="lite-main">
          <LightLeadDetail
            variant="panel"
            lead={lead}
            requirements={[]}
            documents={[]}
            carriers={[]}
            activity={{
              lastClientAt: aceite ? null : minutesAgo(5),
              lastBrokerAt: aceite ? null : minutesAgo(80),
              nextAction,
              now,
            }}
            conversation={<LeadConversation leadId={lead.id} name={lead.nome} initials="PH" canWrite script={script} />}
          />
        </div>
      </div>
    </div>
  );
}
