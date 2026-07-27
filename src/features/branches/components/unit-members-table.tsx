"use client";

import { useActionState, useEffect } from "react";
import { Power, Users } from "@/components/huge-icons";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toggleBrokerAvailabilityAction, type BranchActionState } from "@/features/branches/actions";
import type { BranchMember } from "@/features/branches/queries";
import type { TenantRole } from "@/shared/db/schema";

const ROLE_LABELS: Record<string, string> = {
  director: "Diretor",
  manager: "Gestor",
  broker: "Corretor",
};

const AVAILABILITY_LABELS: Record<string, string> = {
  available: "Disponível",
  paused: "Pausado",
};

type UnitMembersTableProps = {
  members: BranchMember[];
  currentRole: TenantRole;
};

function AvailabilityFeedback({ state }: { state: BranchActionState }) {
  useEffect(() => {
    if (state.success) toast.success("Disponibilidade atualizada.");
    if (state.error) toast.error(state.error);
  }, [state.success, state.error]);
  return null;
}

function BrokerAvailabilityToggle({
  member,
}: {
  member: BranchMember;
}) {
  const [state, action, pending] = useActionState<BranchActionState, FormData>(
    toggleBrokerAvailabilityAction,
    {},
  );
  return (
    <form action={action} className="inline-flex">
      <input type="hidden" name="brokerId" value={member.userId} />
      <Button
        type="submit"
        size="sm"
        variant="ghost"
        disabled={pending}
        aria-label={
          member.availabilityStatus === "available"
            ? `Pausar recebimento de ${member.name}`
            : `Retomar recebimento de ${member.name}`
        }
        className="h-7 gap-1.5 text-xs"
      >
        <Power className="h-3.5 w-3.5" aria-hidden="true" />
        {member.availabilityStatus === "available" ? "Pausar" : "Reativar"}
      </Button>
      <AvailabilityFeedback state={state} />
    </form>
  );
}

export function UnitMembersTable({ members, currentRole }: UnitMembersTableProps) {
  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
        <Users className="h-8 w-8 opacity-30" aria-hidden="true" />
        <p className="text-sm">Nenhum membro nesta unidade ainda.</p>
        <p className="text-xs">Convide corretores pela área de Equipe.</p>
      </div>
    );
  }

  const canToggleAvailability =
    currentRole === "director" || currentRole === "manager";

  return (
    <div className="overflow-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Papel</TableHead>
            <TableHead>Disponibilidade</TableHead>
            <TableHead className="text-right">Leads ativos</TableHead>
            {canToggleAvailability && (
              <TableHead className="w-24 text-right">Ação</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <tbody>
          {members.map((member) => (
            <TableRow key={member.userId}>
              <TableCell>
                <div>
                  <p className="text-sm font-medium">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.email}</p>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="text-xs">
                  {ROLE_LABELS[member.role] ?? member.role}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    member.availabilityStatus === "available"
                      ? "success"
                      : "outline"
                  }
                  className="text-xs"
                >
                  {AVAILABILITY_LABELS[member.availabilityStatus] ??
                    member.availabilityStatus}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-mono text-sm tabular-nums">
                {member.activeLeads}
              </TableCell>
              {canToggleAvailability && (
                <TableCell className="text-right">
                  {member.role === "broker" && (
                    <BrokerAvailabilityToggle member={member} />
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
