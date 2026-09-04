"use client";

import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "@/components/ui/sonner";
import { Search } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle, MagnifyingGlass, UsersThree, XCircle } from "@/components/huge-icons";

import { EmptyState } from "@/components/empty-state";
import { MemberStatusBadge, RoleBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SelectionToolbar } from "@/components/ui/selection-toolbar";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useMultiSelect } from "@/hooks/use-multi-select";
import { bulkToggleTeamMemberStatusAction } from "./actions";
import { TeamMemberActions } from "./member-actions";

import type { TenantRole } from "@/shared/db/schema";

type BranchOption = { id: string; name: string };
type TeamMember = {
  id: string;
  userId: string | null;
  name: string | null;
  email: string;
  role: TenantRole;
  jobTitle: string;
  status: "pending" | "active" | "disabled";
  branchId: string | null;
  branchName: string | null;
  customRoleScope: "none" | "own" | "branch" | "tenant" | null;
};

type Props = {
  members: TeamMember[];
  branches: BranchOption[];
  currentRole: TenantRole;
  currentBranchId: string | null;
  currentUserId: string;
  canViewProfile: boolean;
};

export function TeamMembersTable({ members, branches, currentRole, currentBranchId, currentUserId, canViewProfile }: Props) {
  const router = useRouter();
  const [branchFilter, setBranchFilter] = useState("all");
  const [mobileQuery, setMobileQuery] = useState("");
  const [mobilePage, setMobilePage] = useState(0);
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

  const mobileFilteredMembers = useMemo(() => {
    const query = mobileQuery.trim().toLowerCase();
    if (!query) return visibleMembers;
    return visibleMembers.filter(
      (member) =>
        (member.name ?? "").toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query),
    );
  }, [mobileQuery, visibleMembers]);

  const MOBILE_PAGE_SIZE = 10;
  const mobilePageCount = Math.max(1, Math.ceil(mobileFilteredMembers.length / MOBILE_PAGE_SIZE));
  const effectiveMobilePage = Math.min(mobilePage, mobilePageCount - 1);
  const mobilePageMembers = mobileFilteredMembers.slice(
    effectiveMobilePage * MOBILE_PAGE_SIZE,
    (effectiveMobilePage + 1) * MOBILE_PAGE_SIZE,
  );

  // Bulk action feedback
  useEffect(() => {
    if (bulkState.success) {
      toast.success(bulkState.message ?? "Operação concluída.");
      clearSelection();
      router.refresh();
    }
    if (bulkState.error) {
      toast.error(bulkState.error);
    }
  }, [bulkState, clearSelection, router]);

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
              {canViewProfile && member.userId ? <Link href={`/equipe/${member.userId}`} className="font-semibold text-xs leading-snug text-foreground hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{member.name ?? "Sem nome"}</Link> : <p className="font-semibold text-xs text-foreground leading-snug">{member.name ?? "Sem nome"}</p>}
              {member.userId === currentUserId ? <p className="text-xs text-muted-foreground font-mono mt-0.5">Você</p> : null}
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
      cell: ({ row }) => <RoleBadge role={row.original.role} jobTitle={row.original.jobTitle} />,
    },
    {
      accessorKey: "branchName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Filial" />
      ),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.branchId ? row.original.branchName ?? "Unidade vinculada" : "Geral da empresa"}</span>
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
    <Card className="border-transparent bg-transparent shadow-none">
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
        <div className="hidden sm:block">
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
        </div>

        <div className="sm:hidden">
          <div className="relative px-4 pt-3">
            <Search className="pointer-events-none absolute left-7 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Buscar colaborador"
              placeholder="Buscar colaborador por nome ou email..."
              value={mobileQuery}
              onChange={(event) => setMobileQuery(event.target.value)}
              className="h-9 rounded-xl border-border/70 bg-card pl-9 text-xs placeholder:font-mono placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-foreground"
            />
          </div>
          <div className="mt-2 divide-y divide-border">
            {mobilePageMembers.map((member) => (
              <div key={member.id} className="flex items-start justify-between gap-2.5 px-4 py-3.5">
                <div className="flex min-w-0 items-start gap-3">
                  <UserAvatar seed={member.email || member.name || "Membro"} name={member.name ?? undefined} size="sm" className="mt-0.5 size-9" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {canViewProfile && member.userId ? (
                        <Link href={`/equipe/${member.userId}`} className="truncate text-sm font-semibold leading-snug text-foreground hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{member.name ?? "Sem nome"}</Link>
                      ) : (
                        <p className="truncate text-sm font-semibold leading-snug text-foreground">{member.name ?? "Sem nome"}</p>
                      )}
                      {member.userId === currentUserId ? <span className="shrink-0 font-mono text-[11px] text-muted-foreground">Você</span> : null}
                    </div>
                    <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{member.email}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <RoleBadge role={member.role} jobTitle={member.jobTitle} />
                      <MemberStatusBadge status={member.status} />
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="truncate text-xs text-muted-foreground">{member.branchId ? member.branchName ?? "Unidade vinculada" : "Geral da empresa"}</span>
                    </div>
                  </div>
                </div>
                <TeamMemberActions
                  branches={branches}
                  currentBranchId={currentBranchId}
                  currentRole={currentRole}
                  currentUserId={currentUserId}
                  member={member}
                  allMembers={members}
                  onStatusChange={handleStatusChange}
                />
              </div>
            ))}
            {mobilePageMembers.length === 0 && (
              <EmptyState
                animated
                icon={MagnifyingGlass}
                title="Nenhum resultado encontrado."
                className="mx-3 mt-2 py-8"
              />
            )}
          </div>
          {mobileFilteredMembers.length > MOBILE_PAGE_SIZE && (
            <div className="flex items-center justify-between gap-2 border-t border-border/60 px-4 py-3 text-xs">
              <Button size="sm" variant="outline" disabled={effectiveMobilePage === 0} onClick={() => setMobilePage((page) => page - 1)}>
                Anterior
              </Button>
              <span className="font-mono text-xs font-medium text-muted-foreground">
                Página {effectiveMobilePage + 1} de {mobilePageCount}
              </span>
              <Button size="sm" variant="outline" disabled={effectiveMobilePage >= mobilePageCount - 1} onClick={() => setMobilePage((page) => page + 1)}>
                Próxima
              </Button>
            </div>
          )}
        </div>

        <div className="max-sm:hidden">
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
        </div>
      </CardContent>
    </Card>
  );
}
