"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { preconfirmContiguousDutyPresenceAction } from "@/features/lead-distribution/duty-actions";

export function BrokerPresencePreconfirmButton({
  scheduleId,
  assignmentId,
  targetAssignmentId,
  targetScheduleName,
}: {
  scheduleId: string;
  assignmentId: string;
  targetAssignmentId: string;
  targetScheduleName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const router = useRouter();

  function confirm() {
    startTransition(async () => {
      try {
        const result = await preconfirmContiguousDutyPresenceAction(scheduleId, assignmentId, targetAssignmentId);
        if (!result.ok) {
          setMessage(result.reason);
          return;
        }
        setCompleted(true);
        setMessage("Esse turno já está confirmado.");
        window.setTimeout(() => router.refresh(), 1200);
      } catch {
        setMessage("Não foi possível confirmar agora. Tente novamente.");
      }
    });
  }

  return <span className="inline-flex min-w-0 flex-col items-start gap-1">
    <Button type="button" size="xs" variant="outline" disabled={pending || completed} onClick={confirm}>
      {pending ? "Confirmando…" : completed ? "Confirmado" : `Pré-confirmar · ${targetScheduleName}`}
    </Button>
    {message ? <span role={completed ? "status" : "alert"} className="max-w-64 text-xs text-muted-foreground">{message}</span> : null}
  </span>;
}
