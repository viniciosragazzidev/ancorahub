"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3 } from "lucide-react";
import { Button } from "@/components/arc/button/button";

const MY_LEADS_ROUTE = "/minha-fila";

export function ExpiredOfferLandingScreen() {
  const router = useRouter();
  const [secondsRemaining, setSecondsRemaining] = useState(10);

  useEffect(() => {
    if (secondsRemaining === 0) {
      const timeout = window.setTimeout(() => router.replace(MY_LEADS_ROUTE), 250);
      return () => window.clearTimeout(timeout);
    }

    const timeout = window.setTimeout(() => {
      setSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [router, secondsRemaining]);

  return (
    <div className="arc-venancor mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <section
        aria-labelledby="expired-offer-title"
        className="rounded-3xl border border-(--border) bg-(--surface) p-6 shadow-(--shadow-resting) sm:p-8"
      >
        <div className="mx-auto flex max-w-lg flex-col items-center text-center">
          <div aria-hidden="true" className="mb-5 grid size-12 place-items-center rounded-2xl bg-(--surface-muted) text-(--text-secondary)">
            <Clock3 className="size-6" />
          </div>
          <p className="text-sm font-medium text-(--text-secondary)">Oferta encerrada</p>
          <h1 id="expired-offer-title" className="mt-2 text-2xl font-semibold tracking-tight text-(--foreground) sm:text-3xl">
            O prazo de aceite terminou
          </h1>
          <p className="mt-3 text-base leading-7 text-(--text-secondary)">
            Este lead foi redistribuído para outro corretor.
          </p>
          <p className="mt-5 text-sm text-(--text-secondary)" role="timer" aria-label={`Redirecionando em ${secondsRemaining} segundos`}>
            Redirecionando para Meus leads em <span className="font-semibold tabular-nums text-(--foreground)">{secondsRemaining}</span>s
          </p>
          <Button
            className="mt-6 min-h-11 w-full sm:w-auto"
            onClick={() => router.replace(MY_LEADS_ROUTE)}
          >
            Ir para Meus leads agora
          </Button>
        </div>
      </section>
    </div>
  );
}
