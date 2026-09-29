"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PaperPlaneTilt } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { sendDutyPresenceInviteManuallyAction } from "@/features/lead-distribution/duty-actions";

/** Roster-row button: sends (or resends) the presence-confirmation WhatsApp invite right now, for one broker. */
export function BrokerPresenceInviteButton({ scheduleId, assignmentId, brokerName }: { scheduleId: string; assignmentId: string; brokerName: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      disabled={pending}
      aria-label={`Enviar convite de confirmação de presença para ${brokerName}`}
      title="Enviar convite de presença"
      onClick={() => startTransition(async () => {
        const result = await sendDutyPresenceInviteManuallyAction(scheduleId, assignmentId);
        if (result.ok) {
          toast.success(`Convite enviado para ${brokerName}.`);
          router.refresh();
        } else {
          toast.error(result.reason);
        }
      })}
    >
      <PaperPlaneTilt className="size-3.5" />
    </Button>
  );
}
