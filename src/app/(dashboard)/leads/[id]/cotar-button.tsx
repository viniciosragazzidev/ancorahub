"use client";

import { Calculator } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { prepareExternalQuoteAction } from "@/features/quotes/external-quote-actions";
import { useTransition } from "react";
import { toast } from "sonner";

export function CotarButton({ leadId, configured }: { leadId: string; configured: boolean }) {
  const [pending, startTransition] = useTransition();

  function openExternalQuote() {
    const popup = window.open("about:blank", "_blank", "noopener,noreferrer");
    startTransition(async () => {
      const result = await prepareExternalQuoteAction(leadId);
      if (!result.success) {
        popup?.close();
        toast.error(result.error);
        return;
      }
      if (popup) popup.location.href = result.url;
      else window.location.href = result.url;
    });
  }

  return (
    <Button size="sm" onClick={openExternalQuote} disabled={pending || !configured} title={!configured ? "Configure EXTERNAL_QUOTE_APP_URL para ativar" : undefined}>
      <Calculator className="size-4" /> {pending ? "Abrindo..." : configured ? "Cotação externa" : "Cotador não configurado"}
    </Button>
  );
}
