import type { Metadata } from "next";
import { getProposals, getExpiringProposals, getLeadsForProposals } from "@/features/proposals/queries";
import { PropostasClient } from "./_components/propostas-client";
import { PropostasLite } from "./_components/propostas-lite";
import { DashboardHeader } from "@/components/dashboard-header";
import litePage from "@/components/lite/page/lite-page.module.css";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";

export const metadata: Metadata = {
  title: "Propostas Comerciais — AncoraHub",
  description: "Acompanhe e gerencie as propostas comerciais, validades, estados de negociacao e fechamento comercial.",
};

export default async function PropostasPage() {
  const [proposals, expiringProposals, leads] = await Promise.all([
    getProposals(),
    getExpiringProposals(),
    getLeadsForProposals(),
  ]);

  // Chave do diretor: a mesma tela no visual Lite, com o título no topo da moldura.
  const context = await getRequiredTenantContext();
  if (await isDirectorLitePageOnServer(context, "/propostas")) {
    return (
      <>
        <DashboardHeader breadcrumb="Operação comercial" title="Propostas" />
        <main className={litePage.stack}>
          <PropostasLite initialProposals={proposals} expiringProposals={expiringProposals} leads={leads} />
        </main>
      </>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Propostas Comerciais</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie o ciclo de propostas, acompanhe validades e converta negociacoes em vendas.
          </p>
        </div>
      </div>
      <PropostasClient
        initialProposals={proposals}
        expiringProposals={expiringProposals}
        leads={leads}
      />
    </div>
  );
}
