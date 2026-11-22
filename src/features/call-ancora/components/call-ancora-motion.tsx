"use client";

import { useId, useMemo, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import QRCode from "qrcode-generator";
import { Smartphone } from "lucide-react";

import { motionTokens } from "@/components/arc/motion-tokens";
import { easeEnter, easeStandard, reducedFade } from "@/components/lite/motion/shared";
import { useMotionAllowed } from "@/components/motion/use-motion-allowed";

import type { CallStatus } from "../session-store";

/**
 * Peças animadas do Call Âncora. Toda curva e duração sai de motion-tokens.ts;
 * com movimento reduzido (sistema, "Menos animação" ou kill-switch) cada peça aparece pronta,
 * só com fade curto, sem deslocamento, mola ou repetição.
 */

export const contactInitials = (name: string) => name.split(" ").map((part) => part[0]).slice(0, 2).join("");

type QrShape = { size: number; data: string; finders: Array<[row: number, col: number]> };

/** Matriz do QR em um único caminho SVG; os três quadrados de posição saem à parte para entrar primeiro. */
export function buildQrShape(value: string): QrShape {
  const qr = QRCode(0, "M");
  qr.addData(value);
  qr.make();
  const size = qr.getModuleCount();
  const finders: QrShape["finders"] = [[0, 0], [0, size - 7], [size - 7, 0]];
  const inFinder = (row: number, col: number) => finders.some(([fr, fc]) => row >= fr && row < fr + 7 && col >= fc && col < fc + 7);
  let data = "";
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (qr.isDark(row, col) && !inFinder(row, col)) data += `M${col} ${row}h1v1h-1z`;
    }
  }
  return { size, data, finders };
}

const QR_WIPE = motionTokens.duration.considered + motionTokens.duration.draw;
const QR_DATA_DELAY = motionTokens.stagger.line * 3;

/**
 * QR de pareamento que aparece em três tempos: o visor encaixa, os quadrados de posição surgem
 * em cascata e os módulos são revelados de cima para baixo, com uma linha de leitura que passa uma vez.
 */
export function PairingQr({ value, expired, label }: { value: string; expired: boolean; label: string }) {
  const reduce = !useMotionAllowed();
  const qr = useMemo(() => buildQrShape(value), [value]);
  const clipId = useId().replace(/:/g, "");
  const box = qr.size + 2;

  return (
    <div className="relative mx-auto grid size-64 place-items-center">
      {(["tl", "tr", "bl", "br"] as const).map((corner) => <QrCorner key={`${value}-${corner}`} corner={corner} reduce={reduce} />)}
      <div className="relative size-52 overflow-hidden rounded-xl bg-white">
        <motion.svg
          key={value}
          role="img"
          aria-label={label}
          viewBox={`-1 -1 ${box} ${box}`}
          className="size-full"
          initial={false}
          animate={{ opacity: expired ? 0.18 : 1, filter: expired && !reduce ? `blur(${motionTokens.blur.soft}px)` : "blur(0px)" }}
          transition={reduce ? reducedFade : { duration: motionTokens.duration.standard, ease: easeStandard }}
        >
          <defs>
            <clipPath id={clipId}>
              <motion.rect
                x={-1}
                y={-1}
                width={box}
                initial={{ height: reduce ? box : 0 }}
                animate={{ height: box }}
                transition={reduce ? { duration: 0 } : { duration: QR_WIPE, ease: easeStandard, delay: QR_DATA_DELAY }}
              />
            </clipPath>
          </defs>
          {qr.finders.map(([row, col], index) => (
            <motion.g
              key={`${row}-${col}`}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={reduce ? reducedFade : { ...motionTokens.spring.snappy, delay: index * motionTokens.stagger.line }}
            >
              <rect x={col + 0.5} y={row + 0.5} width={6} height={6} rx={1.7} fill="none" stroke="#0a0a0a" strokeWidth={1} />
              <rect x={col + 2} y={row + 2} width={3} height={3} rx={0.9} fill="#0a0a0a" />
            </motion.g>
          ))}
          <path d={qr.data} fill="#0a0a0a" clipPath={`url(#${clipId})`} shapeRendering="crispEdges" />
        </motion.svg>
        {reduce ? null : (
          <motion.span
            key={`scan-${value}`}
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 h-10 -translate-y-full border-b-2 border-(--primary) bg-linear-to-b from-transparent to-(--primary)/15"
            initial={{ top: "0%", opacity: 0 }}
            animate={{ top: "100%", opacity: [0, 1, 1, 0] }}
            transition={{ duration: QR_WIPE, ease: easeStandard, delay: QR_DATA_DELAY, opacity: { duration: QR_WIPE, delay: QR_DATA_DELAY, times: [0, 0.12, 0.82, 1] } }}
          />
        )}
      </div>
    </div>
  );
}

const CORNER_CLASS = {
  tl: "left-0 top-0 rounded-tl-2xl border-l-2 border-t-2",
  tr: "right-0 top-0 rounded-tr-2xl border-r-2 border-t-2",
  bl: "bottom-0 left-0 rounded-bl-2xl border-b-2 border-l-2",
  br: "bottom-0 right-0 rounded-br-2xl border-b-2 border-r-2",
} as const;

function QrCorner({ corner, reduce }: { corner: keyof typeof CORNER_CLASS; reduce: boolean }) {
  const away = motionTokens.distance.md;
  const x = corner.endsWith("l") ? -away : away;
  const y = corner.startsWith("t") ? -away : away;
  return (
    <motion.span
      aria-hidden="true"
      className={`absolute size-9 border-(--primary) ${CORNER_CLASS[corner]}`}
      initial={reduce ? { opacity: 0 } : { opacity: 0, x, y }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={reduce ? reducedFade : motionTokens.spring.smooth}
    />
  );
}

/** Barra que esvazia até o QR vencer; anda de segundo em segundo, sem animar com movimento reduzido. */
export function ExpiryBar({ ratio }: { ratio: number }) {
  const reduce = !useMotionAllowed();
  return (
    <div aria-hidden="true" className="h-1 w-full overflow-hidden rounded-full bg-(--surface-muted)">
      <motion.div
        className="h-full origin-left rounded-full bg-(--primary)"
        initial={false}
        animate={{ scaleX: Math.max(0, Math.min(1, ratio)) }}
        transition={reduce ? { duration: 0 } : { duration: 1, ease: "linear" }}
      />
    </div>
  );
}

/** Entrada em camadas no ritmo do FEEDBACK.md: visual na hora, texto +80 ms, número +160 ms. */
export function Beat({ at = "visual", children, className }: { at?: keyof typeof motionTokens.beat; children: ReactNode; className?: string }) {
  const reduce = !useMotionAllowed();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: motionTokens.distance.sm }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? reducedFade : { duration: motionTokens.duration.standard, ease: easeEnter, delay: motionTokens.beat[at] }}
    >
      {children}
    </motion.div>
  );
}

/** Momento curto entre o QR e a sessão: o celular ganha o check e a fila se prepara. */
export function ConnectedMoment({ brokerFirstName }: { brokerFirstName: string }) {
  const reduce = !useMotionAllowed();
  return (
    <section role="status" aria-live="polite" className="mx-auto flex min-h-[min(58vh,520px)] max-w-3xl flex-col items-center justify-center rounded-2xl border border-(--border) bg-(--surface) px-6 py-14 text-center">
      <span className="relative inline-flex">
        <motion.span
          className="grid size-20 place-items-center rounded-2xl bg-(--success)/10 text-(--success)"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: motionTokens.scale.popIn }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduce ? reducedFade : motionTokens.spring.snappy}
        >
          <Smartphone className="size-9" aria-hidden="true" />
        </motion.span>
        {reduce ? null : (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-(--success)"
            initial={{ opacity: motionTokens.attention.opacity, scale: 1 }}
            animate={{ opacity: 0, scale: 1.35 }}
            transition={{ duration: motionTokens.attention.duration, ease: easeStandard, delay: motionTokens.beat.text }}
          />
        )}
        <motion.span
          aria-hidden="true"
          className="absolute -bottom-2 -right-2 grid size-8 place-items-center rounded-full border-2 border-(--surface) bg-(--success) text-white"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduce ? reducedFade : { ...motionTokens.spring.snappy, delay: motionTokens.beat.text }}
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={reduce ? { duration: 0 } : { duration: motionTokens.duration.draw, ease: easeStandard, delay: motionTokens.beat.number }} />
          </svg>
        </motion.span>
      </span>
      <h2 className="mt-8 text-3xl font-semibold tracking-tight text-(--foreground)">Celular conectado</h2>
      <p className="mt-3 text-xl font-medium text-(--foreground)"><NameReveal text={`Olá, ${brokerFirstName}!`} delay={motionTokens.beat.text} /></p>
      <Beat at="after"><p className="mt-3 max-w-sm text-sm leading-6 text-(--text-secondary)">Preparando a sua fila…</p></Beat>
    </section>
  );
}

/** Fila da sessão em segmentos: feitos, o atual (mais largo) e os que faltam. Na entrada, os segmentos chegam em cascata. */
export function QueueTrack({ total, done }: { total: number; done: number }) {
  const reduce = !useMotionAllowed();
  return (
    <div aria-hidden="true" className="flex items-center gap-1">
      {Array.from({ length: total }, (_, index) => {
        const tone = index < done ? "w-2 bg-(--primary)/35" : index === done ? "w-6 bg-(--primary)" : "w-2 bg-(--border)";
        return (
          <motion.span
            key={index}
            layout={!reduce}
            className={`h-1.5 rounded-full ${tone}`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reduce ? reducedFade : { default: { duration: motionTokens.duration.exit, ease: easeEnter, delay: motionTokens.beat.number + index * motionTokens.stagger.char }, layout: motionTokens.spring.morph }}
          />
        );
      })}
    </div>
  );
}

/** Troca no mesmo lugar com direção: o que sai vai para a esquerda, o que chega vem da direita. */
/**
 * Nome que chega letra por letra: cada letra sobe e desfoca para nítida, em cascata curta.
 * O leitor de tela recebe o nome inteiro de uma vez (as letras ficam ocultas para ele).
 */
export function NameReveal({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  const reduce = !useMotionAllowed();
  const words = text.split(" ");
  if (reduce) {
    return <motion.span className={className} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={reducedFade}>{text}</motion.span>;
  }
  let index = 0;
  return (
    <span className={className} aria-label={text}>
      {words.map((word, wordIndex) => (
        <span key={`${word}-${wordIndex}`} aria-hidden="true" className="inline-block whitespace-nowrap">
          {Array.from(word).map((letter) => {
            const at = index++;
            return (
              <motion.span
                key={at}
                className="inline-block"
                initial={{ opacity: 0, y: "0.45em", filter: `blur(${motionTokens.blur.subtle * 2}px)` }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ ...motionTokens.spring.smooth, delay: delay + at * LETTER_STAGGER }}
              >
                {letter}
              </motion.span>
            );
          })}
          {wordIndex < words.length - 1 ? " " : null}
        </span>
      ))}
    </span>
  );
}

/** Intervalo entre letras do nome: rápido o bastante para um nome longo não passar de ~0,6 s. */
const LETTER_STAGGER = 0.028;

export function SlideSwap({ swapKey, children, className, axis = "x" }: { swapKey: string; children: ReactNode; className?: string; axis?: "x" | "y" }) {
  const reduce = !useMotionAllowed();
  const far = axis === "x" ? motionTokens.distance.sheet : motionTokens.distance.md;
  const blur = `blur(${motionTokens.blur.subtle}px)`;
  const at = (offset: number) => (axis === "x" ? { x: offset } : { y: offset });
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={swapKey}
        className={className}
        initial={reduce ? { opacity: 0 } : { opacity: 0, ...at(far), filter: blur }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, ...at(0), filter: "blur(0px)" }}
        exit={reduce ? { opacity: 0, transition: reducedFade } : { opacity: 0, ...at(-far), filter: blur, transition: { duration: motionTokens.duration.exit, ease: easeStandard } }}
        transition={reduce ? reducedFade : { duration: motionTokens.duration.standard + motionTokens.duration.instant, ease: easeEnter }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/** Iniciais do contato com o estado da ligação no anel: ondas enquanto disca ou chama, anel verde em ligação. */
export function CallAvatar({ name, status }: { name: string; status: CallStatus }) {
  const reduce = !useMotionAllowed();
  const calling = status === "dialing" || status === "ringing";
  return (
    <span className="relative grid size-24 place-items-center">
      {calling && !reduce ? [0, 1].map((wave) => (
        <motion.span
          key={`${status}-${wave}`}
          aria-hidden="true"
          className="absolute inset-0 rounded-full border-2 border-(--primary)"
          initial={{ opacity: motionTokens.attention.opacity, scale: 1 }}
          animate={{ opacity: 0, scale: 1.45 }}
          transition={{ duration: motionTokens.attention.duration * 2, ease: easeStandard, repeat: Infinity, delay: wave * motionTokens.attention.duration }}
        />
      )) : null}
      <motion.span
        aria-hidden="true"
        className="absolute inset-0 rounded-full border-2"
        initial={false}
        animate={{ borderColor: status === "active" ? "var(--success)" : calling ? "var(--primary)" : "var(--border)" }}
        transition={reduce ? reducedFade : { duration: motionTokens.duration.standard, ease: easeStandard }}
      />
      <span className="grid size-20 place-items-center rounded-full bg-(--accent-subtle) text-2xl font-semibold text-(--accent-strong)">{contactInitials(name)}</span>
    </span>
  );
}

/** Texto curto que troca no lugar (status da ligação, rótulos). */
export function SwapText({ value, className }: { value: string; className?: string }) {
  const reduce = !useMotionAllowed();
  return (
    <span className={`relative inline-grid ${className ?? ""}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: motionTokens.distance.xs }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: reducedFade }}
          transition={reduce ? reducedFade : { duration: motionTokens.duration.fast, ease: easeEnter }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Item que entra numa cascata, com atraso limitado a stagger.max (para a abertura da sessão). */
export function EnterInOrder({ index, children, className }: { index: number; children: ReactNode; className?: string }) {
  const reduce = !useMotionAllowed();
  const step = Math.min(index, motionTokens.stagger.max - 1);
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: motionTokens.distance.lg, filter: `blur(${motionTokens.blur.subtle}px)` }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={reduce ? reducedFade : { duration: motionTokens.duration.considered, ease: easeEnter, delay: step * motionTokens.stagger.line }}
    >
      {children}
    </motion.div>
  );
}
