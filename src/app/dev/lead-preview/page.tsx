import "@/components/arc/venancor-scope.css";

import { notFound } from "next/navigation";

import { buildLeadConversationScript } from "@/features/broker-workspace/chat/lead-script";
import { LeadConversation } from "@/features/broker-workspace/chat/lead-conversation";
import { LightLeadDetail } from "@/features/broker-workspace/components/light-lead-detail";
import type { BrokerAdContext } from "@/features/leads/broker-ad-context";

/**
 * Dev-only print of the broker's lead screen (2026-10-17) with sample data, in two states:
 * /dev/lead-preview?state=aceite (waiting for acceptance) and ?state=atendimento (in contact, client replied 5 min ago).
 * Same frame as production: the conversation rail on the left on computers (.lite-split) and the real conversation.
 * Cartão "De onde veio" (10/11/2026): &anuncio=formulario | whatsapp | plano | nenhum, e &ficha=1 para a ficha.
 */
// Imagem sintética do anúncio (sem rede): o cartão mostra como mostraria a miniatura da Meta.
const AD_IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#dbe7f5"/><circle cx="300" cy="250" r="120" fill="#9fbbe0"/><rect x="120" y="420" width="360" height="56" rx="28" fill="#ffffff"/></svg>')}`;

function adPreview(kind: string | undefined): BrokerAdContext | null {
  if (!kind || kind === "nenhum") return null;
  if (kind === "whatsapp") {
    return {
      entry: "whatsapp", offer: null, title: "Plano de saúde para MEI a partir de R$ 129",
      body: "Tem CNPJ ou MEI? Contrate plano empresarial com até 40% de economia em relação ao individual. Rede ampla no Rio e em Niterói, consultas e exames sem coparticipação nos 3 primeiros meses. Chame no WhatsApp e receba a cotação na hora.",
      mediaType: "video", imageUrl: AD_IMAGE,
    };
  }
  if (kind === "plano") return { entry: "form", offer: "Bradesco PME, 2 a 29 vidas, custo-benefício", title: null, body: null, mediaType: null, imageUrl: null };
  return {
    entry: "form", offer: "Amil custo-benefício (linha Fácil), individual e familiar, a partir de R$ 89. Não oferecer linha 400 ou superior de saída.",
    title: "Plano de saúde a partir de R$ 89", body: "Amil Fácil com rede no Rio. Faça a cotação em 1 minuto.", mediaType: "image", imageUrl: AD_IMAGE,
  };
}

export default async function LeadPreviewPage({ searchParams }: { searchParams: Promise<{ state?: string; anuncio?: string; ficha?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { state, anuncio, ficha } = await searchParams;
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
    adContext: adPreview(anuncio),
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
      ...Array.from({ length: 24 }, (_, i) => ({ id: `x${i}`, body: i % 2 ? "Certo, vou ver aqui com a operadora e já te retorno com os valores." : "Tem coparticipação? E a carência para consulta, como fica?", direction: i % 2 ? "outbound" : "inbound", sentAt: minutesAgo(70 - i * 2) })),
      { id: "m5", body: "Perfeito, prefiro algo com rede boa em Niterói. Consegue me mandar hoje ainda?", direction: "inbound", sentAt: minutesAgo(5) },
    ],
  });

  if (ficha) {
    return (
      <div className="arc-venancor min-h-[100dvh] bg-(--background) text-(--foreground)">
        <LightLeadDetail lead={lead} requirements={[]} documents={[]} carriers={[]} />
      </div>
    );
  }

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
