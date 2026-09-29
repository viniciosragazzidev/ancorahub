"use client";

import { useState, useTransition } from "react";
import { toast } from "@/components/ui/sonner";

import { Button } from "@/components/ui/button";
import {
  updateBrokerAvailabilityAction,
  checkBrokerDistributedLeadsAction,
} from "@/features/leads/availability-action";

type Status = "available" | "paused" | "offline";

const STATUS_CONFIG = {
  available: { label: "Online", dot: "bg-emerald-500 animate-pulse" },
  paused: { label: "Pausado", dot: "bg-amber-500" },
  offline: { label: "Offline", dot: "bg-rose-500" },
} as const;

export function BrokerAvailabilityButton({ initialStatus }: { initialStatus: Status }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<Status>(initialStatus);
  const config = STATUS_CONFIG[status];

  async function toggleStatus() {
    const nextStatus: Status = status === "available" ? "offline" : "available";

    startTransition(async () => {
      try {
        if (status === "available") {
          const distributedCount = await checkBrokerDistributedLeadsAction();
          if (distributedCount > 0) {
            const word = "Offline";
            const confirmChange = confirm(
              `Atenção: Você possui ${distributedCount} lead(s) atribuídos que ainda não tiveram atendimento iniciado. Ao ficar ${word}, esses atendimentos correm o risco de estourar o SLA de primeiro contato e serem redistribuídos para outros corretores. Deseja prosseguir mesmo assim?`
            );
            if (!confirmChange) return;
          }
        }

        await updateBrokerAvailabilityAction(nextStatus);
        setStatus(nextStatus);

        const msgs: Record<Status, string> = {
          available: "Você está online e pronto para receber novos leads.",
          paused: "Você está pausado. Não receberá novos leads temporariamente.",
          offline: "Você está desconectado. Não receberá leads ou notificações.",
        };
        toast.success(msgs[nextStatus]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a disponibilidade.");
      }
    });
  }

  return (
    <Button
      variant={status === "available" ? "outline" : "secondary"}
      size="sm"
      onClick={toggleStatus}
      disabled={pending}
      className="gap-1.5 text-xs"
    >
      <span className={`size-2 rounded-full ${config.dot}`} />
      {status === "available" ? "Disponível" : config.label}
    </Button>
  );
}
