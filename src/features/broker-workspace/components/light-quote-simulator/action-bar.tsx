"use client";

import { Button } from "@/components/arc/button/button";

import { MAX_COMPARED } from "./constants";
import type { QuoteSimulator } from "./use-quote-simulator";

/** Fixed pill at the thumb: Voltar on the left and the one action of the current step on the right. */
export function QuoteActionBar({ q }: { q: QuoteSimulator }) {
  const { step, plansView, comparedIds, chosenResult } = q;

  let secondary: { label: string; onClick: () => void } | null = null;
  let primary: { label: string; onClick: () => void; disabled?: boolean };

  if (step === 0) {
    primary = { label: "Continuar", onClick: q.nextStep };
  } else if (step === 1) {
    secondary = { label: "Voltar", onClick: q.previousStep };
    primary = { label: "Ver planos", onClick: q.nextStep };
  } else if (step === 2) {
    secondary = { label: "Voltar", onClick: q.previousStep };
    primary =
      plansView === "compare"
        ? { label: "Voltar à lista", onClick: () => q.setPlansView("list") }
        : { label: `Comparar selecionados (${comparedIds.length}/${MAX_COMPARED})`, onClick: () => q.setPlansView("compare"), disabled: comparedIds.length === 0 };
  } else {
    secondary = { label: "Outro plano", onClick: () => q.goToStep(2) };
    primary = { label: "Enviar por WhatsApp", onClick: q.openWhatsApp, disabled: !chosenResult };
  }

  return (
    <nav
      aria-label="Ações da cotação"
      className="arc-venancor fixed inset-x-4 bottom-[calc(22px+var(--mobile-safe-bottom))] z-40 print:hidden md:left-[calc(72px+1rem)]"
    >
      <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-full bg-(--surface)/86 p-2 shadow-(--shadow-floating) backdrop-blur-xl backdrop-saturate-150">
        {secondary ? (
          <Button variant="secondary" onClick={secondary.onClick}>{secondary.label}</Button>
        ) : null}
        <Button className="flex-1" disabled={primary.disabled} onClick={primary.onClick}>{primary.label}</Button>
      </div>
    </nav>
  );
}
