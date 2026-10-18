"use client";

import { useTransition, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { motionTokens } from "@/components/arc/motion-tokens";
import { toast } from "@/components/ui/sonner";

import { acceptLeadOfferAction } from "@/features/leads/accept-offer-action";

/**
 * "ACEITAR LEAD" in the Lite workspace: records the acceptance first, then
 * opens the lead. Keeps the caller's visual classes so each surface looks the
 * same as its former link.
 */
export function AcceptLeadButton({ leadId, className, children, style, "data-tour": dataTour }: { leadId: string; className?: string; children: ReactNode; style?: CSSProperties; "data-tour"?: string }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (pending) return;
    startTransition(async () => {
      const result = await acceptLeadOfferAction(leadId);
      if (!result.success) {
        toast.error("Não deu para aceitar agora. Tente de novo; se o lead sumir, outro corretor já pegou.");
        router.refresh();
        return;
      }
      toast.success("Lead aceito. Ele agora é seu.");
      router.push(`/leads/${leadId}`);
    });
  }

  return (
    <motion.button
      type="button"
      className={className}
      style={style}
      data-tour={dataTour}
      disabled={pending}
      aria-busy={pending}
      onClick={handleClick}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      transition={motionTokens.spring.snappy}
    >
      {children}
    </motion.button>
  );
}
