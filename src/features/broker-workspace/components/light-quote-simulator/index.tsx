"use client";

import { Badge } from "@/components/arc/badge/badge";
import { Stepper } from "@/components/arc/stepper/stepper";

import { QuoteActionBar } from "./action-bar";
import { STEPS } from "./constants";
import { PlansStep } from "./plans-step";
import { PreferencesStep } from "./preferences-step";
import { ProfileStep } from "./profile-step";
import { SummaryStep } from "./summary-step";
import { useQuoteSimulator } from "./use-quote-simulator";

/**
 * Quote simulator of the broker app: four steps, one action at the thumb. Demo data
 * only (mock-data and pricing are unchanged), and the screen says so.
 */
export function LightQuoteSimulator() {
  const q = useQuoteSimulator();

  return (
    <div className="arc-venancor mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 pb-[calc(112px+var(--mobile-safe-bottom))] pt-2 sm:px-6 print:max-w-none print:px-0 print:pb-0 print:pt-0">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-(--text-secondary)">Compare exemplos de planos a partir das idades, região e preferências.</p>
        <Badge tone="neutral">Dados de exemplo</Badge>
      </div>

      <div className="print:hidden">
        <Stepper steps={STEPS} current={q.step} onStepSelect={q.goToStep} label="Etapas da simulação" />
      </div>

      <p role="note" className="rounded-2xl bg-(--surface) px-4 py-3 text-sm text-(--text-secondary) shadow-(--shadow-resting) print:hidden">
        <span className="font-medium text-(--foreground)">Valores simulados, sujeitos à análise da operadora.</span> Operadoras, planos, rede, reajustes, carências e preços são exemplos fictícios e não consultam o catálogo oficial do CorreTop. Esta simulação não é uma proposta comercial.
      </p>

      {q.error ? (
        <p role="alert" className="rounded-2xl bg-(--surface) px-4 py-3 text-sm font-medium text-(--danger) shadow-(--shadow-resting)">
          {q.error}
        </p>
      ) : null}

      <div className="min-w-0">
        {q.step === 0 ? <ProfileStep q={q} /> : null}
        {q.step === 1 ? <PreferencesStep q={q} /> : null}
        {q.step === 2 ? <PlansStep q={q} /> : null}
        {q.step === 3 ? <SummaryStep q={q} /> : null}
      </div>

      <QuoteActionBar q={q} />
    </div>
  );
}
