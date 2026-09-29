"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { DotsThreeVertical, PencilSimple, Trash } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QueueColorDot } from "@/features/lead-distribution/queue-color-tag";
import { assignmentLabel, queueDutyScheduleIds, type DutySchedule, type Queue } from "./types";

type Row = Queue & { entries: { campaigns: number; ads: number } };

function entriesLabel({ campaigns, ads }: Row["entries"]) {
  if (!campaigns && !ads) return "Fila geral";
  return [
    campaigns ? `${campaigns} campanha${campaigns === 1 ? "" : "s"}` : null,
    ads ? `${ads} anúncio${ads === 1 ? "" : "s"}` : null,
  ].filter(Boolean).join(" · ");
}

const numberCell = (value: number) => <span className="tabular-nums">{value}</span>;

/** Every queue in one table (the /equipe table); a row opens the queue drawer. */
export function QueuesTable({
  queues,
  dutySchedules,
  entriesByQueue,
  canEdit,
  onOpen,
  onEdit,
  onDelete,
}: {
  queues: Queue[];
  dutySchedules: DutySchedule[];
  entriesByQueue: Map<string, Row["entries"]>;
  canEdit: boolean;
  onOpen: (queue: Queue) => void;
  onEdit: (queue: Queue) => void;
  onDelete: (queue: Queue) => void;
}) {
  const rows = useMemo<Row[]>(
    () => queues.map((queue) => ({ ...queue, entries: entriesByQueue.get(queue.id) ?? { campaigns: 0, ads: 0 } })),
    [queues, entriesByQueue],
  );
  const dutyName = useMemo(() => new Map(dutySchedules.map((duty) => [duty.id, duty.name])), [dutySchedules]);

  const columns = useMemo<ColumnDef<Row>[]>(() => [
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Fila" />,
      cell: ({ row }) => (
        <button
          type="button"
          className="flex min-w-0 max-w-64 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(row.original);
          }}
        >
          <QueueColorDot hue={row.original.colorHue} />
          <span className="min-w-0">
            <span className="block truncate font-medium text-foreground">{row.original.name}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{row.original.branchName || "Todas as unidades"}</span>
          </span>
        </button>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => (
        <Badge variant={row.original.status === "active" ? "success" : "outline"}>
          {row.original.status === "active" ? "Ativa" : "Pausada"}
        </Badge>
      ),
    },
    {
      id: "assignment",
      header: "Distribuição",
      cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{assignmentLabel(row.original)}</span>,
    },
    { accessorKey: "waiting", header: ({ column }) => <DataTableColumnHeader column={column} title="Aguardando" />, cell: ({ row }) => numberCell(row.original.waiting) },
    { accessorKey: "members", header: ({ column }) => <DataTableColumnHeader column={column} title="Elegíveis" />, cell: ({ row }) => numberCell(row.original.members) },
    { accessorKey: "activeLeads", header: ({ column }) => <DataTableColumnHeader column={column} title="Em atendimento" />, cell: ({ row }) => numberCell(row.original.activeLeads) },
    {
      id: "entries",
      header: "Entradas",
      cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{entriesLabel(row.original.entries)}</span>,
    },
    {
      id: "duty",
      header: "Plantão",
      cell: ({ row }) => {
        const names = queueDutyScheduleIds(row.original).map((id) => dutyName.get(id)).filter(Boolean);
        return names.length ? (
          <span className="block max-w-44 truncate text-muted-foreground" title={names.join(", ")}>
            {names.slice(0, 2).join(", ")}{names.length > 2 ? ` +${names.length - 2}` : ""}
          </span>
        ) : <span className="text-muted-foreground">—</span>;
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Ações</span>,
      enableHiding: false,
      cell: ({ row }) => canEdit ? (
        <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button size="icon-sm" variant="ghost" aria-label={`Ações da fila ${row.original.name}`} />}
            >
              <DotsThreeVertical size={15} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onEdit(row.original)}>
                <PencilSimple className="size-3.5" /> Editar configuração
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(row.original)}>
                <Trash className="size-3.5" /> Excluir fila
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null,
    },
  ], [canEdit, dutyName, onDelete, onEdit, onOpen]);

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchKey="name"
      searchPlaceholder="Buscar fila..."
      showColumnToggle={false}
      pageSize={10}
      onRowClick={onOpen}
      getRowClassName={(queue) => (queue.status === "active" ? undefined : "opacity-70")}
    />
  );
}
