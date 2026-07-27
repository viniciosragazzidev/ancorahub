"use client";

import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle, UsersThree, XCircle } from "@/components/huge-icons";

import { MemberStatusBadge, RoleBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SelectionToolbar } from "@/components/ui/selection-toolbar";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useMultiSelect } from "@/hooks/use-multi-select";
import { bulkToggleTeamMemberStatusAction } from "./actions";
import { TeamMemberActions } from "./member-actions";

type BranchOption = { id: string; name: string };
type TeamMember = {
  id: string;
  userId: string | null;
  name: string | null;
  email: string;
  role: "director" | "manager" | "broker";
  jobTitle: string;
  status: "pending" | "active" | "disabled";
  branchId: string | null;
  branchName: string | null;
};

type Props = {
  members: TeamMember[];
  branches: BranchOption[];
  currentRole: "director" | "manager" | "broker";
  currentBranchId: string | null;
  currentUserId: string;
};

export function TeamMembersTable({ members, branches, currentRole, currentBranchId, currentUserId }: Props) {
  const [branchFilter, setBranchFilter] = useState("all");
  const memberIds = useMemo(() => members.map((m) => m.id), [members]);
  const multiSelect = useMultiSelect(memberIds);
  const clearSelection = multiSelect.clear;
  const [bulkState, bulkFormAction, bulkPending] = useActionState(
    bulkToggleTeamMemberStatusAction,
    {},
  );
  const [statusOverrides, setStatusOverrides] = useState<Record<string, TeamMember["status"]>>({});

  const handleStatusChange = useCallback((memberId: string, status: TeamMember["status"] | null) => {
    setStatusOverrides((current) => {
      const next = { ...current };
      if (status) next[memberId] = status;
      else delete next[memberId];
      return next;
    });
  }, []);

  const displayedMembers = useMemo(
    () => members.map((member) => ({ ...member, status: statusOverrides[member.id] ?? member.status })),
    [members, statusOverrides],
  );

  useEffect(() => {
    const serverStatusById = new Map(members.map((member) => [member.id, member.status]));
    setStatusOverrides((current) => {
      const next = { ...current };
      for (const [id, status] of Object.entries(current)) {
        if (serverStatusById.get(id) === status) delete next[id];
      }
      return next;
    });
  }, [members]);

  const visibleMembers = useMemo(
    () => branchFilter === "all" ? displayedMembers : displayedMembers.filter((member) => member.branchId === branchFilter),
    [branchFilter, displayedMembers],
  );

  // Bulk action feedback
  useEffect(() => {
    if (bulkState.success) {
      toast.success(bulkState.message ?? "Operação concluída.");
      clearSelection();
    }
    if (bulkState.error) {
      toast.error(bulkState.error);
    }
  }, [bulkState.success, bulkState.error, bulkState.message, clearSelection]);

  const activeCount = displayedMembers.filter((member) => member.status === "active").length;

  const columns: ColumnDef<TeamMember>[] = [
    {
      id: "select",
      header: () => (
        <div onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
          <Checkbox
            aria-label="Selecionar todos"
            checked={multiSelect.isAllSelected}
            onCheckedChange={multiSelect.selectAll}
          />
        </div>
      ),
      cell: ({ row }) => (
        <div onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
          <Checkbox
            aria-label={`Selecionar ${row.original.name ?? "membro"}`}
            checked={multiSelect.isSelected(row.original.id)}
            onCheckedChange={() => multiSelect.toggle(row.original.id)}
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Membro" />
      ),
      cell: ({ row }) => {
        const member = row.original;
        return (
          <div className="flex items-center gap-3 pl-2">
            <UserAvatar seed={member.email || member.name || "Membro"} name={member.name ?? undefined} size="sm" className="size-8" />
            <div>
              <p className="font-semibold text-xs text-foreground leading-snug">{member.name ?? "Sem nome"}</p>
              {member.userId === currentUserId ? <p className="text-[10px] text-muted-foreground font-mono">Você</p> : null}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "email",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="E-mail" />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.email}</span>
      ),
    },
    {
      accessorKey: "role",
      header: "Papel",
      cell: ({ row }) => <RoleBadge role={row.original.role} />,
    },
    {
      accessorKey: "branchName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Filial" />
      ),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.branchName ?? "Sem filial"}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <MemberStatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="text-right pr-2">
          <TeamMemberActions
            branches={branches}
            currentBranchId={currentBranchId}
            currentRole={currentRole}
            currentUserId={currentUserId}
            member={row.original}
            allMembers={members}
            onStatusChange={handleStatusChange}
          />
        </div>
      ),
    },
  ];

  return (
    <Card className="border-border bg-card shadow-xs">
      <CardHeader className="border-b border-border/50 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <UsersThree size={17} />
              Acessos vinculados
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {activeCount} acesso(s) ativo(s) · convites pendentes ficam sinalizados até o primeiro login.
            </CardDescription>
          </div>
          {currentRole === "director" ? (
            <Select value={branchFilter} onValueChange={(value) => setBranchFilter(value ?? "all")}>
              <SelectTrigger aria-label="Filtrar por unidade" className="w-full sm:w-52 h-9 text-xs">
                <SelectValue placeholder="Todas as unidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as unidades</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="px-4 pt-3 pb-0">
          <SelectionToolbar
            selectedCount={multiSelect.count}
            totalCount={visibleMembers.length}
            onClear={multiSelect.clear}
          >
            {(currentRole === "director" || currentRole === "manager") && (
              <form action={bulkFormAction} className="flex items-center gap-2">
                {multiSelect.selectedIds.map((id) => (
                  <input key={id} name="memberIds" type="hidden" value={id} />
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-emerald-500 hover:text-emerald-600 border-emerald-500/20"
                  disabled={bulkPending || multiSelect.count === 0}
                  name="targetStatus"
                  value="active"
                  type="submit"
                >
                  <CheckCircle className="size-4" />
                  Ativar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive border-destructive/20"
                  disabled={bulkPending || multiSelect.count === 0}
                  name="targetStatus"
                  value="disabled"
                  type="submit"
                >
                  <XCircle className="size-4" />
                  Desativar
                </Button>
              </form>
            )}
          </SelectionToolbar>
        </div>
        <DataTable
          columns={columns}
          data={visibleMembers}
          searchKey="name"
          searchPlaceholder="Buscar colaborador por nome ou email..."
          showColumnToggle={true}
          showPagination={true}
          pageSize={10}
          getRowClassName={(member) => member.status === "active" ? "bg-muted/15" : undefined}
        />
      </CardContent>
    </Card>
  );
}
