"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Sparkle } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { getAttendanceFlowQueueOptionsAction, startLeadAttendanceFlowAction } from "@/features/attendance-flows/actions";

type QueueOption = { id: string; name: string; flowName: string };

/**
 * Starts a lead without broker in a queue's attendance flow (DEC-127). Shown
 * only to directors while the attendance flows switch is on.
 */
export function LeadAttendanceFlowStarter({ leadId, onStarted }: { leadId: string; onStarted?: () => void }) {
  const router = useRouter();
  const [queues, setQueues] = useState<QueueOption[] | null>(null);
  const [queueId, setQueueId] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void getAttendanceFlowQueueOptionsAction().then((options) => { if (!cancelled) setQueues(options); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  if (!queues?.length) return null;
  const selected = queues.find((queue) => queue.id === queueId);

  function start() {
    startTransition(async () => {
      const result = await startLeadAttendanceFlowAction({ leadId, queueId });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      onStarted?.();
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-card)] border border-border p-3">
      <div className="flex items-center gap-2">
        <Sparkle className="size-4 text-primary" />
        <p className="text-xs font-semibold text-foreground">Iniciar atendimento pela fila</p>
      </div>
      <p className="text-xs leading-normal text-muted-foreground">
        Coloca o lead na fila escolhida e roda o fluxo dela desde o começo, como um lead que acabou de chegar.
      </p>
      <Select value={queueId} onValueChange={(value) => setQueueId(String(value ?? ""))}>
        <SelectTrigger aria-label="Fila do atendimento" className="h-9 text-xs">
          <SelectValue placeholder="Selecione a fila">{selected ? selected.name : undefined}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {queues.map((queue) => (
            <SelectItem key={queue.id} value={queue.id} className="text-xs">{queue.name} · {queue.flowName}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button className="h-9 w-full text-xs" disabled={!queueId || isPending} onClick={start} type="button" variant="outline">
        {isPending ? "Iniciando…" : "Iniciar atendimento"}
      </Button>
    </div>
  );
}
