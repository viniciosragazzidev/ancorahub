"use client";

/**
 * Mascote da Âncora Saúde (docs/design-system/MASCOTE.md). Um componente para todo o app:
 *
 *   <Mascot state="lead_accepted" size={160} />
 *
 * - Com MASCOT_RIVE.src definido e movimento ligado, carrega o personagem articulado da Rive por import
 *   dinâmico (nada pesa no carregamento inicial) e mostra a arte de reserva até ele ficar pronto.
 * - Sem .riv, com movimento reduzido, "Menos animação" ou o kill-switch: arte de reserva (WebP local).
 *   O movimento da reserva é provisório (mascot-motion.ts).
 * - A caixa tem tamanho fixo: trocar de estado nunca mexe no layout.
 */
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { motion } from "motion/react";

import { useInterfaceMotionEnabled } from "@/components/motion/interface-motion-provider";
import { prefersLessMotion } from "@/features/assist/a11y-prefs";
import { cn } from "@/lib/utils";

import { MASCOT_ART, MASCOT_BOX_RATIO, MASCOT_LABELS, MASCOT_RIVE, MASCOT_STATE_ART, type MascotState } from "./mascot-config";
import { mascotMotion } from "./mascot-motion";

const MascotRive = dynamic(() => import("./mascot-rive"), { ssr: false });

export interface MascotProps {
  state?: MascotState;
  /** Altura em px. A largura sai da proporção fixa do mascote. */
  size?: number;
  /** Decorativo (o texto ao lado já diz o que aconteceu): esconde do leitor de tela. */
  decorative?: boolean;
  /** Muda a cada novo evento do mesmo estado (ex.: segundo lead aceito) para repetir a animação. */
  playKey?: string | number;
  /** Carrega a imagem com prioridade (splash, topo da tela). */
  priority?: boolean;
  className?: string;
  /** Fonte do .riv (testes e prévia). Padrão: MASCOT_RIVE.src. */
  riveSrc?: string | null;
}

export function Mascot({ state = "idle", size = 160, decorative = false, playKey, priority = false, className, riveSrc = MASCOT_RIVE.src }: MascotProps) {
  const interfaceMotion = useInterfaceMotionEnabled();
  const [lessMotion, setLessMotion] = useState(false);
  useEffect(() => { setLessMotion(prefersLessMotion()); }, []);
  const motionOn = interfaceMotion && !lessMotion;

  const [riveState, setRiveState] = useState<"off" | "loading" | "ready" | "failed">("off");
  const useRive = Boolean(riveSrc) && motionOn && riveState !== "failed";

  const art = MASCOT_ART[MASCOT_STATE_ART[state]];
  const preset = mascotMotion(state, motionOn);
  const width = Math.round(size * MASCOT_BOX_RATIO);

  return (
    <span
      className={cn("relative inline-flex shrink-0 items-end justify-center", className)}
      style={{ width, height: size }}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : MASCOT_LABELS[state]}
      aria-hidden={decorative || undefined}
      data-mascot-state={state}
      data-mascot-renderer={useRive && riveState === "ready" ? "rive" : "fallback"}
    >
      {!(useRive && riveState === "ready") ? (
        <motion.img
          key={`${state}-${playKey ?? ""}`}
          src={art.src}
          width={art.width}
          height={art.height}
          alt=""
          draggable={false}
          decoding="async"
          fetchPriority={priority ? "high" : undefined}
          initial={preset.initial}
          animate={preset.animate}
          transition={preset.transition}
          style={{ height: "100%", width: "auto", maxWidth: "100%", objectFit: "contain", transformOrigin: "50% 100%", userSelect: "none" }}
        />
      ) : null}
      {useRive && riveSrc ? (
        <span className="absolute inset-0" style={{ opacity: riveState === "ready" ? 1 : 0 }}>
          <MascotRive
            src={riveSrc}
            state={state}
            onReady={() => setRiveState("ready")}
            onFail={() => setRiveState("failed")}
          />
        </span>
      ) : null}
    </span>
  );
}
