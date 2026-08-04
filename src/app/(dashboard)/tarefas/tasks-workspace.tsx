"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight } from "lucide-react";

import { ListChecks } from "@/components/huge-icons";
import { OwnershipContext } from "@/components/ownership-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";

type TaskRow = {
  id: string;
  leadId: string;
  leadName: string;
  title: string;
  description: string | null;
  priority: string;
  dueAt: string | null;
  completedAt: string | null;
  assigneeName: string | null;
  branchName: string | null;
};

function formatDue(dueAt: string | null) {
  if (!dueAt) return "Sem prazo";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(dueAt));
}

export function TasksWorkspace({ tasks }: { tasks: TaskRow[] }) {
  const columns: ColumnDef<TaskRow>[] = [
    {
      accessorKey: "title",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Tarefa" />,
      cell: ({ row }) => {
        const task = row.original;
        return (
          <div>
            <p
              className={cn(
                "text-xs font-semibold text-foreground leading-snug",
                task.completedAt && "text-muted-foreground line-through",
              )}
            >
              {task.title}
            </p>
            {task.description && (
              <p className="mt-0.5 max-w-lg truncate text-xs text-muted-foreground">{task.description}</p>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "dueAt",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Agendamento" />,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{formatDue(row.original.dueAt)}</span>
      ),
    },
    {
      accessorKey: "priority",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Prioridade" />,
      cell: ({ row }) => {
        const priority = row.original.priority;
        return (
          <Badge
            className={
              priority === "urgent"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-border"
            }
            variant="outline"
          >
            {priority === "urgent" ? "Urgente" : priority === "low" ? "Baixa" : "Normal"}
          </Badge>
        );
      },
    },
    {
      accessorKey: "assigneeName",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Responsável" />,
      cell: ({ row }) => (
        <OwnershipContext
          brokerName={row.original.assigneeName}
          branchName={row.original.branchName}
          emptyLabel="Equipe"
          className="text-xs"
        />
      ),
    },
    {
      accessorKey: "leadName",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Lead" />,
      cell: ({ row }) => (
        <div className="text-right">
          <Button
            size="sm"
            variant="ghost"
            render={<Link href={`/leads/${row.original.leadId}`} />}
            aria-label={`Abrir lead ${row.original.leadName}`}
            className="h-8 gap-1 text-xs"
          >
            {row.original.leadName} <ArrowRight className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={tasks}
      searchPlaceholder="Buscar por tarefa, lead ou responsável..."
      showColumnToggle={true}
      showPagination={true}
      pageSize={10}
      emptyState={
        tasks.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span
              className="grid size-10 place-items-center rounded-full border border-primary/15 bg-primary/[0.06] text-primary"
              aria-hidden="true"
            >
              <ListChecks className="size-5" />
            </span>
            <div className="max-w-sm space-y-1.5">
              <p className="text-sm font-semibold text-foreground">Nenhuma tarefa no seu escopo</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Abra um lead para criar o próximo passo e atribuí-lo à equipe.
              </p>
            </div>
          </div>
        ) : undefined
      }
    />
  );
}
