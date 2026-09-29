"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { toggleDutyRosterPauseAction } from "@/features/lead-distribution/duty-actions";

/** Roster-row toggle: pauses (or resumes) one broker's automatic offers for this plantão, stopping the "próximo lead" countdown. */
export function BrokerPauseButton({ scheduleId, assignmentId, brokerName, paused }: { scheduleId: string; assignmentId: string; brokerName: string; paused: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      disabled={pending}
      aria-label={paused ? `Retomar ${brokerName} neste plantão` : `Pausar ${brokerName} neste plantão`}
      title={paused ? "Retomar corretor" : "Pausar corretor"}
      onClick={() => startTransition(async () => {
        const result = await toggleDutyRosterPauseAction(scheduleId, assignmentId, !paused);
        if (result.success) {
          toast.success(paused ? `${brokerName} retomado.` : `${brokerName} pausado — não vai receber leads automáticos neste plantão.`);
          router.refresh();
        } else {
          toast.error(result.error);
        }
      })}
    >
      {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
    </Button>
  );
}
