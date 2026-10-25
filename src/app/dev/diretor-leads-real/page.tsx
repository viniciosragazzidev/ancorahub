import "@/components/arc/venancor-scope.css";
import "@/components/arc/director-skin.css";
import "@/components/arc/director-primitives.css";

import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

import { ArcScopeProvider } from "@/components/arc/arc-scope-context";
import type { LeadWorkspaceItem } from "@/features/leads/components/lead-workspace-types";

import { LeadsFixtureList } from "./leads-fixture-list";

/**
 * Dev-only: a lista de /leads (LeadsListSwitch, com a chave ligada) com dados de exemplo, dentro do mesmo canvas do app.
 * Não existe em produção. Mesmo padrão de /dev/diretor-dashboard-real.
 */
const BASE = {
  qualificationStatus: "hot",
  origem: "Meta Ads",
  sourceCampaign: "Campanha PME",
  tipo: "PME",
  assignedAt: null,
  stageEnteredAt: null,
  serviceStartedAt: null,
  firstContactAt: null,
  corretorId: null,
  corretorNome: null,
  branchId: "branch-centro",
  branchName: "Centro",
} satisfies Partial<LeadWorkspaceItem>;

const LEADS: LeadWorkspaceItem[] = [
  { ...BASE, id: "l1", nome: "Maria Nova", telefone: "21 90000-0101", status: "new", tags: [{ id: "t1", name: "VIP", colorHue: 280 }], queueName: "Fila PME", queueColorHue: 210, createdAt: "2026-10-24T14:02:00.000Z" },
  { ...BASE, id: "l2", nome: "Carlos Mendes", telefone: "21 90000-0102", status: "distributed", corretorId: "b1", corretorNome: "Ana Souza", assignedAt: "2026-10-24T13:10:00.000Z", isPlantaoAtivo: true, queueName: "Plantão Centro", queueColorHue: 30, createdAt: "2026-10-24T12:40:00.000Z" },
  { ...BASE, id: "l3", nome: "Juliana Prado", telefone: "21 90000-0103", status: "in_contact", qualificationStatus: "warm", origem: "WhatsApp", sourceCampaign: "", corretorId: "b2", corretorNome: "Bruno Lima", branchId: "branch-barra", branchName: "Barra da Tijuca", stageEnteredAt: "2026-10-22T18:20:00.000Z", isManagementInvestigation: true, createdAt: "2026-10-23T18:20:00.000Z" },
  { ...BASE, id: "l4", nome: "Paulo Ribeiro", telefone: "21 90000-0104", status: "quote_sent", qualificationStatus: "cold", origem: "Site", sourceCampaign: "", corretorId: "b1", corretorNome: "Ana Souza", stageEnteredAt: "2026-10-23T10:05:00.000Z", tags: [{ id: "t2", name: "Retorno", colorHue: 30 }], createdAt: "2026-10-23T10:05:00.000Z" },
  { ...BASE, id: "l5", nome: "Renata Alves", telefone: "21 90000-0105", status: "negotiation", corretorId: null, corretorNome: null, returnedUnaccepted: true, branchId: "branch-ni", branchName: "Niterói 1", createdAt: "2026-10-22T16:45:00.000Z" },
  { ...BASE, id: "l6", nome: "Tiago Ferreira", telefone: "21 90000-0106", status: "converted", corretorId: "b2", corretorNome: "Bruno Lima", createdAt: "2026-10-21T09:30:00.000Z" },
];

export default function DirectorLeadsRealPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const skin = { "--director-brand-color": "#3b2dff", "--director-brand-foreground": "#ffffff" } as CSSProperties;
  return (
    <ArcScopeProvider enabled>
      <div className="arc-venancor" data-skin="diretor" style={skin}>
        <div className="app-shell-canvas h-app overflow-y-auto overflow-x-hidden overscroll-contain arc-venancor" data-slot="app-scroll-frame" data-skin="diretor" style={{ ...skin, background: "var(--background)" }}>
          <div className="mx-auto w-full max-w-[1328px] px-4 pb-28 pt-4 md:px-6">
            <h1 className="mb-4 text-xl">Leads</h1>
            <LeadsFixtureList leads={LEADS} />
          </div>
        </div>
      </div>
    </ArcScopeProvider>
  );
}
