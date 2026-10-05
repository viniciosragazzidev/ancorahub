"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { releaseDutyPresenceAction } from "@/features/lead-distribution/duty-actions";

/**
 * Roster-row button: releases a broker on this plantão without their presence
 * click (e.g. an in-person plantão checked on site). They become eligible for
 * offers right away; the release is audited with who did it.
 */
export function BrokerPresenceReleaseButton({ scheduleId, assignmentId, brokerName, inUnit = false }: { scheduleId: string; assignmentId: string; brokerName: string; inUnit?: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      disabled={pending}
      aria-label={inUnit ? `Confirmar presença de ${brokerName} na unidade` : `Liberar ${brokerName} no plantão sem a confirmação dele`}
      title={inUnit ? "Confirmar presença na unidade" : "Liberar sem a confirmação do corretor"}
      onClick={() => startTransition(async () => {
        const result = await releaseDutyPresenceAction(scheduleId, assignmentId);
        if (result.ok) {
          toast.success(inUnit ? `Presença de ${brokerName} confirmada na unidade.` : `${brokerName} liberado(a) no plantão.`);
          router.refresh();
        } else {
          toast.error(result.reason);
        }
      })}
    >
      <CheckCircle2 className="size-3.5" />
      {inUnit ? "Confirmar presença na unidade" : "Liberar"}
    </Button>
  );
}
