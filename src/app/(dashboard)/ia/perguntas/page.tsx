import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import page from "@/components/lite/page/lite-page.module.css";
import { canAnswerDirectionQuestions } from "@/features/ai-qualification/direction-questions-core";
import { listDirectionQuestions } from "@/features/ai-qualification/direction-questions-service";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import { DirectionQuestionsWorkspace } from "./_components/direction-questions-workspace";

export const dynamic = "force-dynamic";

/**
 * Perguntas para a direção (26/11/2026): o que a IA de qualificação não soube responder ao lead. Só quem responde
 * abre (diretor: empresa; gestor: só os leads da unidade, mesmo escopo dos relatórios).
 */
export default async function DirectionQuestionsPage() {
  const context = await getRequiredTenantContext();
  if (!canAnswerDirectionQuestions(context.role, context.jobTitle)) redirect("/access-denied");
  const list = await listDirectionQuestions(context);
  const open = list.ready ? list.rows.filter((row) => row.status === "open").length : 0;
  return (
    <>
      <DashboardHeader
        breadcrumb="Atendimento IA"
        title="Perguntas para a direção"
        summary={!list.ready ? "Aguardando atualização do banco" : open ? `${open.toLocaleString("pt-BR")} ${open === 1 ? "pergunta aberta" : "perguntas abertas"}` : "Nenhuma pergunta aberta"}
      />
      <main className={page.stack}>
        {list.ready ? (
          <DirectionQuestionsWorkspace initialRows={list.rows} />
        ) : (
          <section className={page.group}>
            <p className={page.emptyText}>Falta aplicar a migration 0246 no banco. Até lá, a IA responde como antes e nenhuma pergunta é registrada.</p>
          </section>
        )}
      </main>
    </>
  );
}
