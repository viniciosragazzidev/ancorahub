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
 * - A caixa tem tamanho fixo e as duas poses ficam carregadas: trocar de estado nunca mexe no layout
 *   nem pisca em branco.
 */
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useAnimate } from "motion/react";

import { useInterfaceMotionEnabled } from "@/components/motion/interface-motion-provider";
import { prefersLessMotion } from "@/features/assist/a11y-prefs";
import { cn } from "@/lib/utils";

import { MASCOT_ART, MASCOT_BOX_RATIO, MASCOT_LABELS, MASCOT_RIVE, MASCOT_STATE_ART, MASCOT_STATE_VIDEO, MASCOT_VIDEO_FRAME, MASCOT_VIDEOS, type MascotArt, type MascotState } from "./mascot-config";
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

const ART_NAMES = Object.keys(MASCOT_ART) as MascotArt[];

export function Mascot({ state = "idle", size = 160, decorative = false, playKey, priority = false, className, riveSrc = MASCOT_RIVE.src }: MascotProps) {
  const interfaceMotion = useInterfaceMotionEnabled();
  const [lessMotion] = useState(() => prefersLessMotion());
  const motionOn = interfaceMotion && !lessMotion;

  const [riveState, setRiveState] = useState<"pending" | "ready" | "failed">("pending");
  const rive = Boolean(riveSrc) && motionOn && riveState !== "failed";
  const riveReady = rive && riveState === "ready";

  // Animação pré-gravada (Higgsfield): só com movimento ligado, tema claro (o branco do vídeo some com
  // multiply sobre superfícies claras) e enquanto o vídeo carrega sem erro. Até tocar, a arte de reserva fica visível.
  const [lightTheme, setLightTheme] = useState(false);
  useEffect(() => { setLightTheme(!document.documentElement.classList.contains("dark")); }, []);
  const [videoFailed, setVideoFailed] = useState(false);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const videoName = MASCOT_STATE_VIDEO[state];
  const videoKey = `${state}-${playKey ?? ""}`;
  const showVideo = Boolean(videoName) && motionOn && lightTheme && !videoFailed && !riveReady;
  const videoPlaying = showVideo && playingKey === videoKey;
  const videoHeight = size / MASCOT_VIDEO_FRAME.subjectHeight;

  const current = MASCOT_STATE_ART[state];
  const width = Math.round(size * MASCOT_BOX_RATIO);
  const [scope, animate] = useAnimate<HTMLSpanElement>();

  // Repete o movimento a cada troca de estado ou de playKey, sem recriar as imagens.
  useEffect(() => {
    const element = scope.current;
    if (!element) return;
    const preset = mascotMotion(state, motionOn);
    if (preset.initial) void animate(element, preset.initial, { duration: 0 });
    const controls = animate(element, preset.animate, preset.transition);
    return () => controls.stop();
  }, [animate, scope, state, playKey, motionOn]);

  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width, height: size }}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : MASCOT_LABELS[state]}
      aria-hidden={decorative || undefined}
      data-mascot-state={state}
      data-mascot-renderer={riveReady ? "rive" : videoPlaying ? "video" : "fallback"}
    >
      <span ref={scope} className="absolute inset-0" style={{ transformOrigin: "50% 100%", visibility: riveReady || videoPlaying ? "hidden" : undefined }}>
        {ART_NAMES.map((name) => {
          const art = MASCOT_ART[name];
          return (
            // eslint-disable-next-line @next/next/no-img-element -- arte local pequena; as duas poses ficam no DOM para a troca não piscar
            <img
              key={name}
              src={art.src}
              width={art.width}
              height={art.height}
              alt=""
              draggable={false}
              decoding="async"
              fetchPriority={priority && name === current ? "high" : undefined}
              data-art={name}
              data-visible={name === current ? "true" : "false"}
              className="absolute bottom-0 left-1/2 h-full w-auto max-w-none -translate-x-1/2 select-none object-contain"
              style={{ opacity: name === current ? 1 : 0 }}
            />
          );
        })}
      </span>
      {showVideo && videoName ? (
        <video
          key={videoKey}
          src={MASCOT_VIDEOS[videoName].src}
          poster={MASCOT_VIDEOS[videoName].poster}
          width={MASCOT_VIDEO_FRAME.width}
          height={MASCOT_VIDEO_FRAME.height}
          autoPlay
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          aria-hidden="true"
          data-mascot-video={videoName}
          onPlaying={() => setPlayingKey(videoKey)}
          onError={() => setVideoFailed(true)}
          className="pointer-events-none absolute left-1/2 max-w-none -translate-x-1/2 select-none"
          style={{ height: videoHeight, width: "auto", bottom: -videoHeight * MASCOT_VIDEO_FRAME.subjectBottom, mixBlendMode: "multiply", opacity: videoPlaying ? 1 : 0 }}
        />
      ) : null}
      {rive && riveSrc ? (
        <span className="absolute inset-0" style={{ opacity: riveReady ? 1 : 0 }}>
          <MascotRive src={riveSrc} state={state} onReady={() => setRiveState("ready")} onFail={() => setRiveState("failed")} />
        </span>
      ) : null}
    </span>
  );
}
