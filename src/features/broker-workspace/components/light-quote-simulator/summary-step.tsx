"use client";

import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Input } from "@/components/arc/input/input";
import { SearchField } from "@/components/arc/search-field/search-field";
import { MOCK_LEADS } from "@/features/broker-workspace/quote-simulator/mock-data";

import { COVERAGE_LABEL, money, PROFILE_LABEL, REGION_LABEL } from "./constants";
import type { QuoteSimulator } from "./use-quote-simulator";

const card = "flex flex-col gap-4 rounded-3xl bg-(--surface) p-5 shadow-(--shadow-resting)";

/** Step 4: the chosen plan with the lives, plus share, print and a demo lead link. */
export function SummaryStep({ q }: { q: QuoteSimulator }) {
  const { chosenResult, finalMonthly, familyDiscount, profileType, region, coverage } = q;

  if (!chosenResult) {
    return (
      <EmptyState
        title="Nenhum plano escolhido"
        description="Escolha um plano na lista ou na comparação para montar o resumo."
        action={<Button variant="secondary" onClick={() => q.goToStep(2)}>Ver planos</Button>}
      />
    );
  }

  return (
    <section aria-labelledby="summary-heading" className="flex flex-col gap-4 print:block">
      <div className="print:hidden">
        <h2 id="summary-heading" className="text-lg font-semibold text-(--foreground)">Resumo demonstrativo</h2>
        <p className="mt-1 text-sm text-(--text-secondary)">Confira as vidas e a estimativa antes de compartilhar o exemplo.</p>
      </div>

      <div className={`${card} gap-5 print:p-0 print:shadow-none`}>
        <div>
          <Badge tone="neutral">{PROFILE_LABEL[profileType]}</Badge>
          <h3 className="mt-3 text-xl font-semibold text-(--foreground)">{chosenResult.plan.name}</h3>
          <p className="mt-1 text-sm text-(--text-secondary)">{chosenResult.plan.carrier}</p>
        </div>
        <dl className="grid grid-cols-2 gap-4 rounded-2xl bg-(--surface-muted) p-4 text-sm">
          <div>
            <dt className="text-(--text-secondary)">Mensalidade total demonstrativa</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums text-(--foreground)">{money(finalMonthly)}</dd>
          </div>
          <div>
            <dt className="text-(--text-secondary)">Primeira mensalidade estimada</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums text-(--foreground)">{money(finalMonthly)}</dd>
          </div>
          <div>
            <dt className="text-(--text-secondary)">Desconto demonstrativo</dt>
            <dd className="mt-1 font-medium text-(--foreground)">{familyDiscount > 0 ? "5% para exemplo PME" : "Não aplicado"}</dd>
          </div>
          <div>
            <dt className="text-(--text-secondary)">Região e cobertura</dt>
            <dd className="mt-1 font-medium text-(--foreground)">{REGION_LABEL[region]} · {COVERAGE_LABEL[coverage]}</dd>
          </div>
        </dl>
        <div>
          <h4 className="text-sm font-semibold text-(--foreground)">Beneficiários demonstrativos</h4>
          <ul className="mt-2 divide-y divide-(--border)">
            {chosenResult.pricing.beneficiaries.map((person, index) => (
              <li key={person.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="text-(--foreground)">
                  {index === 0 ? "Titular" : "Dependente " + index} · {person.age} anos{" "}
                  <span className="text-(--text-secondary)">({person.ageBandLabel})</span>
                </span>
                <span className="shrink-0 font-medium tabular-nums text-(--foreground)">{money(person.monthlyPrice)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-(--surface-muted) p-4 text-sm">
          <p className="font-medium text-(--foreground)">Valores simulados, sujeitos à análise da operadora.</p>
          <p className="mt-1 text-(--text-secondary)">
            Rede, carências, elegibilidade, reajustes e valores definitivos dependem da proposta e do contrato da operadora. Nenhum dado foi vinculado a um lead ou salvo no sistema.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 print:hidden">
        <section aria-label="Compartilhar ou imprimir" className={card}>
          <h3 className="text-base font-semibold text-(--foreground)">Compartilhar ou imprimir</h3>
          <Input
            label="Telefone com DDD (opcional)"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={q.phone}
            onChange={(event) => q.setPhone(event.target.value)}
            placeholder="Ex.: 5521999999999"
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" className="sm:flex-1" onClick={q.copySummary}>Copiar resumo</Button>
            <Button variant="secondary" className="sm:flex-1" onClick={() => window.print()}>Baixar PDF ou imprimir</Button>
          </div>
        </section>

        <section aria-label="Vincular a um lead" className={card}>
          <div>
            <h3 className="text-base font-semibold text-(--foreground)">Vincular a um lead</h3>
            <p className="mt-1 text-sm text-(--text-secondary)">Prévia visual com nomes de demonstração. Nenhum vínculo será gravado.</p>
          </div>
          <SearchField
            label="Buscar lead de exemplo"
            placeholder="Digite um nome"
            value={q.leadSearch}
            onValueChange={(value) => {
              q.setLeadSearch(value);
              q.setLeadLinkPreview(false);
            }}
          />
          <ul className="flex flex-col gap-2" aria-label="Leads demonstrativos">
            {q.matchingLeads.map((lead) => {
              const selected = q.selectedLeadId === lead.id;
              return (
                <li key={lead.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      q.setSelectedLeadId(lead.id);
                      q.setLeadLinkPreview(false);
                    }}
                    className={`flex min-h-14 w-full items-center justify-between gap-2 rounded-2xl px-4 text-left text-sm ${selected ? "bg-(--accent-subtle) text-(--accent-strong)" : "bg-(--surface-muted) text-(--foreground)"}`}
                  >
                    <span>
                      <span className="block font-medium">{lead.name}</span>
                      <span className="block text-(--text-secondary)">{lead.stage}</span>
                    </span>
                    {selected ? <span className="text-sm font-medium">Selecionado</span> : null}
                  </button>
                </li>
              );
            })}
            {q.matchingLeads.length === 0 ? <li className="px-2 py-3 text-sm text-(--text-secondary)">Nenhum lead demonstrativo encontrado.</li> : null}
          </ul>
          <Button variant="secondary" onClick={q.previewLeadLink}>Vincular a um lead</Button>
          {q.leadLinkPreview && q.selectedLeadId ? (
            <p className="text-sm text-(--accent-strong)" role="status">
              Prévia pronta: {MOCK_LEADS.find((lead) => lead.id === q.selectedLeadId)?.name}. Nada foi salvo.
            </p>
          ) : null}
        </section>
      </div>
    </section>
  );
}
