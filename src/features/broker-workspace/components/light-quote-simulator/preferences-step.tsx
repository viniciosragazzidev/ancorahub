"use client";

import { ChipGroup } from "@/components/arc/chip-group/chip-group";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Slider } from "@/components/arc/slider/slider";
import { HOSPITALS, type Accommodation, type Copayment, type Coverage } from "@/features/broker-workspace/quote-simulator/mock-data";

import { BUDGET_MAX, BUDGET_MIN, money } from "./constants";
import type { QuoteSimulator } from "./use-quote-simulator";

const card = "flex flex-col gap-5 rounded-3xl bg-(--surface) p-5 shadow-(--shadow-resting)";

function Field({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-(--foreground)">{title}</p>
      {children}
    </div>
  );
}

/** Step 2: coverage preferences, wished hospitals and the monthly budget. */
export function PreferencesStep({ q }: { q: QuoteSimulator }) {
  return (
    <section aria-labelledby="preferences-heading" className={card}>
      <div>
        <h2 id="preferences-heading" className="text-lg font-semibold text-(--foreground)">Preferências de cobertura</h2>
        <p className="mt-1 text-sm text-(--text-secondary)">Ajuste o perfil para filtrar os exemplos disponíveis.</p>
      </div>

      <Field title="Acomodação">
        <SegmentedControl
          label="Acomodação"
          options={[{ value: "ward", label: "Enfermaria" }, { value: "private", label: "Apartamento" }]}
          value={q.accommodation}
          onValueChange={(value) => q.setAccommodation(value as Accommodation)}
        />
      </Field>
      <Field title="Coparticipação">
        <SegmentedControl
          label="Coparticipação"
          options={[{ value: "none", label: "Sem" }, { value: "partial", label: "Parcial" }, { value: "full", label: "Total" }]}
          value={q.copayment}
          onValueChange={(value) => q.setCopayment(value as Copayment)}
        />
      </Field>
      <Field title="Abrangência">
        <SegmentedControl
          label="Abrangência"
          options={[{ value: "regional", label: "Regional" }, { value: "state", label: "Estadual" }, { value: "national", label: "Nacional" }]}
          value={q.coverage}
          onValueChange={(value) => q.setCoverage(value as Coverage)}
        />
      </Field>
      <Field title="Odontologia na estimativa">
        <SegmentedControl
          label="Odontologia na estimativa"
          options={[{ value: "no", label: "Sem odontologia" }, { value: "yes", label: "Incluir odontologia" }]}
          value={q.includeDental ? "yes" : "no"}
          onValueChange={(value) => q.setIncludeDental(value === "yes")}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <div>
          <p className="text-sm font-medium text-(--foreground)">Hospitais desejados</p>
          <p className="mt-1 text-sm text-(--text-secondary)">A lista serve para comparar exemplos de rede e não confirma credenciamento.</p>
        </div>
        <ChipGroup
          label="Hospitais desejados"
          options={HOSPITALS.map((hospital) => ({ value: hospital, label: hospital }))}
          value={q.selectedHospitals}
          onValueChange={q.setSelectedHospitals}
        />
      </div>

      <Slider
        label="Orçamento mensal máximo"
        min={BUDGET_MIN}
        max={BUDGET_MAX}
        step={50}
        value={q.budget}
        onValueChange={q.setBudget}
        format={money}
      />
    </section>
  );
}
