import "server-only";

import { getTeamGoalsView } from "@/features/goals/lite-goals-queries";
import type { TenantContext } from "@/shared/auth/types";

import { GoalsSection } from "./goals-section";
import { InsightsSection } from "./insights-section";
import styles from "./team-extras.module.css";
import { getTeamInsights } from "./team-insights";

/** Destaques (até 3) e Metas de uma equipe. Usada na tela da equipe e na /gestao do supervisor. Quem chama checou o acesso. */
export async function TeamExtrasSection({ context, supervisorId, canEditBrokers }: { context: TenantContext; supervisorId: string; canEditBrokers: boolean }) {
  const now = new Date();
  const [insights, goals] = await Promise.all([
    getTeamInsights({ context, supervisorId, now }),
    getTeamGoalsView({ context, supervisorId, now }),
  ]);
  return (
    <div className={styles.extras}>
      <InsightsSection insights={insights} />
      <GoalsSection supervisorId={supervisorId} view={goals} canEditTeam canEditBrokers={canEditBrokers} />
    </div>
  );
}
