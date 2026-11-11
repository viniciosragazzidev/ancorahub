"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion, type TargetAndTransition, type Transition } from "motion/react";
import { ChevronLeftIcon, ClipboardListIcon, HouseIcon, PauseCircleIcon } from "lucide-react";

import { motionTokens } from "@/components/arc/lib/motion-tokens";

/** Cotação em pausa, no padrão Lite: cabeçalho com voltar, um aviso calmo e duas próximas ações. */
export function QuotePaused() {
  const router = useRouter();
  const reduzir = useReducedMotion();
  const entrada: { initial: TargetAndTransition; animate: TargetAndTransition; transition: Transition } = reduzir
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: motionTokens.duration.instant } }
    : { initial: { opacity: 0, y: motionTokens.distance.sm }, animate: { opacity: 1, y: 0 }, transition: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] } };

  return (
    <div className="arc-venancor mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pb-24 pt-4 sm:px-6">
      <header className="flex items-center gap-3">
        <Link
          href="/dashboard"
          aria-label="Voltar ao Início"
          className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-background transition-transform active:scale-[0.97]"
        >
          <ChevronLeftIcon aria-hidden strokeWidth={1.5} className="size-5" />
        </Link>
        <p className="text-sm text-muted-foreground">
          Cotação · <span role="status">Em pausa</span>
        </p>
      </header>

      <motion.section {...entrada} className="grid gap-5" aria-labelledby="cotacao-pausada-titulo">
        <span aria-hidden className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
          <PauseCircleIcon strokeWidth={1.5} className="size-7" />
        </span>
        <div className="grid gap-2">
          <h1 id="cotacao-pausada-titulo" className="text-2xl leading-tight font-medium tracking-tight text-balance">
            A Cotação está de folga
          </h1>
          <p className="text-sm text-pretty text-muted-foreground">
            Por enquanto não vamos fazer cotação pelo app. Quando ela voltar, eu aviso você aqui.
          </p>
        </div>

        <div role="group" aria-label="O que fazer enquanto isso" className="grid gap-2">
          <button
            type="button"
            onClick={() => router.push("/minha-fila")}
            className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-muted active:scale-[0.99]"
          >
            <ClipboardListIcon aria-hidden strokeWidth={1.5} className="size-5 text-muted-foreground" />
            <span className="flex-1">Ver meus leads</span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-muted active:scale-[0.99]"
          >
            <HouseIcon aria-hidden strokeWidth={1.5} className="size-5 text-muted-foreground" />
            <span className="flex-1">Voltar ao Início</span>
          </button>
        </div>
      </motion.section>
    </div>
  );
}
