"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, type TargetAndTransition, type Transition } from "motion/react";
import { CheckIcon, ChevronLeftIcon } from "lucide-react";

import { motionTokens } from "@/components/arc/lib/motion-tokens";
import { ROTULO_PASSO, type Passo } from "./cotacao-lite-model";

/** Cabeçalho do fluxo: voltar, progresso dos passos e rótulo do passo atual. */
export function ProgressoPassos({
  passos,
  atual,
  onVoltar,
}: {
  passos: readonly Passo[];
  atual: Passo;
  onVoltar?: () => void;
}) {
  const indice = passos.indexOf(atual);
  return (
    <header className="grid gap-3">
      <div className="flex items-center gap-3">
        {onVoltar ? (
          <button
            type="button"
            onClick={onVoltar}
            aria-label="Voltar ao passo anterior"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-background transition-transform active:scale-[0.97]"
          >
            <ChevronLeftIcon aria-hidden strokeWidth={1.5} className="size-5" />
          </button>
        ) : (
          <span className="size-11 shrink-0" aria-hidden />
        )}
        <ol aria-label="Progresso da cotação" className="flex flex-1 gap-1.5">
          {passos.map((passo, posicao) => (
            <li
              key={passo}
              aria-current={posicao === indice ? "step" : undefined}
              className={`h-1.5 flex-1 rounded-full transition-colors ${posicao <= indice ? "bg-primary" : "bg-border"}`}
            >
              <span className="sr-only">{ROTULO_PASSO[passo]}{posicao < indice ? ", concluído" : ""}</span>
            </li>
          ))}
        </ol>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Passo {indice + 1} de {passos.length} · {ROTULO_PASSO[atual]}
      </p>
    </header>
  );
}

/** Resumo do que já foi escolhido, em chips de leitura (não editáveis aqui). */
export function ResumoEscolhas({ itens }: { itens: string[] }) {
  if (itens.length === 0) return null;
  return (
    <ul aria-label="Escolhas até aqui" className="flex flex-wrap gap-2">
      {itens.map(item => (
        <li key={item} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          {item}
        </li>
      ))}
    </ul>
  );
}

/** Opção de escolha única: estado selecionado com ícone e contraste, não só cor. */
export function Opcao({
  selecionada,
  onSelect,
  icone,
  children,
}: {
  selecionada: boolean;
  onSelect: () => void;
  icone?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selecionada}
      onClick={onSelect}
      className={`flex min-h-12 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors active:scale-[0.99] ${
        selecionada ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted"
      }`}
    >
      {icone ? <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">{icone}</span> : null}
      <span className="min-w-0 flex-1 break-words">{children}</span>
      {selecionada ? <CheckIcon aria-hidden strokeWidth={2} className="size-5 shrink-0 text-primary" /> : null}
    </button>
  );
}

/**
 * Passo do fluxo: entra e sai com deslize curto e fade. Com movimento reduzido, só fade.
 * `direcao` 1 avança, -1 volta.
 */
export function PassoAnimado({ chave, direcao, children }: { chave: string; direcao: 1 | -1; children: ReactNode }) {
  const reduzir = useReducedMotion();
  const deslocamento = reduzir ? 0 : motionTokens.distance.lg * direcao;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={chave}
        initial={{ opacity: 0, x: deslocamento }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -deslocamento }}
        transition={{ duration: reduzir ? motionTokens.duration.instant : motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/** Entrada escalonada para os cartões de resultado. Limita o atraso total para não parecer lento. */
export function entradaEscalonada(indice: number, reduzir: boolean | null): { initial: TargetAndTransition; animate: TargetAndTransition; transition: Transition } {
  if (reduzir) return { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: motionTokens.duration.instant } };
  const atraso = Math.min(indice, motionTokens.stagger.max - 1) * motionTokens.stagger.item;
  return {
    initial: { opacity: 0, y: motionTokens.distance.md },
    animate: { opacity: 1, y: 0 },
    transition: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter], delay: atraso },
  };
}

export const MensagemErro = ({ texto }: { texto: string }) => (
  <p role="alert" className="text-sm text-destructive">{texto}</p>
);
