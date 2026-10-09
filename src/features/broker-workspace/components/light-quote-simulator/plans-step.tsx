"use client";

import { Button } from "@/components/arc/button/button";
import { ChipGroup } from "@/components/arc/chip-group/chip-group";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { ExpandableCard } from "@/components/arc/expandable-card/expandable-card";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Slider } from "@/components/arc/slider/slider";

import {
  ACCOMMODATION_LABEL,
  BUDGET_MAX,
  BUDGET_MIN,
  CARRIERS,
  COPAYMENT_LABEL,
  COVERAGE_LABEL,
  getNetworkMatch,
  lifeLabel,
  MAX_COMPARED,
  money,
  percent,
  PROFILE_LABEL,
  REGION_LABEL,
  SORT_OPTIONS,
  type SortMode,
} from "./constants";
import { PlanCard } from "./plan-card";
import type { QuoteSimulator } from "./use-quote-simulator";

function Facets({ q }: { q: QuoteSimulator }) {
  return (
    <div className="flex flex-col gap-5 pt-1">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-(--foreground)">Operadora</p>
        <ChipGroup
          label="Operadora"
          multiple={false}
          options={CARRIERS.map((carrier) => ({ value: carrier, label: carrier }))}
          value={q.carrierFilter === "all" ? [] : [q.carrierFilter]}
          onValueChange={(next) => q.setCarrierFilter(next[0] ?? "all")}
        />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-(--foreground)">Acomodação disponível</p>
        <ChipGroup
          label="Acomodação disponível"
          multiple={false}
          options={[{ value: "ward", label: "Enfermaria" }, { value: "private", label: "Apartamento" }]}
          value={q.accommodationFilter === "all" ? [] : [q.accommodationFilter]}
          onValueChange={(next) => q.setAccommodationFilter(next[0] ?? "all")}
        />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-(--foreground)">Coparticipação disponível</p>
        <ChipGroup
          label="Coparticipação disponível"
          multiple={false}
          options={[{ value: "none", label: "Sem coparticipação" }, { value: "partial", label: "Parcial" }, { value: "full", label: "Total" }]}
          value={q.copaymentFilter === "all" ? [] : [q.copaymentFilter]}
          onValueChange={(next) => q.setCopaymentFilter(next[0] ?? "all")}
        />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-(--foreground)">Ordenar por</p>
        <SegmentedControl label="Ordenar por" options={SORT_OPTIONS} value={q.sortMode} onValueChange={(value) => q.setSortMode(value as SortMode)} />
      </div>
      <Slider label="Preço máximo" min={BUDGET_MIN} max={BUDGET_MAX} step={50} value={q.budget} onValueChange={q.setBudget} format={money} />
    </div>
  );
}

type Row = { label: string; value: (result: QuoteSimulator["comparedResults"][number]) => string };

function CompareView({ q }: { q: QuoteSimulator }) {
  const { comparedResults, accommodation, copayment, coverage, includeDental, selectedHospitals } = q;

  if (comparedResults.length === 0) {
    return (
      <EmptyState
        title="Nenhum plano na comparação"
        description="Marque até três planos na lista para compará-los lado a lado."
        action={<Button variant="secondary" onClick={() => q.setPlansView("list")}>Ver planos</Button>}
      />
    );
  }

  const rows: Row[] = [
    { label: "Total por mês", value: (result) => money(result.pricing.monthlyTotal) },
    { label: "Média por vida", value: (result) => money(result.pricing.monthlyPerLife) },
    { label: "Acomodação", value: () => ACCOMMODATION_LABEL[accommodation] },
    { label: "Coparticipação", value: () => COPAYMENT_LABEL[copayment] },
    { label: "Abrangência", value: () => COVERAGE_LABEL[coverage] },
    { label: "Odontologia", value: (result) => (result.plan.dentalIncluded || includeDental ? "Sim, exemplo" : "Não") },
    { label: "Rede desejada", value: (result) => getNetworkMatch(result.plan, selectedHospitals) + " de " + selectedHospitals.length },
    { label: "Carências", value: (result) => result.plan.waitingPeriodSummary },
    { label: "Reajuste médio", value: (result) => percent(result.plan.averageAnnualAdjustment) + "% (exemplo)" },
  ];

  return (
    <>
      <div className="hidden overflow-hidden rounded-3xl bg-(--surface) shadow-(--shadow-resting) md:block">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <caption className="sr-only">Comparação dos planos demonstrativos selecionados</caption>
          <thead>
            <tr>
              <th scope="col" className="w-36 border-b border-(--border) p-4 text-sm font-normal text-(--text-secondary)">Detalhe</th>
              {comparedResults.map(({ plan }) => (
                <th scope="col" key={plan.id} className="border-b border-(--border) p-4 align-top">
                  <span className="block text-sm font-normal text-(--text-secondary)">{plan.carrier}</span>
                  <span className="mt-1 block font-semibold text-(--foreground)">{plan.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-(--border)">
                <th scope="row" className="p-4 text-sm font-normal text-(--text-secondary)">{row.label}</th>
                {comparedResults.map((result) => (
                  <td key={result.plan.id} className="p-4 align-top text-sm tabular-nums text-(--foreground)">{row.value(result)}</td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row" className="p-4 text-sm font-normal text-(--text-secondary)">Ação</th>
              {comparedResults.map(({ plan }) => (
                <td key={plan.id} className="p-4">
                  <Button variant="secondary" onClick={() => q.choosePlan(plan.id)}>Escolher plano</Button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {comparedResults.map((result) => (
          <li key={result.plan.id}>
            <ExpandableCard
              title={result.plan.name}
              description={`${result.plan.carrier} · ${money(result.pricing.monthlyTotal)} por mês`}
              defaultExpanded={comparedResults.length === 1}
            >
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 pb-4 text-sm">
                {rows.slice(1).map((row) => (
                  <div key={row.label} className={row.label === "Carências" ? "col-span-2" : undefined}>
                    <dt className="text-(--text-secondary)">{row.label}</dt>
                    <dd className="mt-0.5 font-medium text-(--foreground)">{row.value(result)}</dd>
                  </div>
                ))}
              </dl>
              <Button variant="secondary" className="w-full" onClick={() => q.choosePlan(result.plan.id)}>
                Escolher este plano
              </Button>
            </ExpandableCard>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Step 3: filtered plans, with the comparison of up to three of them. */
export function PlansStep({ q }: { q: QuoteSimulator }) {
  const { filteredResults, plansView, comparedIds, profileType, region, beneficiaries } = q;
  const maxCompleteness = Math.max(...filteredResults.map((result) => result.plan.completenessScore));

  return (
    <section aria-labelledby="plans-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="plans-heading" className="text-lg font-semibold text-(--foreground)">Planos de exemplo</h2>
        <p className="mt-1 text-sm text-(--text-secondary)">
          {PROFILE_LABEL[profileType]} · {REGION_LABEL[region]} · {lifeLabel(beneficiaries.length)}
        </p>
      </div>

      <SegmentedControl
        label="Visualização dos planos"
        options={[
          { value: "list", label: "Lista" },
          { value: "compare", label: "Comparar", accessory: comparedIds.length ? <span className="tabular-nums">{comparedIds.length}/{MAX_COMPARED}</span> : undefined },
        ]}
        value={plansView}
        onValueChange={(value) => q.setPlansView(value === "compare" ? "compare" : "list")}
      />

      {plansView === "compare" ? (
        <CompareView q={q} />
      ) : (
        <>
          <div className="print:hidden">
            <ExpandableCard
              title="Filtrar e ordenar"
              description={`Até ${money(q.budget)} · ${filteredResults.length} ${filteredResults.length === 1 ? "plano" : "planos"}`}
            >
              <Facets q={q} />
            </ExpandableCard>
          </div>

          {filteredResults.length === 0 ? (
            <EmptyState
              title="Nenhum exemplo corresponde a estes filtros"
              description="Aumente o orçamento máximo ou ajuste a região e as preferências para ver outras combinações simuladas."
              action={<Button variant="secondary" onClick={q.clearFilters}>Limpar filtros</Button>}
            />
          ) : (
            <ul className="grid min-w-0 gap-4 lg:grid-cols-2">
              {filteredResults.map(({ plan, pricing }, index) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  pricing={pricing}
                  preferences={q.preferences}
                  selectedHospitals={q.selectedHospitals}
                  isCheapest={index === 0 && q.sortMode === "price"}
                  isMostComplete={plan.completenessScore === maxCompleteness}
                  isCompared={comparedIds.includes(plan.id)}
                  onCompare={(checked) => q.toggleCompared(plan.id, checked)}
                  onChoose={() => q.choosePlan(plan.id)}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

