"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { keepLeadStageAction } from "@/features/leads/stale-stage-actions";

/** "Manter na etapa" (05/11): devolve o lead de Aguardando retorno e segura a regra de chat parado por 7 dias. */
export function KeepStageButton({ leadId, previousLabel, size = "sm" }: { leadId: string; previousLabel: string | null; size?: "sm" | "xs" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size={size}
      variant="outline"
      disabled={pending}
      onClick={() => startTransition(async () => {
        const result = await keepLeadStageAction({ leadId });
        if (result.ok) toast.success(result.message);
        else toast.error(result.reason);
        router.refresh();
      })}
    >
      {previousLabel ? `Manter em ${previousLabel}` : "Manter na etapa"}
    </Button>
  );
}
