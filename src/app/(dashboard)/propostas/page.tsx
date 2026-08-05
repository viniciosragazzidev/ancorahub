import type { Metadata } from "next";
import { getProposals, getExpiringProposals, getLeadsForProposals } from "@/features/proposals/queries";
import { PropostasClient } from "./_components/propostas-client";

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
