import { and, eq, isNull, lt, or } from "drizzle-orm";
import Link from "next/link";

import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { ContextNote } from "@/components/ui/context-note";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { TasksWorkspace } from "./tasks-workspace";

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ attention?: string; leadId?: string }> }) {
  const { attention, leadId } = await searchParams;
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const access = context.role === "broker"
    ? or(eq(schema.leadTasks.assignedTo, context.userId), eq(schema.leadTaskAssignees.userId, context.userId))
    : context.role === "manager" && context.branchId
      ? eq(schema.leads.branchId, context.branchId)
      : undefined;
  const leadFilter = leadId ? eq(schema.leadTasks.leadId, leadId) : undefined;
  const overdueFilter = attention === "overdue"
    ? and(isNull(schema.leadTasks.completedAt), lt(schema.leadTasks.dueAt, new Date()))
    : undefined;
  const tasks = await db
    .select({
      id: schema.leadTasks.id,
      leadId: schema.leads.id,
      leadName: schema.leads.nome,
      title: schema.leadTasks.title,
      description: schema.leadTasks.description,
      priority: schema.leadTasks.priority,
      dueAt: schema.leadTasks.dueAt,
      completedAt: schema.leadTasks.completedAt,
      assigneeName: schema.user.name,
      branchName: schema.branches.name,
    })
    .from(schema.leadTasks)
    .innerJoin(schema.leads, eq(schema.leadTasks.leadId, schema.leads.id))
    .leftJoin(schema.leadTaskAssignees, eq(schema.leadTaskAssignees.taskId, schema.leadTasks.id))
    .leftJoin(schema.user, eq(schema.leadTasks.assignedTo, schema.user.id))
    .leftJoin(schema.branches, eq(schema.leads.branchId, schema.branches.id))
    .where(and(
      eq(schema.leadTasks.tenantId, context.tenantId),
      eq(schema.leads.tenantId, context.tenantId),
      ...(access ? [access] : []),
      ...(leadFilter ? [leadFilter] : []),
      ...(overdueFilter ? [overdueFilter] : []),
    ))
    .orderBy(schema.leadTasks.completedAt, schema.leadTasks.dueAt);

  return (
    <>
      <DashboardHeader
        breadcrumb="Operação comercial"
        title="Tarefas"
        rightSlot={
          <Button render={<Link href="/leads" />} size="sm" variant="outline">
            Abrir leads
          </Button>
        }
      />
      <main className="flex min-h-full flex-col gap-4 bg-background p-4 lg:p-6">
        {/* Contexto de página legado, preservado para eventual restauração:
        <section>
          <p className="text-xs font-medium text-primary">OPERAÇÃO COMERCIAL</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Tarefas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Priorize o que precisa acontecer agora e abra o lead para criar ou ajustar responsáveis.</p>
        </section> */}
        {leadId ? <ContextNote className="max-w-xl" variant="info">Exibindo apenas tarefas do lead selecionado. <Link className="font-medium text-primary underline-offset-4 hover:underline" href={`/leads/${leadId}`}>Voltar ao lead</Link></ContextNote> : null}
        {attention === "overdue" ? <ContextNote className="max-w-xl" variant="warning">Exibindo somente tarefas vencidas e ainda não concluídas no seu escopo.</ContextNote> : null}

        <TasksWorkspace
          tasks={tasks.map((task) => ({
            id: task.id,
            leadId: task.leadId,
            leadName: task.leadName,
            title: task.title,
            description: task.description,
            priority: task.priority,
            dueAt: task.dueAt ? task.dueAt.toISOString() : null,
            completedAt: task.completedAt ? task.completedAt.toISOString() : null,
            assigneeName: task.assigneeName,
            branchName: task.branchName,
          }))}
        />
      </main>
    </>
  );
}
