"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

import { ArrowRight, UserList } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { UserAvatar } from "@/components/ui/user-avatar";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { OwnershipContext } from "@/components/ownership-context";
import { LeadStatusBadge, LeadQualificationBadge } from "@/components/status-badges";
import { LeadHealthBadge, computeLeadHealth } from "@/features/leads/components/lead-health-badge";
import { maskPhone, maskName } from "@/features/quotes/utils";
import { QualifyingLeadActions } from "./_components/qualifying-lead-actions";
import type { LeadWorkspaceItem, QualifyingLeadItem } from "./leads-workspace";

type LeadsDataTableProps = {
  leads: LeadWorkspaceItem[];
  contextRole: string;
  shouldMask: (lead: LeadWorkspaceItem) => boolean;
  slaFirstContactMinutes: number;
  slaStagnantDays: number;
  pageSize?: number;
  selectedIds: string[];
  isAllSelected: boolean;
  onToggleRow: (id: string) => void;
  onSelectAll: (checked: boolean) => void;
  onRowClick: (lead: LeadWorkspaceItem) => void;
};

export function LeadsDataTable({
  leads,
  contextRole,
  shouldMask,
  slaFirstContactMinutes,
  slaStagnantDays,
  pageSize = 10,
  selectedIds,
  isAllSelected,
  onToggleRow,
  onSelectAll,
  onRowClick,
}: LeadsDataTableProps) {
  const columns = useMemo<ColumnDef<LeadWorkspaceItem>[]>(() => {
    const base: ColumnDef<LeadWorkspaceItem>[] = [
      {
        id: "select",
        header: () => (
          <Checkbox
            aria-label="Selecionar todos"
            checked={isAllSelected}
            onCheckedChange={(value) => onSelectAll(Boolean(value))}
          />
        ),
        cell: ({ row }) => (
          <div onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
            <Checkbox
              aria-label={`Selecionar ${row.original.nome}`}
              checked={selectedIds.includes(row.original.id)}
              onCheckedChange={() => onToggleRow(row.original.id)}
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "nome",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Lead" />,
        cell: ({ row }) => {
          const lead = row.original;
          return (
            <div className="flex items-center gap-3 pl-2">
              <UserAvatar seed={lead.nome} name={lead.nome} size="sm" className="size-8 shrink-0" />
              <div className="min-w-0">
                <p className={`truncate text-xs font-semibold leading-snug text-foreground ${shouldMask(lead) ? "blur-[3px] select-none" : ""}`}>
                  {shouldMask(lead) ? maskName(lead.nome) : lead.nome}
                </p>
                <p className={`mt-0.5 truncate font-mono text-xs text-muted-foreground ${shouldMask(lead) ? "blur-[3px] select-none" : ""}`}>
                  {shouldMask(lead)
                    ? "••••-••••"
                    : contextRole === "broker" && lead.status === "distributed"
                      ? maskPhone(lead.telefone)
                      : lead.telefone}
                </p>
                {lead.sourceCampaign ? (
                  <Badge variant="secondary" className="mt-1 max-w-[200px] truncate border-primary/20 bg-primary/10 text-[10px] text-primary">
                    🎯 {lead.sourceCampaign}
                  </Badge>
                ) : null}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "tipo",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" />,
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
              row.original.tipo === "PME"
                ? "bg-indigo-400/10 text-indigo-400 ring-indigo-400/20"
                : "bg-sky-400/10 text-sky-400 ring-sky-400/20"
            }`}
          >
            {row.original.tipo}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => <LeadStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "qualificationStatus",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Qualificação" />,
        cell: ({ row }) => <LeadQualificationBadge status={row.original.qualificationStatus} />,
      },
      {
        accessorKey: "health",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Saúde" />,
        cell: ({ row }) => (
          <LeadHealthBadge health={computeLeadHealth(row.original, slaFirstContactMinutes, slaStagnantDays)} />
        ),
        enableSorting: false,
      },
      {
        accessorKey: "corretorNome",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Responsável / Filial" />,
        cell: ({ row }) => (
          <OwnershipContext
            brokerName={row.original.corretorNome}
            branchName={row.original.branchName}
            className="text-xs text-muted-foreground"
          />
        ),
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Entrada" />,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {new Intl.DateTimeFormat("pt-BR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            }).format(new Date(row.original.createdAt))}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Ações</span>,
        cell: ({ row }) => (
          <div onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
            <div className="text-right pr-2">
              <Button
                render={<Link href={`/leads/${row.original.id}`} />}
                size="sm"
                variant="ghost"
                className="h-8 gap-1 text-xs opacity-80 transition-all group-hover/row:opacity-100"
              >
                Abrir <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
    ];

    return contextRole === "broker"
      ? base.filter((column) => !("accessorKey" in column) || column.accessorKey !== "tipo")
      : base;
  }, [selectedIds, isAllSelected, contextRole, shouldMask, slaFirstContactMinutes, slaStagnantDays, onToggleRow, onSelectAll]);

  return (
    <DataTable
      columns={columns}
      data={leads}
      searchKey="nome"
      searchPlaceholder="Buscar lead por nome..."
      showColumnToggle={true}
      showPagination={true}
      pageSize={pageSize}
      getRowClassName={(lead) => (selectedIds.includes(lead.id) ? "bg-muted/40" : undefined)}
      onRowClick={onRowClick}
      emptyState={
        <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/8 ring-1 ring-primary/15">
            <UserList className="size-6 text-primary" />
          </div>
          <div className="max-w-sm space-y-1.5">
            <p className="text-sm font-semibold text-foreground">Nenhum lead qualificado ou distribuído ainda</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Os leads aparecerão aqui depois de qualificados ou distribuídos para atendimento.
            </p>
          </div>
        </div>
      }
    />
  );
}

type QualifyingLeadsDataTableProps = {
  leads: QualifyingLeadItem[];
  queues: Array<{ id: string; name: string; branchId: string | null }>;
  pageSize?: number;
  onOpen: (lead: QualifyingLeadItem) => void;
};

export function QualifyingLeadsDataTable({
  leads,
  queues,
  pageSize = 10,
  onOpen,
}: QualifyingLeadsDataTableProps) {
  const columns = useMemo<ColumnDef<QualifyingLeadItem>[]>(() => {
    const base: ColumnDef<QualifyingLeadItem>[] = [
      {
        accessorKey: "nome",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Lead" />,
        cell: ({ row }) => {
          const lead = row.original;
          return (
            <div className="flex items-center gap-3 pl-2">
              <UserAvatar seed={lead.nome} name={lead.nome} size="sm" className="size-8 shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold leading-snug text-foreground">{lead.nome}</p>
                <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{lead.telefone}</p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "origem",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Origem / Canal" />,
        cell: ({ row }) => {
          const lead = row.original;
          return (
            <div className="min-w-0">
              <Badge variant="secondary" className="text-[10px]">
                {lead.sourceChannel === "bulk_import" ? "Importação CSV" : lead.origem}
              </Badge>
              {lead.sourceCampaign ? (
                <p className="mt-0.5 max-w-36 truncate text-[11px] text-muted-foreground">{lead.sourceCampaign}</p>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "queueName",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Fila de Destino" />,
        cell: ({ row }) => (
          <Badge variant="outline" className="font-mono text-xs">
            {row.original.queueName ?? "Geral da unidade"}
          </Badge>
        ),
      },
      {
        accessorKey: "qualificationScore",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Qualificação IA" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <LeadQualificationBadge status={row.original.qualificationStatus} />
            <span className="text-xs font-semibold text-foreground">{row.original.qualificationScore} pts</span>
          </div>
        ),
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Entrada" />,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {new Intl.DateTimeFormat("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(row.original.createdAt))}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Ações de Controle</span>,
        cell: ({ row }) => {
          const lead = row.original;
          return (
            <div onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
              <QualifyingLeadActions
                leadId={lead.id}
                leadName={lead.nome}
                currentQueueId={lead.queueId ?? null}
                currentQueueName={lead.queueName ?? null}
                queues={queues}
                onOpenDetails={() => onOpen(lead)}
              />
            </div>
          );
        },
        enableSorting: false,
        enableHiding: false,
      },
    ];

    return base;
  }, [queues, onOpen]);

  return (
    <DataTable
      columns={columns}
      data={leads}
      searchKey="nome"
      searchPlaceholder="Buscar lead em qualificação..."
      showColumnToggle={true}
      showPagination={true}
      pageSize={pageSize}
      emptyState={
        <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/8 ring-1 ring-primary/15">
            <UserList className="size-6 text-primary" />
          </div>
          <div className="max-w-sm space-y-1.5">
            <p className="text-sm font-semibold text-foreground">Nenhum lead em qualificação no momento</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Os contatos recebidos via webhook, WhatsApp ou CSV com qualificação ativa aparecerão aqui.
            </p>
          </div>
        </div>
      }
    />
  );
}