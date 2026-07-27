"use client";

import { useActionState, useEffect } from "react";
import { ArrowLeft, Buildings, SlidersHorizontal, WifiHigh } from "@/components/huge-icons";
import Link from "next/link";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toggleAcceptingLeadsAction, toggleAutoDistributeAction, type BranchActionState } from "@/features/branches/actions";
import type { TenantRole } from "@/shared/db/schema";

type UnitProfileHeaderProps = {
  branch: {
    id: string;
    name: string;
    status: "active" | "inactive";
    acceptingLeads: boolean;
    autoDistribute: boolean;
  };
  currentRole: TenantRole;
  backHref: string;
};

function ActionFeedback({ state }: { state: BranchActionState }) {
  useEffect(() => {
    if (state.success) toast.success("Configuração atualizada.");
    if (state.error) toast.error(state.error);
  }, [state.success, state.error]);
  return null;
}

export function UnitProfileHeader({
  branch,
  currentRole,
  backHref,
}: UnitProfileHeaderProps) {
  const [acceptingState, acceptingAction, acceptingPending] = useActionState<BranchActionState, FormData>(
    toggleAcceptingLeadsAction,
    {},
  );
  const [autoDistState, autoDistAction, autoDistPending] = useActionState<BranchActionState, FormData>(
    toggleAutoDistributeAction,
    {},
  );

  const canToggleAccepting = currentRole === "director";
  const canToggleAutoDist = currentRole === "director" || currentRole === "manager";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button
          render={<Link href={backHref} />}
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          aria-label="Voltar"
        >
          <ArrowLeft aria-hidden="true" />
          Voltar
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
            <Buildings aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-medium text-primary">UNIDADE</p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
              {branch.name}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge
                variant={branch.status === "active" ? "success" : "secondary"}
                className="text-xs"
              >
                {branch.status === "active" ? "Ativa" : "Inativa"}
              </Badge>
              {branch.acceptingLeads ? (
                <Badge variant="outline" className="gap-1 text-xs">
                  <WifiHigh className="h-3 w-3" aria-hidden="true" />
                  Recebendo leads
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
                  <WifiHigh className="h-3 w-3" aria-hidden="true" />
                  Pausada para leads
                </Badge>
              )}
            </div>
          </div>
        </div>

        {(canToggleAccepting || canToggleAutoDist) && (
          <div className="flex flex-wrap items-center gap-2">
            {canToggleAccepting && (
              <form action={acceptingAction}>
                <input type="hidden" name="branchId" value={branch.id} />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  disabled={acceptingPending}
                  className="gap-1.5"
                >
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                  {branch.acceptingLeads ? "Pausar recebimento" : "Retomar recebimento"}
                </Button>
                <ActionFeedback state={acceptingState} />
              </form>
            )}
            {canToggleAutoDist && (
              <form action={autoDistAction}>
                <input type="hidden" name="branchId" value={branch.id} />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  disabled={autoDistPending}
                  className="gap-1.5"
                >
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                  {branch.autoDistribute ? "Desativar auto-distribuição" : "Ativar auto-distribuição"}
                </Button>
                <ActionFeedback state={autoDistState} />
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
