import { and, eq, isNull, lt, or } from "drizzle-orm";
import Link from "next/link";

import { DashboardHeader } from "@/components/dashboard-header";
import { ListChecks } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContextNote } from "@/components/ui/context-note";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { OwnershipContext } from "@/components/ownership-context";

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
      <DashboardHeader breadcrumb="Operação comercial" title="Tarefas" />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium text-primary">OPERAÇÃO COMERCIAL</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Tarefas</h1>
            <p className="mt-1 text-sm text-muted-foreground">Priorize o que precisa acontecer agora e abra o lead para criar ou ajustar responsáveis.</p>
            {leadId ? <ContextNote className="mt-3 max-w-xl" variant="info">Exibindo apenas tarefas do lead selecionado. <Link className="font-medium text-primary underline-offset-4 hover:underline" href={`/leads/${leadId}`}>Voltar ao lead</Link></ContextNote> : null}
            {attention === "overdue" ? <ContextNote className="mt-3 max-w-xl" variant="warning">Exibindo somente tarefas vencidas e ainda não concluídas no seu escopo.</ContextNote> : null}
          </div>
          <Button render={<Link href="/leads" />} variant="outline">Abrir leads para criar tarefa</Button>
        </section>

        <Card className="border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle>Minha operação</CardTitle>
            <CardDescription>Tarefas urgentes podem envolver vários corretores. As demais preservam um responsável claro.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="hidden divide-y divide-border max-[559px]:block">
              {tasks.map((task) => (
                <Link key={task.id} href={`/leads/${task.leadId}`} className="block px-4 py-3.5 transition-colors duration-[var(--duration-quick)] ease-out active:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={task.completedAt ? "truncate font-medium line-through text-muted-foreground" : "truncate font-medium"}>{task.title}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{task.leadName}</p>
                    </div>
                    <Badge className={task.priority === "urgent" ? "shrink-0 border-destructive/30 bg-destructive/10 text-destructive" : "shrink-0 border-border"} variant="outline">{task.priority === "urgent" ? "Urgente" : task.priority === "low" ? "Baixa" : "Normal"}</Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>{task.dueAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(task.dueAt) : "Sem prazo"}</span>
                    <OwnershipContext brokerName={task.assigneeName} branchName={task.branchName} className="truncate text-xs" emptyLabel="Equipe" />
                  </div>
                </Link>
              ))}
            </div>
            <Table className="max-[559px]:hidden">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Tarefa</TableHead>
                  <TableHead>Agendamento</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead className="hidden md:table-cell">Responsável</TableHead>
                  <TableHead className="pr-5 text-right">Lead</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="pl-5">
                      <p className={task.completedAt ? "font-medium line-through text-muted-foreground" : "font-medium"}>{task.title}</p>
                      {task.description ? <p className="mt-1 max-w-lg truncate text-xs text-muted-foreground">{task.description}</p> : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{task.dueAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(task.dueAt) : "Sem prazo"}</TableCell>
                    <TableCell><Badge className={task.priority === "urgent" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-border"} variant="outline">{task.priority === "urgent" ? "Urgente" : task.priority === "low" ? "Baixa" : "Normal"}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell"><OwnershipContext brokerName={task.assigneeName} branchName={task.branchName} emptyLabel="Equipe" /></TableCell>
                    <TableCell className="pr-5 text-right"><Button render={<Link href={`/leads/${task.leadId}`} />} size="sm" variant="outline">{task.leadName}</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!tasks.length ? (
              <div className="flex flex-col items-center gap-2 border-t border-border px-6 py-12 text-center">
                <span className="grid size-10 place-items-center rounded-full border border-primary/15 bg-primary/[0.06] text-primary" aria-hidden="true"><ListChecks className="size-5" /></span>
                <p className="font-medium">Nenhuma tarefa no seu escopo</p>
                <p className="max-w-md text-sm leading-6 text-muted-foreground">Abra um lead para criar o próximo passo e atribuí-lo à equipe.</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
