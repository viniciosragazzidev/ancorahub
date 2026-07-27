"use client";

import { useActionState, useEffect } from "react";
import { motion } from "motion/react";
import { CheckCircle, XCircle } from "@/components/huge-icons";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toggleAutoDistributeAction, type BranchActionState } from "@/features/branches/actions";

export function AutoDistributeToggle({
  branchId,
  autoDistribute,
}: {
  branchId: string;
  autoDistribute: boolean;
}) {
  const [state, action, pending] = useActionState<BranchActionState, FormData>(
    toggleAutoDistributeAction,
    {},
  );

  useEffect(() => {
    if (state.success) toast.success("Distribuição automática atualizada.");
    if (state.error) toast.error(state.error);
  }, [state.success, state.error]);

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader>
        <CardTitle>Distribuição automática</CardTitle>
        <CardDescription>
          {autoDistribute
            ? "Leads são distribuídos automaticamente entre corretores disponíveis."
            : "Leads chegam como \"Novos\" e o gestor faz a distribuição manualmente."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex items-center justify-between gap-4">
          <input type="hidden" name="branchId" value={branchId} />
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ scale: pending ? 0.95 : 1 }}
              transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
            >
              <button
                type="submit"
                disabled={pending}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  autoDistribute
                    ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                } disabled:opacity-50`}
              >
                {autoDistribute ? <CheckCircle className="size-5" /> : <XCircle className="size-5" />}
                {autoDistribute ? "Ativada" : "Desativada"}
              </button>
            </motion.div>
          </div>
          <span className="text-xs text-muted-foreground">
            {pending ? "Alterando..." : "Clique para alternar"}
          </span>
        </form>
      </CardContent>
    </Card>
  );
}
