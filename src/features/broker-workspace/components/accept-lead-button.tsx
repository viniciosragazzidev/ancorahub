"use client";

import { useTransition, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { motionTokens } from "@/components/arc/motion-tokens";
import { toast } from "@/components/ui/sonner";

import { acceptLeadOfferAction } from "@/features/leads/accept-offer-action";
import { openWhatsApp, prepareWhatsAppWindow } from "@/lib/whatsapp-open";

/**
 * "Aceitar e chamar no WhatsApp" in the Lite workspace: one tap accepts the
 * lead (which already starts the service) and opens the client's WhatsApp
 * (WhatsApp Web on the computer, the app on the phone); the CRM tab goes to
 * the lead. The WhatsApp Web tab is opened inside the click, before the
 * await, so popup blockers let it through; a failed accept closes it.
 */
export function AcceptLeadButton({ leadId, className, children, style, "data-tour": dataTour }: { leadId: string; className?: string; children: ReactNode; style?: CSSProperties; "data-tour"?: string }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (pending) return;
    const whatsapp = prepareWhatsAppWindow();
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof acceptLeadOfferAction>>;
      try {
        result = await acceptLeadOfferAction(leadId);
      } catch {
        result = { success: false };
      }
      if (!result.success) {
        whatsapp.cancel();
        toast.error(result.error ? `${result.error} Atualizei a sua lista.` : "Não deu para aceitar agora. Tente de novo; se o lead sumir, outro corretor já pegou.");
        router.refresh();
        return;
      }
      const url = result.whatsappUrl;
      if (url && whatsapp.go(url)) {
        toast.success("Lead aceito. Abrindo o WhatsApp do cliente.", { action: { label: "Abrir de novo", onClick: () => openWhatsApp(url) } });
      } else {
        whatsapp.cancel();
        toast.success("Lead aceito. Ele não tem WhatsApp no cadastro: veja o contato na ficha.");
      }
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
