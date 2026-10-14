import "@/components/arc/venancor-scope.css";

import { notFound } from "next/navigation";

import { LightChrome } from "@/components/light/light-chrome";
import { RouteAs } from "./route-as";
import { LightClientsList } from "@/features/broker-workspace/components/light-clients-list";
import { LightClientDetail } from "@/features/broker-workspace/components/light-client-detail";

/** Dev-only print of the E2 screens (gestor/supervisor Clientes in Lite) with sample data. /dev/e2-preview?view=list|detail */
const clients = [
  { id: "c1", name: "Marina Alves", phone: "11999998888", email: "marina@example.com", convertedAt: "2026-09-20T12:00:00Z", brokerName: "Paulo Dias", status: "active" },
  { id: "c2", name: "Carlos Mendes", phone: "11977776666", email: null, convertedAt: "2026-09-22T12:00:00Z", brokerName: "Ana Souza", status: "cancelled" },
  { id: "c3", name: "Juliana Prado", phone: null, email: null, convertedAt: "2026-10-02T12:00:00Z", brokerName: "Paulo Dias", status: "active" },
];

/** Sample conversation list for the rail (the real one comes from getChatRailData). */
const rail = {
  viewerName: "Vinicios",
  assistants: [{ id: "ancora", kind: "assistant" as const, name: "Âncora", preview: "Sem avisos novos.", at: null, unread: false, waitingYou: false, href: "/dashboard/c/ancora", shape: "logo" as const, hue: null }],
  leads: [
    { id: "unidade", kind: "lead" as const, name: "Leads da unidade", preview: "12 leads esperando atendimento", at: null, unread: true, waitingYou: true, href: "/leads", shape: "mochi" as const, hue: 212 },
    { id: "minha-unidade", kind: "lead" as const, name: "Minha unidade", preview: "3 corretores ativos", at: null, unread: false, waitingYou: false, href: "/unidades", shape: "cubo" as const, hue: 150 },
    { id: "notificacoes", kind: "lead" as const, name: "Notificações", preview: "2 avisos novos", at: null, unread: false, waitingYou: false, href: "/notificacoes", shape: "nuvem" as const, hue: 330 },
  ],
  nowIso: "2026-10-14T15:00:00.000Z",
  canQuote: false,
  leadsBadgeCount: 0,
};

const detail = {
  client: { id: "c1", leadId: "lead-1", name: "Marina Alves", phone: "11999998888", email: "marina@example.com", convertedAt: "2026-09-20T12:00:00Z", branchName: "Unidade Centro", brokerName: "Paulo Dias" },
  activeCustomer: { status: "active", coverageStartDate: "2026-09-20", contractAnniversary: "2026-12-01", expirationDate: null, renewalStatus: "pending_window", cancellationDate: null, cancellationReason: null },
  sales: [{ id: "s1", planName: "Plano Essencial", carrierName: "Operadora X", saleValue: "350.5", policyNumber: "APL-9", status: "approved", saleDate: "2026-09-20", brokerName: "Paulo Dias" }],
  beneficiaries: [{ id: "b1", name: "Marina Alves", relationship: null, isHolder: true }, { id: "b2", name: "Lucas Alves", relationship: "Filho", isHolder: false }],
  documents: [{ id: "d1", filename: "rg.pdf", status: "approved", requirementName: "RG" }],
  timeline: [{ id: "t1", tipo: "status_change", conteudo: "Venda concluída", userName: "Paulo Dias", createdAt: "2026-09-20T12:00:00Z" }],
};

export default async function E2PreviewPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { view } = await searchParams;

  // The real Lite shell (rail on desktop, bottom bar on mobile) as the gestor sees it, at the real route.
  const path = view === "detail" ? "/clientes/c1" : "/clientes";
  return (
    <LightChrome audience="manager" initialChatRail={rail}>
      <RouteAs path={path} />
      {view === "detail" ? <LightClientDetail data={detail} /> : <LightClientsList clients={clients} management />}
    </LightChrome>
  );
}
