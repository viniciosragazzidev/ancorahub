"use client";

import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import {
  toggleAcceptingLeadsAction,
  toggleAutoDistributeAction,
  toggleDistributionHubAction,
  type BranchActionState,
} from "@/features/branches/actions";

/**
 * Chaves de distribuição por filial (receber leads, distribuição automática e
 * papel da unidade). Antes viviam na aba "Filas" da Central de Distribuição;
 * `/equipe?visao=unidades` é a visão canônica de configuração de unidades.
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

/** A compact switch in a table cell; the server action flips the stored value. */
function StateSwitch({
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
  const [, startTransition] = useTransition();
  useToggleFeedback(state);

  return (
    <Switch

      checked={enabled}
      disabled={pending}
      aria-label={label}
      title={`Clique para ${enabled ? "desativar" : "ativar"}: ${label}`}
      onCheckedChange={() => {
        const formData = new FormData();
        formData.set("branchId", branchId);
        startTransition(() => formAction(formData));
      }}
    />
  );
}

export function BranchAcceptingToggle({ branchId, enabled }: { branchId: string; enabled: boolean }) {
  return <StateSwitch branchId={branchId} label="recebimento de leads" enabled={enabled} action={toggleAcceptingLeadsAction} />;
}

export function BranchAutoDistributeToggle({ branchId, enabled }: { branchId: string; enabled: boolean }) {
  return <StateSwitch branchId={branchId} label="distribuição automática" enabled={enabled} action={toggleAutoDistributeAction} />;
}

export function BranchHubToggle({ branchId, enabled }: { branchId: string; enabled: boolean }) {
  return <StateSwitch branchId={branchId} label="central de redistribuição" enabled={enabled} action={toggleDistributionHubAction} />;
}

/** Legenda das chaves; fica abaixo da tabela de filiais. */
export function BranchDistributionLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/50 px-4 py-3 text-[11px] leading-5 text-muted-foreground">
      <span><span className="font-medium text-foreground">Recebe leads</span>: leads de webhooks e manuais são roteados para a filial.</span>
      <span><span className="font-medium text-foreground">Distribuição automática</span>: atribui aos corretores disponíveis sem intervenção.</span>
      <span><span className="font-medium text-foreground">Central</span>: filial que recebe os leads redistribuídos.</span>
    </div>
  );
}
