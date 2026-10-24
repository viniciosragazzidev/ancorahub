import { motionTokens } from "@/components/arc/motion-tokens";

type Bezier = [number, number, number, number];

/** Curvas e durações saem só de motion-tokens.ts; nada de constante local. */
export const easeEnter: Bezier = [...motionTokens.ease.enter];
export const easeStandard: Bezier = [...motionTokens.ease.standard];
export const easeExit: Bezier = [...motionTokens.ease.exit];

/** Movimento reduzido: só opacidade, em no máximo 120 ms, sem deslocamento nem mola. */
export const reducedFade = { duration: motionTokens.duration.instant };
