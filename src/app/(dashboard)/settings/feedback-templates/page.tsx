import { DashboardHeader } from "@/components/dashboard-header";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { FeedbackTemplatesClient } from "./client";
import { listChecklistTemplatesAction } from "@/features/leads/checklist-actions";

export default async function FeedbackTemplatesPage() {
  const context = await getRequiredTenantContext();
  if (context.role === "broker") throw new Error("Acesso restrito a Gestores e Diretores.");

  const templates = await listChecklistTemplatesAction();

  return (
    <>
      <DashboardHeader breadcrumb="Checklists de feedback" title="Checklists de atendimento" />
      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <div>
          <p className="text-xs font-medium text-primary">CONFIGURAÇÕES</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Checklists de atendimento</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Crie templates com perguntas orientadas para o corretor registrar durante o feedback do atendimento.
          </p>
        </div>
        <FeedbackTemplatesClient initialTemplates={templates} />
      </div>
    </>
  );
}
