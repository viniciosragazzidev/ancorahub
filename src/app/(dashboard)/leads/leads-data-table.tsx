"use client";

import * as React from "react";
import { DataTable } from "@/components/data-table/data-table";
import { useDataTable } from "@/hooks/use-data-table";
import { getLeadsColumns } from "./leads-table-columns";
import type { LeadRow } from "./leads-table-config";
import type { LeadWorkspaceItem, QualifyingLeadItem } from "./leads-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface LeadsDataTableProps {
  leads: LeadWorkspaceItem[];
  contextRole?: string;
  shouldMask?: boolean | ((lead: LeadWorkspaceItem) => boolean);
  slaFirstContactMinutes?: number;
  slaStagnantDays?: number;
  pageSize?: number;
  pagination?: {
    currentPage?: number;
    pageSize?: number;
    totalItems?: number;
    totalPages?: number;
  };
  selectedIds?: any;
  isAllSelected?: boolean;
  onToggleRow?: any;
  onSelectAll?: any;
  onRowClick?: (lead: LeadWorkspaceItem) => void;
}

export function LeadsDataTable({
  leads,
  pagination,
  onRowClick,
}: LeadsDataTableProps) {
  const tableData: LeadRow[] = React.useMemo(() => {
    return leads.map((item) => ({
      id: item.id,
      name: item.nome,
      phone: item.telefone,
      email: null,
      status: item.status,
      source: item.origem,
      planType: item.tipo,
      lives: 1,
      city: item.branchName ?? null,
      state: null,
      assignedBrokerName: item.corretorNome ?? null,
      branchName: item.branchName ?? null,
      qualificationStatus: item.qualificationStatus ?? null,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.createdAt),
    }));
  }, [leads]);

  const columns = React.useMemo(
    () =>
      getLeadsColumns((row) => {
        const original = leads.find((l) => l.id === row.id);
        if (original && onRowClick) {
          onRowClick(original);
        }
      }),
    [leads, onRowClick]
  );

  const pageCount = pagination?.totalPages ?? 1;

  const { table, isPending } = useDataTable({
    data: tableData,
    columns,
    pageCount,
    meta: {
      onRowClick: (row: LeadRow) => {
        const original = leads.find((l) => l.id === row.id);
        if (original && onRowClick) {
          onRowClick(original);
        }
      },
    },
    initialState: {
      sorting: [{ id: "createdAt", desc: true }],
      columnPinning: { left: ["select", "name"], right: ["actions"] },
    },
    getRowId: (row) => row.id,
  });

  const selectedRows = table.getFilteredSelectedRowModel().rows;

  return (
    <DataTable
      table={table}
      isPending={isPending}
      containerClassName="bg-transparent shadow-none"
      actionBar={
        selectedRows.length > 0 ? (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 bg-card/95 backdrop-blur-md border border-border shadow-xl rounded-full animate-in fade-in slide-in-from-bottom-4">
            <Badge variant="default" className="text-xs px-2 py-0.5">
              {selectedRows.length} selecionado(s)
            </Badge>
            <div className="h-4 w-px bg-border" />
            <Button
              variant="outline"
              size="xs"
              className="text-xs"
              onClick={() => {
                alert(`Exportando ${selectedRows.length} lead(s)...`);
              }}
            >
              Exportar CSV
            </Button>
            <Button
              variant="ghost"
              size="xs"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => table.toggleAllRowsSelected(false)}
            >
              Desmarcar todos
            </Button>
          </div>
        ) : null
      }
    />
  );
}

export interface QualifyingLeadsDataTableProps {
  leads: QualifyingLeadItem[];
  queues?: any[];
  pageSize?: number;
  onOpen?: (lead: QualifyingLeadItem) => void;
}

export function QualifyingLeadsDataTable({
  leads,
  onOpen,
}: QualifyingLeadsDataTableProps) {
  const tableData: LeadRow[] = React.useMemo(() => {
    return leads.map((item) => ({
      id: item.id,
      name: item.nome,
      phone: item.telefone,
      email: item.email ?? null,
      status: item.status,
      source: item.origem,
      planType: item.tipo,
      lives: 1,
      city: item.branchName ?? null,
      state: null,
      assignedBrokerName: null,
      branchName: item.branchName ?? null,
      qualificationStatus: item.qualificationStatus,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.createdAt),
    }));
  }, [leads]);

  const columns = React.useMemo(
    () =>
      getLeadsColumns((row) => {
        const original = leads.find((l) => l.id === row.id);
        if (original && onOpen) {
          onOpen(original);
        }
      }),
    [leads, onOpen]
  );

  const { table, isPending } = useDataTable({
    data: tableData,
    columns,
    pageCount: 1,
    meta: {
      onRowClick: (row: LeadRow) => {
        const original = leads.find((l) => l.id === row.id);
        if (original && onOpen) {
          onOpen(original);
        }
      },
    },
    initialState: {
      sorting: [{ id: "createdAt", desc: true }],
    },
    getRowId: (row) => row.id,
  });

  return (
    <DataTable
      table={table}
      isPending={isPending}
      containerClassName="bg-transparent shadow-none"
    />
  );
}
