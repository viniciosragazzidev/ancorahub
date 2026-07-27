"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { CheckCircle, Copy, Trash, WhatsappLogo } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { shareQuoteAction, deleteQuoteAction, type QuoteActionState } from "@/features/quotes/actions";
import { formatCurrency, buildQuoteWhatsAppMessage } from "@/features/quotes/utils";

type Quote = {
  id: string;
  status: string;
  totalMonthly: string | number | null;
  beneficiaryCount: number | null;
  publicToken: string;
  sharedAt: Date | null;
  createdAt: Date;
};

type QuoteCardProps = {
  quote: Quote;
  leadName: string;
  leadPhone?: string | null;
  baseUrl?: string;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  shared: "Compartilhada",
  sent: "Enviada",
  viewed: "Visualizada",
  accepted: "Aceita",
  rejected: "Recusada",
  expired: "Expirada",
};

export function QuoteCard({ quote, leadName, leadPhone, baseUrl }: QuoteCardProps) {
  const [shareState, share, sharePending] = useActionState<QuoteActionState, FormData>(shareQuoteAction, {});
  const [deleteState, del, deletePending] = useActionState<QuoteActionState, FormData>(deleteQuoteAction, {});
  const [copied, setCopied] = useState(false);

  const proposalUrl = `${baseUrl ?? ""}/cotacao/${quote.publicToken}`;

  useEffect(() => {
    if (shareState.error) toast.error(shareState.error);
    if (shareState.success) toast.success("Proposta compartilhada. Retorno criado para 48h.");
    if (deleteState.error) toast.error(deleteState.error);
    if (deleteState.success) {
      toast.success("Cotação excluída.");
    }
  }, [shareState, deleteState]);

  function handleCopy() {
    navigator.clipboard.writeText(proposalUrl);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleWhatsApp() {
    const message = buildQuoteWhatsAppMessage({
      leadName,
      totalMonthly: quote.totalMonthly != null ? Number(quote.totalMonthly) : null,
      beneficiaryCount: quote.beneficiaryCount,
      publicToken: quote.publicToken,
      baseUrl,
    });
    const url = `https://wa.me/${(leadPhone ?? "").replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noreferrer");
  }

  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={quote.status === "draft" ? "outline" : "secondary"} className="text-[10px]">
            {STATUS_LABELS[quote.status] ?? quote.status}
          </Badge>
          {quote.sharedAt && (
            <Badge variant="secondary" className="text-[10px]">
              <CheckCircle className="mr-1 size-3" /> Compartilhada
            </Badge>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground">
          {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(quote.createdAt)}
        </span>
      </div>

      <div className="flex items-baseline gap-3">
        {quote.totalMonthly && (
          <span className="text-sm font-semibold text-foreground">{formatCurrency(Number(quote.totalMonthly))}/mês</span>
        )}
        {quote.beneficiaryCount && (
          <span className="text-xs text-muted-foreground">{quote.beneficiaryCount} beneficiário(s)</span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 pt-1">
        <Button className="h-7 px-2 text-[10px]" size="sm" variant="outline" onClick={handleCopy}>
          {copied ? <CheckCircle className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copiado" : "Copiar link"}
        </Button>
        {leadPhone && (
          <Button className="h-7 px-2 text-[10px]" size="sm" variant="outline" onClick={handleWhatsApp}>
            <WhatsappLogo className="size-3" /> WhatsApp
          </Button>
        )}
        <form action={share}>
          <input type="hidden" name="quoteId" value={quote.id} />
          <Button className="h-7 px-2 text-[10px]" disabled={sharePending} size="sm" type="submit" variant="outline">
            Compartilhar + retorno
          </Button>
        </form>
        <form action={del}>
          <input type="hidden" name="quoteId" value={quote.id} />
          <Button className="h-7 px-2 text-[10px] text-destructive" disabled={deletePending} size="sm" type="submit" variant="ghost">
            <Trash className="size-3" />
          </Button>
        </form>
      </div>
    </div>
  );
}
