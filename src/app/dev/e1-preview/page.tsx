import "@/components/arc/venancor-scope.css";

import { notFound } from "next/navigation";

import { LightChrome } from "@/components/light/light-chrome";
import { SupervisorLeadDetail } from "@/features/supervisor-workspace/supervisor-lead-detail";
import { RouteAs } from "./route-as";

/** Dev-only print of the E1 gestor lead detail in the Lite shell, with sample data. /dev/e1-preview */
const rail = {
  viewerName: "Ana Gestora",
  assistants: [{ id: "ancora", kind: "assistant" as const, name: "Âncora", preview: "Sem avisos novos.", at: null, unread: false, waitingYou: false, href: "/dashboard/c/ancora", shape: "logo" as const, hue: null }],
  leads: [
    { id: "unidade", kind: "lead" as const, name: "Leads da unidade", preview: "12 leads esperando atendimento", at: null, unread: true, waitingYou: true, href: "/leads", shape: "mochi" as const, hue: 212 },
    { id: "minha-unidade", kind: "lead" as const, name: "Minha unidade", preview: "3 corretores ativos", at: null, unread: false, waitingYou: false, href: "/unidades", shape: "cubo" as const, hue: 150 },
  ],
  nowIso: "2026-10-14T15:00:00.000Z",
  canQuote: false,
  leadsBadgeCount: 1,
};

export default async function E1PreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const now = "2026-10-14T15:00:00.000Z";
  return (
    <LightChrome audience="manager" initialChatRail={rail}>
      <RouteAs path="/leads/lead-1" />
      <SupervisorLeadDetail
        lead={{ id: "lead-1", name: "Marina Alves", status: "in_contact", ownerId: "b1", ownerName: "Paulo Dias", ownerImage: null, productName: "Plano Essencial", assignedAt: new Date("2026-10-12T12:00:00Z"), branchName: "Central" }}
        timeline={[{ id: "t1", tipo: "status_change", conteudo: "Lead atribuído ao corretor", userName: "Sistema", createdAt: "2026-10-12T12:00:00Z" }]}
        now={now}
        managerBrokers={[{ id: "b2", name: "Ana Souza" }]}
        tasks={[
          { id: "k1", title: "Ligar para confirmar a cotação", dueAt: new Date("2026-10-14T18:00:00Z"), completedAt: null, priority: "normal" },
          { id: "k2", title: "Enviar proposta", dueAt: null, completedAt: new Date("2026-10-13T12:00:00Z"), priority: "normal" },
        ]}
        documents={[{ id: "d1", filename: "rg.pdf", status: "approved", requirementName: "RG" }, { id: "d2", filename: "comprovante.pdf", status: "pending", requirementName: "Comprovante de renda" }]}
      />
    </LightChrome>
  );
}
