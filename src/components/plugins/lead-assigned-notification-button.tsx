"use client";

import { useTransition } from "react";
import { Bell, WhatsappLogo } from "@/components/huge-icons";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { triggerLeadAssignedNotificationAction } from "@/utils/plugins/actions";

type LeadAssignedNotificationButtonProps = {
  leadId: string;
  className?: string;
  compact?: boolean;
};

export function LeadAssignedNotificationButton({ leadId, className, compact = false }: LeadAssignedNotificationButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await triggerLeadAssignedNotificationAction({
        leadId,
        channels: ["push", "whatsapp"],
        idempotencyKey: `manual:lead-assigned:${leadId}:${crypto.randomUUID()}`,
      });
      if (!result.success) {
        toast.error(result.error ?? "Não foi possível enviar o aviso.");
        return;
      }
      if (result.duplicate) {
        toast.info("Este aviso já foi processado.");
        return;
      }
      const channels = result.channels?.join(" + ") || "canal disponível";
      toast.success(`Aviso enviado por ${channels}.`, result.warnings?.length ? { description: result.warnings.join(" ") } : undefined);
    });
  }

  return (
    <Button type="button" size={compact ? "xs" : "sm"} variant="outline" className={className} onClick={handleClick} disabled={isPending}>
      <Bell className="size-4" />
      <span className="hidden sm:inline">{isPending ? "Enviando…" : "Reenviar aviso"}</span>
      <WhatsappLogo className="hidden size-4 sm:inline" />
    </Button>
  );
}
