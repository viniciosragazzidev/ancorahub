/**
 * Movimento PROVISÓRIO da arte de reserva, enquanto o rig da Rive não existe (MASCOTE.md §4).
 * É uma imagem inteira se movendo, não um personagem articulado: só entrada, salto curto, balanço e
 * respiração, com os tempos de motion-tokens. Quando MASCOT_RIVE.src existir, a Rive assume.
 */
import type { TargetAndTransition, Transition } from "motion/react";

import { motionTokens } from "@/components/arc/motion-tokens";

import type { MascotState } from "./mascot-config";

type Bezier = [number, number, number, number];
const easeStandard: Bezier = [...motionTokens.ease.standard];
const easeEnter: Bezier = [...motionTokens.ease.enter];

export type MascotMotion = { initial?: TargetAndTransition | false; animate: TargetAndTransition; transition: Transition };

const REST: MascotMotion = { initial: false, animate: { opacity: 1, x: 0, y: 0, scaleX: 1, scaleY: 1, rotate: 0 }, transition: { duration: 0 } };

export function mascotMotion(state: MascotState, motionOn: boolean): MascotMotion {
  if (!motionOn) return REST;
  const m = motionTokens.mascot;
  switch (state) {
    case "welcome":
      // Aparece, salta uma vez e assenta (roteiro de 2 s do dossiê, sem a piscada que só o rig faz).
      return {
        initial: { opacity: 0, y: motionTokens.distance.lg, scaleX: 0.96, scaleY: 0.96 },
        animate: { opacity: 1, y: [motionTokens.distance.lg, 0, 0, 1, -m.cheerLift, 0], scaleX: [0.96, 1, 1, 1.05, 0.98, 1], scaleY: [0.96, 1, 1, 0.93, 1.03, 1] },
        transition: { duration: 1.9, times: [0, 0.21, 0.42, 0.5, 0.62, 0.74], ease: easeStandard, opacity: { duration: motionTokens.duration.standard, ease: easeEnter } },
      };
    case "lead_accepted":
    case "success":
      return {
        initial: false,
        animate: { y: [0, 1, -m.cheerLift, 0], scaleX: [1, 1.05, 0.98, 1], scaleY: [1, 0.93, 1.03, 1] },
        transition: { duration: m.cheer, times: [0, 0.25, 0.55, 1], ease: easeStandard },
      };
    case "lead_converted":
      // Dois saltos, o segundo menor: a comemoração é maior que o positivo, ainda contida.
      return {
        initial: false,
        animate: { y: [0, 1, -m.cheerLift * 1.6, 0, -m.cheerLift * 0.7, 0], scaleX: [1, 1.06, 0.97, 1.03, 0.99, 1], scaleY: [1, 0.92, 1.04, 0.96, 1.02, 1] },
        transition: { duration: m.cheer * 2, times: [0, 0.14, 0.36, 0.56, 0.76, 1], ease: easeStandard },
      };
    case "error": {
      const d = motionTokens.shake.distance;
      return { initial: false, animate: { x: [0, -d, d, -d, d, 0] }, transition: { duration: motionTokens.shake.duration, ease: easeStandard } };
    }
    case "loading":
      // Único movimento contínuo, e só enquanto espera.
      return { initial: false, animate: { scaleX: [1, 1.03, 1], scaleY: [1, 1.03, 1], y: [0, -1.5, 0] }, transition: { duration: 1.6, repeat: Infinity, ease: "easeInOut" } };
    case "idle":
    default:
      return REST;
  }
}
