/**
 * Telas da Onda 9 na moldura real: ?tela=relacionamento (as abas e a jornada abrem por clique) e ?tela=cliente
 * (ficha do cliente com vendas, documentos, linha do tempo e renovação). Só desenvolvimento, dados de exemplo.
 */
import type { ReactNode } from "react";

import { DashboardHeader } from "@/components/dashboard-header";
import litePage from "@/components/lite/page/lite-page.module.css";
import { ClientDetailLite } from "@/app/(dashboard)/clientes/[clientId]/client-detail-lite";
import {
  clientActiveCustomerFixture, clientBeneficiariesFixture, clientChecklistFixture, clientDocumentsFixture, clientFixture,
  clientInteractionsFixture, clientRequirementsFixture, clientSalesFixture,
} from "@/app/(dashboard)/clientes/[clientId]/client-detail-fixtures";
import { LeadDocumentsSection } from "@/features/documents/components/lead-documents-section";
import { LeadTimeline } from "@/features/leads/components/lead-timeline";

import { RelacionamentoShellScreen } from "./onda9-relationship-screen";

function ClienteShellScreen() {
  return (
    <>
      <DashboardHeader breadcrumb="Pós-venda" title={clientFixture.name} />
      <main className={litePage.stack}>
        <ClientDetailLite
          client={clientFixture}
          consentimentoLgpd
          sales={clientSalesFixture}
          activeCustomer={clientActiveCustomerFixture}
          renewal={{ days: 27, upcoming: true }}
          dependents={clientBeneficiariesFixture}
          documentCount={clientDocumentsFixture.length}
          canAccessConversas
          hideRegistrationDate={false}
          slots={{
            documents: (
              <LeadDocumentsSection
                leadId={clientFixture.leadId}
                clientId={clientFixture.id}
                requirements={clientRequirementsFixture}
                documents={clientDocumentsFixture}
                checklist={clientChecklistFixture}
                beneficiaries={clientBeneficiariesFixture.map((b) => ({ id: b.id, name: b.name, isHolder: b.isHolder }))}
              />
            ),
            timeline: <LeadTimeline leadId={clientFixture.leadId} interactions={clientInteractionsFixture} />,
          }}
        />
      </main>
    </>
  );
}

export const ONDA9_SCREENS: Record<string, { path: string; render: () => ReactNode }> = {
  relacionamento: { path: "/relacionamento", render: () => <RelacionamentoShellScreen /> },
  cliente: { path: `/clientes/${clientFixture.id}`, render: () => <ClienteShellScreen /> },
};
