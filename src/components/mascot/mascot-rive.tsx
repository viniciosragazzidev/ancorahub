"use client";

/**
 * Personagem articulado via Rive (runtime MIT, @rive-app/react-canvas). Carregado só quando
 * MASCOT_RIVE.src existe e o movimento está ligado; o pacote entra por import dinâmico em mascot.tsx.
 * Liga o estado à entrada numérica da máquina de estados (MASCOTE.md §3).
 */
import { useEffect } from "react";
import { Layout, Fit, Alignment, useRive, useStateMachineInput } from "@rive-app/react-canvas";

import { MASCOT_RIVE, mascotStateIndex, type MascotState } from "./mascot-config";

export default function MascotRive({ src, state, onReady, onFail }: { src: string; state: MascotState; onReady: () => void; onFail: () => void }) {
  const { rive, RiveComponent } = useRive({
    src,
    artboard: MASCOT_RIVE.artboard,
    stateMachines: MASCOT_RIVE.stateMachine,
    autoplay: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.BottomCenter }),
    onLoad: onReady,
    onLoadError: onFail,
  });
  const input = useStateMachineInput(rive, MASCOT_RIVE.stateMachine, MASCOT_RIVE.stateInput);

  useEffect(() => {
    if (input) input.value = mascotStateIndex(state);
  }, [input, state]);

  return <RiveComponent aria-hidden="true" style={{ width: "100%", height: "100%" }} />;
}
