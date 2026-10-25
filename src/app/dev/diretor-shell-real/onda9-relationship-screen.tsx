"use client";

/**
 * Dev-only: /relacionamento Lite na moldura real, com dados de exemplo. As ações da jornada aqui só respondem "ok"
 * no navegador (nada vai ao servidor); a página real passa as Server Actions de verdade.
 */
import { DashboardHeader } from "@/components/dashboard-header";
import litePage from "@/components/lite/page/lite-page.module.css";
import type { DirectorJourneyActions } from "@/features/journey/components/director/director-journey-panel";
import { journeyDataFixture, relationshipHistoryFixture, relationshipOptionsFixture } from "@/features/relationship/components/director-lite/fixtures";
import { RelationshipJourneyLite } from "@/features/relationship/components/director-lite/relationship-journey-lite";

const fixtureActions: DirectorJourneyActions = {
  createCampaign: async () => ({ ok: false, message: "Só na tela real." }),
  pauseCampaign: async () => ({ ok: true }),
  updateRule: async () => ({ ok: true }),
  restoreRules: async () => ({ ok: true }),
  reverseEvent: async () => ({ ok: true }),
};

export function RelacionamentoShellScreen() {
  return (
    <>
      <DashboardHeader breadcrumb="Relacionamento" title="Central de relacionamento" />
      <main className={litePage.stack}>
        <RelationshipJourneyLite
          relationshipEnabled
          journeyEnabled
          options={relationshipOptionsFixture}
          history={relationshipHistoryFixture}
          data={journeyDataFixture}
          actions={fixtureActions}
        />
      </main>
    </>
  );
}
