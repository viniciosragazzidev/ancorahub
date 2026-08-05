import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";

import { getQuoteByToken } from "@/features/quotes/queries";
import { formatCurrency } from "@/features/quotes/utils";
import { Badge } from "@/components/ui/badge";
import { getDatabase, schema } from "@/shared/db";

type Props = { params: Promise<{ token: string }> };

async function getProposalAndQuote(token: string) {
  const db = getDatabase();

  // 1. Try to find quote by token
  let quote = await getQuoteByToken(token);
  let proposal: any = null;

  if (quote) {
    // Try to find proposal linked to this quote
    const [prop] = await db
      .select()
      .from(schema.proposals)
      .where(eq(schema.proposals.quoteId, quote.id))
      .limit(1);
    proposal = prop;
  } else {
    // 2. Try to find proposal by ID directly
    const [prop] = await db
      .select()
      .from(schema.proposals)
      .where(eq(schema.proposals.id, token))
      .limit(1);

    if (prop) {
      proposal = prop;
      // Fetch associated quote if quoteId is set
      if (prop.quoteId) {
        quote = await getQuoteByToken(prop.quoteId);
      }
    }
  }

  // 3. Status transition and audit log if accessed by client and status is "enviada"
  if (proposal && proposal.status === "enviada") {
    await db
      .update(schema.proposals)
      .set({ status: "visualizada", updatedAt: new Date() })
      .where(eq(schema.proposals.id, proposal.id));

    proposal.status = "visualizada";

    await db.insert(schema.platformAuditLogs).values({
      id: randomUUID(),
      actorUserId: proposal.createdBy,
      action: "client_viewed_proposal",
      targetType: "proposal",
      targetId: proposal.id,
      metadata: {
        tenantId: proposal.tenantId,
        via: "public_url",
      },
    });
  }

  // Fetch attached documents if any
  let attachedDocs: Array<{ id: string; filename: string; fileUrl: string }> = [];
  if (proposal && Array.isArray(proposal.documentIds) && proposal.documentIds.length > 0) {
    attachedDocs = await db
      .select({
        id: schema.leadDocuments.id,
        filename: schema.leadDocuments.filename,
        fileUrl: schema.leadDocuments.fileUrl,
      })
      .from(schema.leadDocuments)
      .where(inArray(schema.leadDocuments.id, proposal.documentIds));
  }

  return { quote, proposal, attachedDocs };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const { quote, proposal } = await getProposalAndQuote(token);

  if (!quote && !proposal) return { title: "Proposta nao encontrada" };

  const name = proposal?.leadName || quote?.leadName || "CorreTop";
  const value = proposal?.totalMonthly || quote?.totalMonthly || "0.00";

  return {
    title: `Proposta — ${name}`,
    description: `Proposta de seguro de saude para ${name}. Valor mensal: ${value ? formatCurrency(Number(value)) : "a definir"}.`,
    robots: "noindex, nofollow",
  };
}

export default async function PublicQuotePage({ params }: Props) {
  const { token } = await params;
  const { quote, proposal, attachedDocs } = await getProposalAndQuote(token);

  if (!quote && !proposal) notFound();

  const statusLabel: Record<string, string> = {
    draft: "Rascunho",
    shared: "Compartilhada",
    sent: "Enviada",
    viewed: "Visualizada",
    accepted: "Aceita",
    rejected: "Recusada",
    expired: "Expirada",
    // Proposal statuses
    rascunho: "Rascunho",
    em_revisao: "Em revisao",
    enviada: "Enviada",
    visualizada: "Visualizada",
    negociacao: "Em negociacao",
    aprovada: "Aprovada",
    perdida: "Perdida",
    expirada: "Expirada",
  };

  const currentStatus = proposal?.status || quote?.status || "draft";
  const displayTitle = proposal?.title || "Proposta de Seguro de Saude";
  const displayNotes = proposal?.notes || quote?.notes || null;
  const displayDate = proposal?.createdAt || quote?.createdAt || new Date();
  const totalMonthly = proposal?.totalMonthly || quote?.totalMonthly || null;
  const beneficiaryCount = proposal?.beneficiaryCount || quote?.beneficiaryCount || null;
  const leadPhone = proposal?.leadPhone || quote?.leadPhone || null;
  const leadName = proposal?.leadName || quote?.leadName || "";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{displayTitle}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Proposta preparada para <strong className="text-foreground">{leadName}</strong>
          </p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <Badge variant="outline" className="text-xs">
              {statusLabel[currentStatus] ?? currentStatus}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(displayDate))}
            </span>
          </div>
        </div>

        {/* Summary */}
        {(totalMonthly || beneficiaryCount) && (
          <div className="mb-8 rounded-xl border border-primary/20 bg-primary/5 p-6 text-center">
            {beneficiaryCount && (
              <p className="text-sm text-muted-foreground">{beneficiaryCount} beneficiario(s)</p>
            )}
            {totalMonthly && (
              <p className="mt-1 text-3xl font-bold text-primary">{formatCurrency(Number(totalMonthly))}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">valor mensal estimado</p>
          </div>
        )}

        {/* Validity */}
        {proposal?.validUntil && (
          <div className="mb-8 rounded-lg border border-warning/30 bg-warning/5 p-4 text-center text-xs text-warning">
            Esta proposta e valida ate o dia{" "}
            <strong>
              {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(proposal.validUntil))}
            </strong>
          </div>
        )}

        {/* Items */}
        {quote && quote.items && quote.items.length > 0 && (
          <div className="mb-8 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Planos</h2>
            {quote.items.map((item: any) => (
              <div key={item.id} className="rounded-lg border border-border/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {(item.snapshot as Record<string, string>)?.planName ?? item.planId}
                  </span>
                  <span className="text-sm font-semibold text-primary">
                    {formatCurrency(Number(item.monthlyPrice))}/mes
                  </span>
                </div>
                {item.recommended && (
                  <Badge variant="secondary" className="mt-2 text-[10px]">
                    Recomendado
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Line Items (per beneficiary) */}
        {quote && quote.lineItems && quote.lineItems.length > 0 && (
          <div className="mb-8 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Detalhamento por beneficiario
            </h2>
            {quote.lineItems.map((item: any) => (
              <div key={item.id} className="rounded-lg border border-border/60 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">
                      {(item.snapshot as Record<string, string>)?.beneficiaryName ?? item.beneficiaryId}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">{item.ageAtQuote} anos</span>
                  </div>
                  <span className="text-sm font-semibold text-primary">
                    {formatCurrency(Number(item.calculatedValue))}/mes
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Plano: {(item.snapshot as Record<string, string>)?.planName ?? item.planId}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        {displayNotes && (
          <div className="mb-8 rounded-lg border border-border/40 bg-muted/30 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Observacoes
            </h2>
            <p className="text-sm text-foreground whitespace-pre-wrap">{displayNotes}</p>
          </div>
        )}

        {/* Attached Documents */}
        {attachedDocs.length > 0 && (
          <div className="mb-8 rounded-lg border border-border/40 p-4 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Documentos de Apoio Anexados
            </h2>
            <div className="space-y-2">
              {attachedDocs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-2 rounded bg-muted/20 border border-border/20 text-xs">
                  <span className="font-medium text-foreground">{doc.filename}</span>
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Visualizar Documento
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="text-center space-y-3">
          <p className="text-xs text-muted-foreground">
            Esta proposta e uma estimativa. O valor final pode variar conforme a analise da operadora.
          </p>
          {leadPhone && (
            <a
              href={`https://wa.me/${leadPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
                `Ola! Recebi a proposta "${displayTitle}". Gostaria de prosseguir.`
              )}`}
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
            Proposta gerada pela Ancora Corretora. Este documento nao substitui a analise formal da operadora.
          </p>
        </div>
      </div>
    </div>
  );
}
