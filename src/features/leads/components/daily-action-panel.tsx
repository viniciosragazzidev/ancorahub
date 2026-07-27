"use client";

import Link from "next/link";

import { ArrowRight, Clock, ListChecks, Phone, WhatsappLogo } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Task = {
  id: string;
  title: string;
  description?: string | null;
  priority: "low" | "normal" | "urgent";
  dueAt: string | null;
  completedAt: string | null;
  leadId?: string | null;
  leadName?: string | null;
};

type Quote = {
  id: string;
  leadName: string;
  totalMonthly: number | null;
  status: string;
};

type DailyActionPanelProps = {
  overdueTasks: Task[];
  todayTasks: Task[];
  pendingQuotes: Quote[];
  recentLeads: Array<{ id: string; nome: string; status: string; createdAt: string }>;
  phone?: string | null;
};

export function DailyActionPanel({
  overdueTasks,
  todayTasks,
  pendingQuotes,
  recentLeads,
  phone,
}: DailyActionPanelProps) {
  const totalPending = overdueTasks.length + todayTasks.length + pendingQuotes.length;

  return (
    <div className="space-y-4">
      {/* Quick summary */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ListChecks className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Painel do dia</h3>
          <p className="text-xs text-muted-foreground">
            {totalPending === 0
              ? "Nenhuma pendência para hoje!"
              : `${totalPending} pendência(s) para hoje`}
          </p>
        </div>
      </div>

      {/* Overdue tasks */}
      {overdueTasks.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-destructive">
            Tarefas atrasadas ({overdueTasks.length})
          </h4>
          {overdueTasks.map((task) => (
            <Link
              key={task.id}
              href={task.leadId ? `/leads/${task.leadId}` : "/tarefas"}
              className="flex items-center justify-between rounded-md border border-destructive/20 bg-destructive/5 px-2.5 py-2 text-xs transition-colors hover:bg-destructive/10"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{task.title}</p>
                {task.leadName && (
                  <p className="text-[10px] text-muted-foreground truncate">{task.leadName}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge variant="destructive" className="text-[10px] py-0">
                  <Clock className="mr-1 size-2.5" />
                  {task.dueAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(task.dueAt)) : ""}
                </Badge>
                <ArrowRight className="size-3 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Today's tasks */}
      {todayTasks.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Tarefas de hoje ({todayTasks.length})
          </h4>
          {todayTasks.map((task) => (
            <Link
              key={task.id}
              href={task.leadId ? `/leads/${task.leadId}` : "/tarefas"}
              className="flex items-center justify-between rounded-md border border-border/40 px-2.5 py-2 text-xs transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{task.title}</p>
                {task.leadName && (
                  <p className="text-[10px] text-muted-foreground truncate">{task.leadName}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {task.priority === "urgent" && (
                  <Badge variant="destructive" className="text-[10px] py-0">Urgente</Badge>
                )}
                <ArrowRight className="size-3 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pending quotes */}
      {pendingQuotes.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Cotações pendentes ({pendingQuotes.length})
          </h4>
          {pendingQuotes.map((quote) => (
            <div
              key={quote.id}
              className="flex items-center justify-between rounded-md border border-border/40 px-2.5 py-2 text-xs"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{quote.leadName}</p>
                {quote.totalMonthly && (
                  <p className="text-[10px] text-primary font-medium">
                    R$ {quote.totalMonthly.toFixed(2)}/mês
                  </p>
                )}
              </div>
              <Badge variant="outline" className="text-[10px] py-0 shrink-0">
                {quote.status === "draft" ? "Rascunho" : quote.status}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Recent leads */}
      {recentLeads.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Leads recentes
          </h4>
          {recentLeads.map((lead) => (
            <Link
              key={lead.id}
              href={`/leads/${lead.id}`}
              className="flex items-center justify-between rounded-md border border-border/40 px-2.5 py-2 text-xs transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{lead.nome}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(lead.createdAt))}
                </p>
              </div>
              <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-border/40">
        {phone && (
          <Button className="h-7 px-2 text-[10px]" size="sm" variant="outline" render={<a href={`tel:${phone.replace(/\D/g, "")}`} />}>
            <Phone /> Ligar
          </Button>
        )}
        {phone && (
          <Button className="h-7 px-2 text-[10px]" size="sm" variant="outline" render={<a href={`https://wa.me/${phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" />}>
            <WhatsappLogo /> WhatsApp
          </Button>
        )}
        <Button className="h-7 px-2 text-[10px]" size="sm" variant="outline" render={<Link href="/leads?new=1" />}>
          Novo lead
        </Button>
        <Button className="h-7 px-2 text-[10px]" size="sm" variant="outline" render={<Link href="/tarefas" />}>
          <ListChecks /> Tarefas
        </Button>
      </div>
    </div>
  );
}
