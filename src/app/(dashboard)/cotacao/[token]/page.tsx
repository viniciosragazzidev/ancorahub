import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getQuoteByToken } from "@/features/quotes/queries";
import { formatCurrency } from "@/features/quotes/utils";
import { Badge } from "@/components/ui/badge";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const quote = await getQuoteByToken(token);
  if (!quote) return { title: "Proposta não encontrada" };

  return {
    title: `Proposta — ${quote.leadName ?? "CorreTop"}`,
    description: `Proposta de seguro de saúde para ${quote.leadName ?? "você"}. Valor mensal: ${quote.totalMonthly ? formatCurrency(Number(quote.totalMonthly)) : "a definir"}.`,
    robots: "noindex, nofollow",
  };
}

export default async function PublicQuotePage({ params }: Props) {
  const { token } = await params;
  const quote = await getQuoteByToken(token);

  if (!quote) notFound();

  const statusLabel: Record<string, string> = {
    draft: "Rascunho",
    shared: "Compartilhada",
    sent: "Enviada",
    viewed: "Visualizada",
    accepted: "Aceita",
    rejected: "Recusada",
    expired: "Expirada",
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Proposta de Seguro de Saúde</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Proposta preparada para <strong className="text-foreground">{quote.leadName ?? "você"}</strong>
          </p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <Badge variant="outline" className="text-xs">
              {statusLabel[quote.status] ?? quote.status}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(quote.createdAt)}
            </span>
          </div>
        </div>

        {/* Summary */}
        {(quote.totalMonthly || quote.beneficiaryCount) && (
          <div className="mb-8 rounded-xl border border-primary/20 bg-primary/5 p-6 text-center">
            {quote.beneficiaryCount && (
              <p className="text-sm text-muted-foreground">{quote.beneficiaryCount} beneficiário(s)</p>
            )}
            {quote.totalMonthly && (
              <p className="mt-1 text-3xl font-bold text-primary">{formatCurrency(Number(quote.totalMonthly))}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">valor mensal estimado</p>
          </div>
        )}

        {/* Items */}
        {quote.items.length > 0 && (
          <div className="mb-8 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Planos</h2>
            {quote.items.map((item) => (
              <div key={item.id} className="rounded-lg border border-border/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{(item.snapshot as Record<string, string>)?.planName ?? item.planId}</span>
                  <span className="text-sm font-semibold text-primary">{formatCurrency(Number(item.monthlyPrice))}/mês</span>
                </div>
                {item.recommended && (
                  <Badge variant="secondary" className="mt-2 text-[10px]">Recomendado</Badge>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Line Items (per beneficiary) */}
        {quote.lineItems.length > 0 && (
          <div className="mb-8 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Detalhamento por beneficiário</h2>
            {quote.lineItems.map((item) => (
              <div key={item.id} className="rounded-lg border border-border/60 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{(item.snapshot as Record<string, string>)?.beneficiaryName ?? item.beneficiaryId}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{item.ageAtQuote} anos</span>
                  </div>
                  <span className="text-sm font-semibold text-primary">{formatCurrency(Number(item.calculatedValue))}/mês</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Plano: {(item.snapshot as Record<string, string>)?.planName ?? item.planId}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        {quote.notes && (
          <div className="mb-8 rounded-lg border border-border/40 bg-muted/30 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Observações</h2>
            <p className="text-sm text-foreground whitespace-pre-wrap">{quote.notes}</p>
          </div>
        )}

        {/* CTA */}
        <div className="text-center space-y-3">
          <p className="text-xs text-muted-foreground">
            Esta proposta é uma estimativa. O valor final pode variar conforme a análise da operadora.
          </p>
          {quote.leadPhone && (
            <a
              href={`https://wa.me/${quote.leadPhone.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá! Recebi a proposta de seguro de saúde. Gostaria de mais informações.`)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Falar com o corretor
            </a>
          )}
        </div>

        {/* Footer */}
        <div className="mt-12 border-t border-border/40 pt-6 text-center">
          <p className="text-[10px] text-muted-foreground">
            Proposta gerada pela plataforma CorreTop. Este documento não substitui a análise formal da operadora.
          </p>
        </div>
      </div>
    </div>
  );
}
