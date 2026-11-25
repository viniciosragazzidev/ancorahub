import { connection } from "next/server";
import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import litePage from "@/components/lite/page/lite-page.module.css";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
import { canSeeTeamTasks } from "@/features/tasks/task-due-groups";
import { normalizeTaskListFilters } from "@/features/tasks/task-list-filters";
import { getTaskList, TASKS_PAGE_SIZE } from "@/features/tasks/task-list-queries";
import { hasPermission } from "@/shared/auth/permissions";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import { TasksLite } from "./tasks-lite";

export const dynamic = "force-dynamic";

/**
 * /tarefas (25/11/2026): tarefas dos leads agrupadas por prazo. "Minhas" para todos; "Da equipe" para diretor
 * (empresa), gestor (unidade) e supervisor (equipe), no mesmo escopo dos relatórios. Paginação de 50 no servidor.
 */
export default async function TasksPage({ searchParams }: { searchParams: Promise<{ escopo?: string; situacao?: string; responsavel?: string; page?: string }> }) {
  await connection();
  const context = await getRequiredTenantContext();
  if (!hasPermission(context.role, "acessar_tarefas")) redirect("/access-denied");

  const filters = normalizeTaskListFilters(context.role, await searchParams);
  const now = new Date();
  const data = await getTaskList(context, filters, now);
  const totalPages = Math.max(1, Math.ceil(data.total / TASKS_PAGE_SIZE));
  const scopeLabel = filters.scope === "equipe" ? "da equipe" : "suas";
  const summary = filters.situation === "concluidas"
    ? `${data.total.toLocaleString("pt-BR")} ${data.total === 1 ? "concluída" : "concluídas"} ${scopeLabel}`
    : `${data.total.toLocaleString("pt-BR")} ${data.total === 1 ? "aberta" : "abertas"} ${scopeLabel} · ${data.overdue.toLocaleString("pt-BR")} ${data.overdue === 1 ? "atrasada" : "atrasadas"}`;

  const content = (
    <TasksLite
      rows={data.rows}
      total={data.total}
      overdue={data.overdue}
      page={filters.page}
      totalPages={totalPages}
      pageSize={TASKS_PAGE_SIZE}
      scope={filters.scope}
      situation={filters.situation}
      assigneeId={filters.assigneeId}
      assignees={data.assignees}
      canSeeTeam={canSeeTeamTasks(context.role)}
      generatedAt={now.toISOString()}
    />
  );

  if (await isDirectorLitePageOnServer(context, "/tarefas")) {
    return (
      <>
        <DashboardHeader breadcrumb="Leads" title="Tarefas" summary={summary} />
        <main className={litePage.stack}>{content}</main>
      </>
    );
  }

  // Corretor no app Lite, supervisor e gestor: a mesma tela dentro do escopo Lite, como a Agenda.
  return (
    <main className="arc-venancor lite-page flex min-h-full flex-col gap-5 bg-(--surface) text-(--foreground)">
      <header>
        <h1 className="lite-page-title">Tarefas</h1>
        <p className="lite-page-subtitle">Retornos, documentos e confirmações por prazo. Toque em uma tarefa para abrir o lead.</p>
      </header>
      {content}
    </main>
  );
}
