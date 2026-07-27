"use client";

import { useActionState, useEffect } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Buildings, CheckCircle, XCircle, WifiHigh } from "@/components/huge-icons";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toggleAcceptingLeadsAction, toggleAutoDistributeAction, type BranchActionState } from "@/features/branches/actions";
import type { TenantRole } from "@/shared/db/schema";

type BranchInfo = {
  id: string;
  name: string;
  status: "active" | "inactive";
  acceptingLeads: boolean;
  autoDistribute: boolean;
  createdAt: Date;
};

export function UnitTab({
  branch,
  currentRole,
}: {
  branch: BranchInfo | null;
  currentRole: TenantRole;
}) {
  const [acceptingState, acceptingAction, acceptingPending] = useActionState<BranchActionState, FormData>(
    toggleAcceptingLeadsAction,
    {},
  );
  const [autoDistState, autoDistAction, autoDistPending] = useActionState<BranchActionState, FormData>(
    toggleAutoDistributeAction,
    {},
  );

  useEffect(() => {
    if (acceptingState.success) toast.success("Recebimento de leads atualizado.");
    if (acceptingState.error) toast.error(acceptingState.error);
  }, [acceptingState.success, acceptingState.error]);

  useEffect(() => {
    if (autoDistState.success) toast.success("Distribuição automática atualizada.");
    if (autoDistState.error) toast.error(autoDistState.error);
  }, [autoDistState.success, autoDistState.error]);

  const isDirector = currentRole === "director";
  const canToggleAccepting = isDirector;
  const canToggleAutoDist = currentRole === "director" || currentRole === "manager";

  // Director without a specific branch selected — show overview
  if (!branch) {
    return (
      <Card className="border-border bg-card shadow-none">
        <CardHeader>
          <CardTitle>Unidades</CardTitle>
          <CardDescription>
            Gerencie as unidades da sua corretora. A identidade visual é configurada em Empresa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-xs text-muted-foreground">Escopo atual</p>
            <p className="mt-1 text-sm font-medium">Todas as unidades da corretora</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              As configurações de cada unidade podem ser ajustadas individualmente na página de{" "}
              <a href="/filiais" className="text-primary underline underline-offset-2 hover:text-primary/80">
                Filiais
              </a>
              .
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Branch identity header */}
      <Card className="border-border bg-card shadow-none">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
              <Buildings aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle>{branch.name}</CardTitle>
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
              <CardDescription className="mt-1">
                Criada em{" "}
                {new Intl.DateTimeFormat("pt-BR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }).format(new Date(branch.createdAt))}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Accepting leads toggle — director only */}
      {canToggleAccepting && (
        <Card className="border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle>Recebimento de leads</CardTitle>
            <CardDescription>
              {branch.acceptingLeads
                ? "A unidade está aceitando novos leads normalmente."
                : "A unidade está pausada e não receberá novos leads."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={acceptingAction} className="flex items-center justify-between gap-4">
              <input type="hidden" name="branchId" value={branch.id} />
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ scale: acceptingPending ? 0.95 : 1 }}
                  transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
                >
                  <button
                    type="submit"
                    disabled={acceptingPending}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                      branch.acceptingLeads
                        ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    } disabled:opacity-50`}
                  >
                    {branch.acceptingLeads ? <CheckCircle className="size-5" /> : <XCircle className="size-5" />}
                    {branch.acceptingLeads ? "Ativo" : "Pausado"}
                  </button>
                </motion.div>
              </div>
              <span className="text-xs text-muted-foreground">
                {acceptingPending ? "Alterando..." : "Clique para alternar"}
              </span>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Auto-distribute toggle — manager & director */}
      {canToggleAutoDist && (
        <Card className="border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle>Distribuição automática</CardTitle>
            <CardDescription>
              {branch.autoDistribute
                ? "Leads são distribuídos automaticamente entre corretores disponíveis desta unidade."
                : "Leads chegam como novos e precisam ser distribuídos manualmente."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={autoDistAction} className="flex items-center justify-between gap-4">
              <input type="hidden" name="branchId" value={branch.id} />
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ scale: autoDistPending ? 0.95 : 1 }}
                  transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
                >
                  <button
                    type="submit"
                    disabled={autoDistPending}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                      branch.autoDistribute
                        ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    } disabled:opacity-50`}
                  >
                    {branch.autoDistribute ? <CheckCircle className="size-5" /> : <XCircle className="size-5" />}
                    {branch.autoDistribute ? "Ativada" : "Desativada"}
                  </button>
                </motion.div>
              </div>
              <span className="text-xs text-muted-foreground">
                {autoDistPending ? "Alterando..." : "Clique para alternar"}
              </span>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
