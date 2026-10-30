"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/sonner";
import { CopyCheckIcon } from "@/components/motion/copy-check-icon";

import { CheckCircle, Copy, Trash, WhatsappLogo } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { shareQuoteAction, deleteQuoteAction, type QuoteActionState } from "@/features/quotes/actions";
import { formatCurrency, buildQuoteWhatsAppMessage } from "@/features/quotes/utils";
import { buildWhatsAppWebUrl } from "@/lib/whatsapp-url";
import { openWhatsApp } from "@/lib/whatsapp-open";

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
  canDelete?: boolean;
  onChanged?: () => void;
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

export function QuoteCard({ quote, leadName, leadPhone, baseUrl, canDelete = false, onChanged }: QuoteCardProps) {
  const [shareState, share, sharePending] = useActionState<QuoteActionState, FormData>(shareQuoteAction, {});
  const [deleteState, del, deletePending] = useActionState<QuoteActionState, FormData>(deleteQuoteAction, {});
  const [copied, setCopied] = useState(false);
  const previousSuccess = useRef({ shared: false, deleted: false });

  const proposalUrl = `${baseUrl ?? ""}/cotacao/${quote.publicToken}`;

  useEffect(() => {
    if (shareState.error) toast.error(shareState.error);
    if (shareState.success) toast.success("Proposta compartilhada. Retorno criado para 48h.");
    if (deleteState.error) toast.error(deleteState.error);
    if (deleteState.success) {
      toast.success("Cotação excluída.");
    }
    if ((shareState.success && !previousSuccess.current.shared) || (deleteState.success && !previousSuccess.current.deleted)) {
      onChanged?.();
    }
    previousSuccess.current = { shared: Boolean(shareState.success), deleted: Boolean(deleteState.success) };
  }, [shareState, deleteState, onChanged]);

  function handleCopy() {
    navigator.clipboard.writeText(proposalUrl);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 1500);
  }

  function handleWhatsApp() {
    const message = buildQuoteWhatsAppMessage({
      leadName,
      totalMonthly: quote.totalMonthly != null ? Number(quote.totalMonthly) : null,
      beneficiaryCount: quote.beneficiaryCount,
      publicToken: quote.publicToken,
      baseUrl,
    });
    openWhatsApp(buildWhatsAppWebUrl(leadPhone, message));
  }

  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={quote.status === "draft" ? "outline" : "secondary"} className="text-xs">
            {STATUS_LABELS[quote.status] ?? quote.status}
          </Badge>
          {quote.sharedAt && (
            <Badge variant="secondary" className="text-xs">
              <CheckCircle className="mr-1 size-4" /> Compartilhada
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
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
        <Button className="min-h-11 px-3 text-xs" variant="outline" onClick={handleCopy}>
          <CopyCheckIcon copied={copied} className="relative inline-flex size-4 items-center justify-center"><Copy className="size-4" /></CopyCheckIcon>
          {copied ? "Copiado" : "Copiar link"}
        </Button>
        {leadPhone && (
          <Button className="min-h-11 px-3 text-xs" variant="outline" onClick={handleWhatsApp}>
            <WhatsappLogo className="size-4" /> WhatsApp
          </Button>
        )}
        <form action={share}>
          <input type="hidden" name="quoteId" value={quote.id} />
          <Button className="min-h-11 px-3 text-xs" disabled={sharePending} type="submit" variant="outline">
            Compartilhar + retorno
          </Button>
        </form>
        {canDelete ? (
          <form action={del}>
            <input type="hidden" name="quoteId" value={quote.id} />
            <Button className="min-h-11 min-w-11 px-2 text-destructive" disabled={deletePending} type="submit" variant="ghost" aria-label="Excluir cotação">
              <Trash className="size-4" />
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
