import "@/components/arc/venancor-scope.css";

import { notFound } from "next/navigation";

import { LightChrome } from "@/components/light/light-chrome";
import { LightClientsList } from "@/features/broker-workspace/components/light-clients-list";
import { LightClientDetail } from "@/features/broker-workspace/components/light-client-detail";

/** Dev-only print of the E2 screens (gestor/supervisor Clientes in Lite) with sample data. /dev/e2-preview?view=list|detail */
const clients = [
  { id: "c1", name: "Marina Alves", phone: "11999998888", email: "marina@example.com", convertedAt: "2026-09-20T12:00:00Z", brokerName: "Paulo Dias" },
  { id: "c2", name: "Carlos Mendes", phone: "11977776666", email: null, convertedAt: "2026-09-22T12:00:00Z", brokerName: "Ana Souza" },
  { id: "c3", name: "Juliana Prado", phone: null, email: null, convertedAt: "2026-10-02T12:00:00Z", brokerName: "Paulo Dias" },
];

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

  // The real Lite shell (rail on desktop, bottom bar on mobile) as the gestor sees it.
  return (
    <LightChrome audience="manager">
      {view === "detail" ? <LightClientDetail data={detail} /> : <LightClientsList clients={clients} management />}
    </LightChrome>
  );
}
