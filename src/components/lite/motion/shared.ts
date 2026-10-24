import { motionTokens } from "@/components/arc/motion-tokens";

/** Curvas e durações saem só de motion-tokens.ts; nada de constante local. */
export const easeEnter = [...motionTokens.ease.enter];
export const easeStandard = [...motionTokens.ease.standard];
export const easeExit = [...motionTokens.ease.exit];

/** Movimento reduzido: só opacidade, em no máximo 120 ms, sem deslocamento nem mola. */
export const reducedFade = { duration: motionTokens.duration.instant };
