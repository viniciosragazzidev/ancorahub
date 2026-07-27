"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateBrokerAvailabilityAction,
  checkBrokerDistributedLeadsAction,
} from "@/features/leads/availability-action";

export function AvailabilityToggle({ initialStatus }: { initialStatus: "available" | "paused" | "offline" }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"available" | "paused" | "offline">(initialStatus);

  function handleStatusChange(value: "available" | "paused" | "offline" | null) {
    if (!value) return;
    const nextStatus = value;
    if (nextStatus === status) return;

    startTransition(async () => {
      try {
        if (status === "available" && (nextStatus === "paused" || nextStatus === "offline")) {
          const distributedCount = await checkBrokerDistributedLeadsAction();
          if (distributedCount > 0) {
            const word = nextStatus === "paused" ? "Pausado" : "Desconectado/Offline";
            const confirmChange = confirm(
              `Atenção: Você possui ${distributedCount} lead(s) atribuídos que ainda não tiveram atendimento iniciado.\n\n` +
              `Ao ficar ${word}, esses atendimentos correm o risco de estourar o SLA de primeiro contato e serem redistribuídos para outros corretores.\n\n` +
              `Deseja prosseguir mesmo assim?`
            );
            if (!confirmChange) return;
          }
        }

        await updateBrokerAvailabilityAction(nextStatus);
        setStatus(nextStatus);
        
        let msg = "Você está online e pronto para receber novos leads.";
        if (nextStatus === "paused") msg = "Você está pausado. Não receberá novos leads temporariamente.";
        if (nextStatus === "offline") msg = "Você está desconectado. Não receberá leads ou notificações.";
        
        toast.success(msg);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a disponibilidade.");
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-semibold text-muted-foreground mr-1">Operação:</span>
      <Select value={status} onValueChange={handleStatusChange} disabled={pending}>
        <SelectTrigger className="w-48 h-9 text-xs font-medium bg-card border-border">
          <SelectValue placeholder="Disponibilidade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="available">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Online (Recebendo)
            </span>
          </SelectItem>
          <SelectItem value="paused">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Pausado
            </span>
          </SelectItem>
          <SelectItem value="offline">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              Desconectado
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
