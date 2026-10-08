"use client";

import { ChevronDown } from "lucide-react";

import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { AGE_BANDS, type MockPlan } from "@/features/broker-workspace/quote-simulator/mock-data";
import { calculatePlanPricing, type PlanPricing, type PricingPreferences } from "@/features/broker-workspace/quote-simulator/pricing";

import { ACCOMMODATION_LABEL, COPAYMENT_LABEL, COVERAGE_LABEL, getNetworkMatch, money, percent } from "./constants";

function PlanAgeTable({ plan, preferences }: { plan: MockPlan; preferences: PricingPreferences }) {
  return (
    <details className="group border-t border-(--border) pt-3 text-sm">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 font-medium text-(--foreground)">
        Valores simulados por faixa etária
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-(--text-muted) transition-transform duration-(--duration-fast) group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {AGE_BANDS.map((band, index) => {
          const result = calculatePlanPricing(plan, preferences, [{ id: band.id, age: band.min }]);
          return (
            <div key={band.id} className="flex flex-col">
              <span className="text-sm text-(--text-secondary)">{band.label}</span>
              <span className="mt-0.5 font-medium tabular-nums text-(--foreground)">{money(result.monthlyTotal)}</span>
              <span className="text-sm tabular-nums text-(--text-muted)">índice simulado {plan.ageBandMultipliers[index].toFixed(2).replace(".", ",")}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-(--text-secondary)">A faixa indica uma estimativa de exemplo. A operadora define seus preços e regras contratuais.</p>
    </details>
  );
}

/** One simulated plan: the monthly total first, then the facts, with compare and choose actions. */
export function PlanCard({
  plan,
  pricing,
  preferences,
  selectedHospitals,
  isCheapest,
  isMostComplete,
  isCompared,
  onCompare,
  onChoose,
}: {
  plan: MockPlan;
  pricing: PlanPricing;
  preferences: PricingPreferences;
  selectedHospitals: readonly string[];
  isCheapest: boolean;
  isMostComplete: boolean;
  isCompared: boolean;
  onCompare: (checked: boolean) => void;
  onChoose: () => void;
}) {
  const matchingHospitals = getNetworkMatch(plan, selectedHospitals);
  return (
    <li className="flex flex-col gap-4 rounded-3xl bg-(--surface) p-5 shadow-(--shadow-resting)">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-(--text-secondary)">{plan.carrier}</p>
          <h3 className="mt-0.5 text-lg font-semibold tracking-tight text-(--foreground)">{plan.name}</h3>
          <p className="mt-0.5 text-sm text-(--text-secondary)">{plan.tier}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {isCheapest ? <Badge tone="success">Melhor custo</Badge> : null}
          {isMostComplete ? <Badge tone="info">Mais completo</Badge> : null}
          {selectedHospitals.length > 0 && matchingHospitals > 0 ? <Badge tone="neutral">Atende seus hospitais</Badge> : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-2xl bg-(--surface-muted) p-4">
        <div>
          <p className="text-sm text-(--text-secondary)">Total estimado por mês</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-(--foreground)">{money(pricing.monthlyTotal)}</p>
        </div>
        <div>
          <p className="text-sm text-(--text-secondary)">Média por vida</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-(--foreground)">{money(pricing.monthlyPerLife)}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div><dt className="text-(--text-secondary)">Acomodação</dt><dd className="mt-0.5 font-medium text-(--foreground)">{ACCOMMODATION_LABEL[preferences.accommodation]}</dd></div>
        <div><dt className="text-(--text-secondary)">Coparticipação</dt><dd className="mt-0.5 font-medium text-(--foreground)">{COPAYMENT_LABEL[preferences.copayment]}</dd></div>
        <div><dt className="text-(--text-secondary)">Abrangência</dt><dd className="mt-0.5 font-medium text-(--foreground)">{COVERAGE_LABEL[preferences.coverage]}</dd></div>
        <div><dt className="text-(--text-secondary)">Odontologia</dt><dd className="mt-0.5 font-medium text-(--foreground)">{plan.dentalIncluded || preferences.includeDental ? "Incluída na estimativa" : "Não incluída"}</dd></div>
      </dl>

      <div>
        <p className="text-sm text-(--text-secondary)">
          Rede de exemplo{selectedHospitals.length > 0 ? ` · ${matchingHospitals} de ${selectedHospitals.length} hospitais desejados` : ""}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-(--foreground)">{plan.hospitals.join(", ")}</p>
      </div>
      <p className="text-sm text-(--text-secondary)"><span className="font-medium text-(--foreground)">Carências:</span> {plan.waitingPeriodSummary}</p>
      <p className="text-sm text-(--text-secondary)"><span className="font-medium text-(--foreground)">Reajuste médio de referência:</span> {percent(plan.averageAnnualAdjustment)}% ao ano, valor demonstrativo.</p>
      <PlanAgeTable plan={plan} preferences={preferences} />

      <div className="flex flex-col gap-2 border-t border-(--border) pt-4 sm:flex-row">
        <Button variant="secondary" className="sm:flex-1" aria-pressed={isCompared} aria-label={(isCompared ? "Remover da comparação: " : "Comparar: ") + plan.name} onClick={() => onCompare(!isCompared)}>
          {isCompared ? "Na comparação" : "Comparar plano"}
        </Button>
        <Button variant="secondary" className="sm:flex-1" onClick={onChoose}>
          Escolher este plano
        </Button>
      </div>
    </li>
  );
}
