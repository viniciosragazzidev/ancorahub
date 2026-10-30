"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { QuoteBuilder } from "@/features/leads/components/quote-builder";
import { QuoteCard } from "@/features/leads/components/quote-card";
import { listLeadQuotesAction, type LeadQuoteListState } from "@/features/quotes/actions";
import { LeadCommercialValuesEditor } from "./lead-commercial-values-editor";
import type { LeadWorkspaceItem } from "./lead-workspace-types";

type QuoteOption = { id: string; name: string; monthlyPrice?: number };

export function LeadQuotesSection({
  leadId,
  leadName,
  leadPhone,
  beneficiaryCount,
  beneficiaries = [],
  plans = [],
  initialQuoteOpen = false,
  monthlyValue,
  livesCount,
  commercialValueSource,
  canDeleteQuotes = false,
  onLeadPatch,
}: {
  leadId: string;
  leadName: string;
  leadPhone?: string | null;
  beneficiaryCount?: number | null;
  beneficiaries?: Array<{ id: string; name: string; age?: number }>;
  plans?: QuoteOption[];
  initialQuoteOpen?: boolean;
  monthlyValue?: string | null;
  livesCount?: number | null;
  commercialValueSource?: "sale" | "proposal" | "lead" | null;
  canDeleteQuotes?: boolean;
  onLeadPatch?: (patch: Partial<LeadWorkspaceItem>) => void;
}) {
  const router = useRouter();
  const [list, setList] = useState<LeadQuoteListState>({ quotes: [] });
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(0);

  const refresh = useCallback(async () => {
    const loadId = ++loadRef.current;
    setLoading(true);
    const next = await listLeadQuotesAction(leadId);
    if (loadRef.current !== loadId) return;
    setList(next);
    setLoading(false);
  }, [leadId]);

  useEffect(() => {
    let active = true;
    const loadId = ++loadRef.current;
    void listLeadQuotesAction(leadId).then((next) => {
      if (active && loadRef.current === loadId) setList(next);
    }).finally(() => {
      if (active && loadRef.current === loadId) setLoading(false);
    });
    return () => { active = false; };
  }, [leadId]);

  const handleChanged = useCallback(() => {
    void refresh();
    router.refresh();
  }, [refresh, router]);
  const handleValuesSaved = useCallback((values: { monthlyValue: string | null; livesCount: number | null }) => {
    onLeadPatch?.(values);
  }, [onLeadPatch]);

  return (
    <section aria-labelledby={`lead-quotes-${leadId}`} className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`lead-quotes-${leadId}`} className="text-sm font-semibold text-foreground">Cotações</h3>
          <p className="mt-1 text-xs text-muted-foreground">Propostas salvas para este lead.</p>
        </div>
        <QuoteBuilder
          leadId={leadId}
          leadName={leadName}
          beneficiaryCount={beneficiaryCount}
          beneficiaries={beneficiaries}
          plans={plans}
          initialOpen={initialQuoteOpen}
          onCreated={handleChanged}
        />
      </header>

      <LeadCommercialValuesEditor
        leadId={leadId}
        monthlyValue={monthlyValue}
        livesCount={livesCount}
        lockedSource={commercialValueSource === "sale" || commercialValueSource === "proposal" ? commercialValueSource : null}
        onSaved={handleValuesSaved}
      />

      {loading ? <p role="status" className="py-2 text-sm text-muted-foreground">Carregando cotações…</p> : null}
      {!loading && list.error ? <p role="alert" className="py-2 text-sm text-danger">{list.error}</p> : null}
      {!loading && !list.error && list.quotes.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">Nenhuma cotação salva.</p>
      ) : null}
      {!loading && !list.error && list.quotes.length > 0 ? (
        <ul className="divide-y divide-border" aria-label="Cotações deste lead">
          {list.quotes.map((quote) => (
            <li key={quote.id} className="py-3 first:pt-0 last:pb-0">
              <QuoteCard
                quote={quote}
                leadName={leadName}
                leadPhone={leadPhone}
                canDelete={canDeleteQuotes}
                onChanged={handleChanged}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
