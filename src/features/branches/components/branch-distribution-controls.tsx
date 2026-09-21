"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { CheckCircle, XCircle } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
  toggleAcceptingLeadsAction,
  toggleAutoDistributeAction,
  toggleDistributionHubAction,
  type BranchActionState,
} from "@/features/branches/actions";

/**
 * Chaves de distribuição por filial (receber leads, distribuição automática e
 * papel da unidade). Antes viviam na aba "Filas" da Central de Distribuição;
 * `/filiais` é a tela canônica de configuração de filiais.
 *
 * As ações não revalidam nenhuma rota; por isso, ao concluir com sucesso o
 * cliente pede um refresh para o servidor devolver o novo valor.
 */
function useToggleFeedback(state: BranchActionState) {
  const router = useRouter();
  useEffect(() => {
    if (state.error) {
      toast.error(state.error);
      return;
    }
    if (state.success) {
      toast.success(state.message ?? "Configuração atualizada.");
      router.refresh();
    }
  }, [state, router]);
}

type ToggleAction = (previous: BranchActionState, formData: FormData) => Promise<BranchActionState>;

function StateToggle({
  branchId,
  label,
  enabled,
  action,
}: {
  branchId: string;
  label: string;
  enabled: boolean;
  action: ToggleAction;
}) {
  const [state, formAction, pending] = useActionState<BranchActionState, FormData>(action, {});
  useToggleFeedback(state);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="branchId" value={branchId} />
      <Button
        type="submit"
        disabled={pending}
        size="xs"
        variant={enabled ? "outline" : "secondary"}
        aria-pressed={enabled}
        className={cn(
          enabled &&
            "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:border-emerald-500/40 hover:bg-emerald-500/20 dark:border-emerald-500/35 dark:text-emerald-400",
        )}
        title={`Clique para ${enabled ? "desativar" : "ativar"} ${label}`}
      >
        {enabled ? <CheckCircle /> : <XCircle />}
        {enabled ? "Ativo" : "Inativo"}
      </Button>
    </form>
  );
}

export function BranchAcceptingToggle({ branchId, enabled }: { branchId: string; enabled: boolean }) {
  return <StateToggle branchId={branchId} label="recebimento de leads" enabled={enabled} action={toggleAcceptingLeadsAction} />;
}

export function BranchAutoDistributeToggle({ branchId, enabled }: { branchId: string; enabled: boolean }) {
  return <StateToggle branchId={branchId} label="distribuição automática" enabled={enabled} action={toggleAutoDistributeAction} />;
}

export function BranchHubToggle({ branchId, enabled }: { branchId: string; enabled: boolean }) {
  const [state, formAction, pending] = useActionState<BranchActionState, FormData>(toggleDistributionHubAction, {});
  useToggleFeedback(state);

  return (
    <form action={formAction}>
      <input type="hidden" name="branchId" value={branchId} />
      <Button
        type="submit"
        disabled={pending}
        size="xs"
        variant={enabled ? "secondary" : "outline"}
        aria-pressed={enabled}
        title={enabled ? "Esta filial é a Central de redistribuição" : "Definir como Central de redistribuição"}
      >
        {enabled ? "Central" : "Distribui"}
      </Button>
    </form>
  );
}

/** Legenda das chaves; fica abaixo da tabela de filiais. */
export function BranchDistributionLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/70 px-5 py-3 text-[11px] leading-5 text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <CheckCircle className="size-3.5 text-emerald-600 dark:text-emerald-400" />
        <span>Recebendo leads ativo — leads de webhooks/manuais são roteados para esta filial</span>
      </span>
      <span className="flex items-center gap-1.5">
        <CheckCircle className="size-3.5 text-emerald-600 dark:text-emerald-400" />
        <span>Distrib. automática — leads são atribuídos automaticamente a corretores disponíveis</span>
      </span>
      <span className="flex items-center gap-1.5">
        <XCircle className="size-3.5 text-muted-foreground" />
        <span>Inativo — a filial não participa desta funcionalidade</span>
      </span>
    </div>
  );
}
