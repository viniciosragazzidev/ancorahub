"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";

import { acceptLeadOfferAction } from "@/features/leads/accept-offer-action";

/**
 * "ACEITAR LEAD" in the Lite workspace: records the acceptance first, then
 * opens the lead. Keeps the caller's visual classes so each surface looks the
 * same as its former link.
 */
export function AcceptLeadButton({ leadId, className, children }: { leadId: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (pending) return;
    startTransition(async () => {
      const result = await acceptLeadOfferAction(leadId);
      if (!result.success) {
        toast.error(result.error ?? "Não foi possível aceitar o lead agora.");
        router.refresh();
        return;
      }
      toast.success("Lead aceito. Ele agora é seu.");
      router.push(`/leads/${leadId}`);
    });
  }

  return (
    <button type="button" className={className} disabled={pending} aria-busy={pending} onClick={handleClick}>
      {children}
    </button>
  );
}
