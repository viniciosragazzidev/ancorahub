"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RiSearchLine } from "@remixicon/react";
import { Focusable } from "react-aria-components";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ColumnDef, PaginationState, SortingState } from "@tanstack/react-table";

import { Avatar } from "@/components/base/avatar/avatar";
import { Chip } from "@/components/base/badges/chip";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { InputBase } from "@/components/base/input/input";
import { Pagination } from "@/components/base/pagination/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@/components/base/table/table";
import type { TableSize } from "@/components/base/table/table";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { ChevronSortDown } from "@/components/foundations/icons/chevrons";
import { cx } from "@/utils/cx";

import { ArrowRight, UserList } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OwnershipContext } from "@/components/ownership-context";
import { LeadStatusBadge, LeadQualificationBadge } from "@/components/status-badges";
import { LeadHealthBadge, computeLeadHealth } from "@/features/leads/components/lead-health-badge";
import { maskPhone, maskName } from "@/features/quotes/utils";
import { QualifyingLeadActions } from "./_components/qualifying-lead-actions";
import { LeadsPagination } from "./_components/leads-pagination";
import type { LeadWorkspaceItem, QualifyingLeadItem } from "./leads-workspace";

/* --- Sort chevron --- */
function SortChevron({ dir }: { dir: false | "asc" | "desc" }) {
  return (
    <ChevronSortDown
      className={cx(
        "size-4 shrink-0 transition-[transform,color] duration-150",
        dir === "asc" && "rotate-180",
        dir ? "text-text-secondary" : "text-text-tertiary",
      )}
    />
  );
}

/* --- Tooltip-wrapped link button for row actions --- */
function RowActionLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <TooltipTrigger delay={200}>
      <Focusable>
        <Button
          render={<Link href={href} />}
          size="sm"
          variant="ghost"
          className="h-8 gap-1 text-xs opacity-80 transition-all group-hover/row:opacity-100"
          aria-label={label}
        >
          {children}
        </Button>
      </Focusable>
      <Tooltip size="md">{label}</Tooltip>
    </TooltipTrigger>
  );
}

/* ======================================================================
 * LeadsDataTable - boardui-style data table for qualified & distributed leads
 * ====================================================================== */

type LeadsDataTableProps = {
  leads: LeadWorkspaceItem[];
  contextRole: string;
  shouldMask: (lead: LeadWorkspaceItem) => boolean;
  slaFirstContactMinutes: number;
  slaStagnantDays: number;
  pageSize?: number;
  pagination?: {
    currentPage: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
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
  pagination: serverPagination,
  selectedIds,
  isAllSelected,
  onToggleRow,
  onSelectAll,
  onRowClick,
}: LeadsDataTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [localPagination, setLocalPagination] = useState<PaginationState>({ pageIndex: 0, pageSize });
  const [query, setQuery] = useState("");
  const [size] = useState<TableSize>("md");

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) =>
        l.nome.toLowerCase().includes(q) ||
        l.telefone.includes(q),
    );
  }, [leads, query]);

  const columns = useMemo<ColumnDef<LeadWorkspaceItem>[]>(
    () => [
      {
        id: "select",
        enableSorting: false,
        enableHiding: false,
        header: () => (
          <Checkbox
            slot={null}
            aria-label="Selecionar todos"
            isSelected={isAllSelected}
            onChange={(v: boolean | null) => onSelectAll(Boolean(v))}
          />
        ),
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
            <Checkbox
              slot={null}
              aria-label={`Selecionar ${row.original.nome}`}
              isSelected={selectedIds.includes(row.original.id)}
              onChange={() => onToggleRow(row.original.id)}
            />
          </div>
        ),
      },
      {
        accessorKey: "nome",
        header: "Lead",
        cell: ({ row }) => {
          const lead = row.original;
          return (
            <div className="flex min-w-0 items-center gap-2">
              <Avatar
                size="sm"
                color="neutral"
                initials={lead.nome.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase()}
              />
              <div className="min-w-0">
                <p
                  className={cx(
                    "truncate text-body-medium text-text-primary font-medium",
                    shouldMask(lead) && "blur-[3px] select-none",
                  )}
                >
                  {shouldMask(lead) ? maskName(lead.nome) : lead.nome}
                </p>
                <p
                  className={cx(
                    "mt-0.5 truncate font-mono text-caption-1-medium text-text-tertiary",
                    shouldMask(lead) && "blur-[3px] select-none",
                  )}
                >
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
      ...(contextRole !== "broker"
        ? [
            {
              accessorKey: "tipo" as const,
              header: "Tipo",
              cell: ({ row }: { row: import("@tanstack/react-table").Row<LeadWorkspaceItem> }) => (
                <Chip
                  variant="caption"
                  color={row.original.tipo === "PME" ? "blue" : "cyan"}
                >
                  {row.original.tipo}
                </Chip>
              ),
            },
          ]
        : []),
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const s = row.original.status;
          const statusColorMap: Record<string, "lime" | "yellow" | "rose" | "cyan" | "blue" | "purple"> = {
            new: "cyan",
            distributed: "blue",
            in_contact: "purple",
            quote_sent: "yellow",
            negotiation: "yellow",
            documentation_pending: "rose",
            under_analysis: "cyan",
            converted: "lime",
            lost: "rose",
          };
          return (
            <Chip variant={size === "sm" ? "caption" : "bold"} color={statusColorMap[s] ?? "gray"}>
              <LeadStatusBadge status={s} />
            </Chip>
          );
        },
      },
      {
        accessorKey: "qualificationStatus",
        header: "Qualificação",
        cell: ({ row }) => <LeadQualificationBadge status={row.original.qualificationStatus} />,
      },
      {
        accessorKey: "health",
        header: "Saúde",
        enableSorting: false,
        cell: ({ row }) => (
          <LeadHealthBadge health={computeLeadHealth(row.original, slaFirstContactMinutes, slaStagnantDays)} />
        ),
      },
      {
        accessorKey: "corretorNome",
        header: "Responsável / Filial",
        cell: ({ row }) => (
          <OwnershipContext
            brokerName={row.original.corretorNome}
            branchName={row.original.branchName}
            className="text-body-medium text-text-secondary"
          />
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Entrada",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-body-medium text-text-primary">
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
        enableSorting: false,
        enableHiding: false,
        header: "Ações",
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-end">
              <RowActionLink href={`/leads/${row.original.id}`} label="Abrir lead">
                Abrir <ArrowRight className="size-3.5" />
              </RowActionLink>
            </div>
          </div>
        ),
      },
    ],
    [selectedIds, isAllSelected, contextRole, shouldMask, slaFirstContactMinutes, slaStagnantDays, size, onToggleRow, onSelectAll],
  );

  const table = useReactTable({
    data,
    columns,
    getRowId: (row) => row.id,
    state: {
      sorting,
      pagination: serverPagination
        ? { pageIndex: serverPagination.currentPage - 1, pageSize: serverPagination.pageSize }
        : localPagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: serverPagination ? undefined : setLocalPagination,
    manualPagination: Boolean(serverPagination),
    pageCount: serverPagination?.totalPages,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const resetPage = () => {
    if (!serverPagination) table.setPageIndex(0);
  };
  const headers = table.getHeaderGroups()[0].headers;
  const rows = table.getRowModel().rows;
  const [isPending, startTransition] = useTransition();

  const totalPages = serverPagination?.totalPages ?? table.getPageCount();

  function goToServerPage(page: number) {
    if (!serverPagination || page < 1 || page > serverPagination.totalPages || page === serverPagination.currentPage) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  if (leads.length === 0) {
    return (
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
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <section
        className={cx(
          "flex w-full flex-col rounded-2xl border border-border-table pt-2",
          totalPages > 1 ? "pb-3" : "pb-0",
        )}
      >
        {/* Toolbar */}
        <div className="flex w-full flex-col items-start gap-3 px-3 py-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col justify-center">
            <p className="text-body-medium whitespace-nowrap text-text-tertiary">Total Results</p>
            <p className="text-body-medium whitespace-nowrap text-text-primary">
              {(serverPagination?.totalItems ?? data.length).toLocaleString()} lead{(serverPagination?.totalItems ?? data.length) !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="-mx-3 flex w-[calc(100%+1.5rem)] items-center gap-2.5 overflow-x-auto px-3 sm:mx-0 sm:w-auto sm:flex-wrap sm:justify-end sm:overflow-visible sm:px-0">
            <InputBase
              aria-label="Buscar lead"
              placeholder="Buscar por nome ou telefone..."
              leadingIcon={RiSearchLine}
              value={query}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setQuery(e.target.value);
                resetPage();
              }}
              fieldClassName="min-w-[153px] flex-1 rounded-full bg-background-secondary-default sm:w-[200px] sm:min-w-0 sm:flex-none"
              className="text-body-medium"
            />
          </div>
        </div>

        {/* Table */}
        <div className="mt-2">
          <Table aria-label="Leads qualificados e distribuídos" size={size} selectionMode="none" className="min-w-[900px]">
            <TableHeader>
              {headers.map((header) => {
                const id = header.column.id;
                const canSort = header.column.getCanSort();
                const label = flexRender(header.column.columnDef.header, header.getContext());
                return (
                  <TableColumn key={header.id} id={header.id} isRowHeader={id === "nome"}>
                    {canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex cursor-pointer items-center gap-0.5"
                      >
                        {label}
                        <SortChevron dir={header.column.getIsSorted()} />
                      </button>
                    ) : (
                      label
                    )}
                  </TableColumn>
                );
              })}
            </TableHeader>
            <TableBody
              renderEmptyState={() => (
                <div className="flex h-40 items-center justify-center text-body-medium text-text-tertiary">
                  Nenhum lead encontrado.
                </div>
              )}
            >
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  id={row.id}
                  className="cursor-pointer hover:bg-muted/40 transition-colors"
                  style={
                    selectedIds.includes(row.original.id)
                      ? { backgroundColor: "var(--color-background-secondary-default)" }
                      : undefined
                  }
                  onAction={() => onRowClick(row.original)}
                  onClick={() => onRowClick(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      onClick={() => {
                        if (cell.column.id !== "select" && cell.column.id !== "actions") {
                          onRowClick(row.original);
                        }
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <LeadsPagination
          currentPage={serverPagination?.currentPage ?? localPagination.pageIndex + 1}
          totalPages={totalPages}
          totalItems={serverPagination?.totalItems ?? data.length}
          pageSize={serverPagination?.pageSize ?? localPagination.pageSize}
          onPageChange={(p) => {
            if (serverPagination) goToServerPage(p);
            else table.setPageIndex(p - 1);
          }}
          onPageSizeChange={(newSize) => {
            if (serverPagination) {
              const params = new URLSearchParams(searchParams.toString());
              params.set("pageSize", String(newSize));
              params.set("page", "1");
              startTransition(() => {
                router.push(`${pathname}?${params.toString()}`);
              });
            } else {
              table.setPageSize(newSize);
              setLocalPagination({ pageIndex: 0, pageSize: newSize });
            }
          }}
        />
      </section>
    </div>
  );
}

/* ======================================================================
 * QualifyingLeadsDataTable - boardui-style table for AI-qualifying leads
 * ====================================================================== */

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
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize });
  const [query, setQuery] = useState("");
  const [size] = useState<TableSize>("md");

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) =>
        l.nome.toLowerCase().includes(q) ||
        l.telefone.includes(q),
    );
  }, [leads, query]);

  const columns = useMemo<ColumnDef<QualifyingLeadItem>[]>(
    () => [
      {
        accessorKey: "nome",
        header: "Lead",
        cell: ({ row }) => {
          const lead = row.original;
          return (
            <div className="flex min-w-0 items-center gap-2">
              <Avatar
                size="sm"
                color="neutral"
                initials={lead.nome.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase()}
              />
              <div className="min-w-0">
                <p className="truncate text-body-medium text-text-primary font-medium">{lead.nome}</p>
                <p className="mt-0.5 truncate font-mono text-caption-1-medium text-text-tertiary">{lead.telefone}</p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "origem",
        header: "Origem / Canal",
        cell: ({ row }) => {
          const lead = row.original;
          return (
            <div className="min-w-0">
              <Chip variant="caption" color="gray">
                {lead.sourceChannel === "bulk_import" ? "Importação CSV" : lead.origem}
              </Chip>
              {lead.sourceCampaign ? (
                <p className="mt-0.5 max-w-36 truncate text-caption-1-medium text-text-tertiary">{lead.sourceCampaign}</p>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "queueName",
        header: "Fila de Destino",
        cell: ({ row }) => (
          <Chip variant="subtle" color="blue" className="font-mono">
            {row.original.queueName ?? "Geral da unidade"}
          </Chip>
        ),
      },
      {
        accessorKey: "qualificationScore",
        header: "Qualificação IA",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <LeadQualificationBadge status={row.original.qualificationStatus} />
            <span className="text-body-medium font-semibold text-text-primary">{row.original.qualificationScore} pts</span>
          </div>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Entrada",
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-mono text-caption-1-medium text-text-tertiary">
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
        enableSorting: false,
        enableHiding: false,
        header: "Ações",
        cell: ({ row }) => {
          const lead = row.original;
          return (
            <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
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
      },
    ],
    [queues, onOpen],
  );

  const table = useReactTable({
    data,
    columns,
    getRowId: (row) => row.id,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const resetPage = () => table.setPageIndex(0);
  const headers = table.getHeaderGroups()[0].headers;
  const rows = table.getRowModel().rows;
  const totalPages = table.getPageCount();

  if (leads.length === 0) {
    return (
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
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <section
        className={cx(
          "flex w-full flex-col rounded-2xl border border-border-table pt-2",
          totalPages > 1 ? "pb-3" : "pb-0",
        )}
      >
        {/* Toolbar */}
        <div className="flex w-full flex-col items-start gap-3 px-3 py-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col justify-center">
            <p className="text-body-medium whitespace-nowrap text-text-tertiary">Total Results</p>
            <p className="text-body-medium whitespace-nowrap text-text-primary">
              {data.length.toLocaleString()} lead{data.length !== 1 ? "s" : ""} em qualificação
            </p>
          </div>
          <div className="-mx-3 flex w-[calc(100%+1.5rem)] items-center gap-2.5 overflow-x-auto px-3 sm:mx-0 sm:w-auto sm:flex-wrap sm:justify-end sm:overflow-visible sm:px-0">
            <InputBase
              aria-label="Buscar lead em qualificação"
              placeholder="Buscar por nome ou telefone..."
              leadingIcon={RiSearchLine}
              value={query}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setQuery(e.target.value);
                resetPage();
              }}
              fieldClassName="min-w-[153px] flex-1 rounded-full bg-background-secondary-default sm:w-[200px] sm:min-w-0 sm:flex-none"
              className="text-body-medium"
            />
          </div>
        </div>

        {/* Table */}
        <div className="mt-2">
          <Table aria-label="Leads em qualificação por IA" size={size} selectionMode="none" className="min-w-[800px]">
            <TableHeader>
              {headers.map((header) => {
                const id = header.column.id;
                const canSort = header.column.getCanSort();
                const label = flexRender(header.column.columnDef.header, header.getContext());
                return (
                  <TableColumn key={header.id} id={header.id} isRowHeader={id === "nome"}>
                    {canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex cursor-pointer items-center gap-0.5"
                      >
                        {label}
                        <SortChevron dir={header.column.getIsSorted()} />
                      </button>
                    ) : (
                      label
                    )}
                  </TableColumn>
                );
              })}
            </TableHeader>
            <TableBody
              renderEmptyState={() => (
                <div className="flex h-40 items-center justify-center text-body-medium text-text-tertiary">
                  Nenhum lead encontrado.
                </div>
              )}
            >
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  id={row.id}
                  className="cursor-pointer"
                  onClick={() => onOpen(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <LeadsPagination
          currentPage={pagination.pageIndex + 1}
          totalPages={totalPages}
          totalItems={data.length}
          pageSize={pagination.pageSize}
          onPageChange={(p) => table.setPageIndex(p - 1)}
          onPageSizeChange={(newSize) => {
            table.setPageSize(newSize);
            setPagination({ pageIndex: 0, pageSize: newSize });
          }}
        />
      </section>
    </div>
  );
}
