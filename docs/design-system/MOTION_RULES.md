# Regras de Motion

> Padrão vigente de movimento e feedback: [MOTION.md](./MOTION.md) (modo normal), [FEEDBACK.md](./FEEDBACK.md) (todo o app) e o §3 do [Lite](./lite/LITE_CHAT_DESIGN_SYSTEM.md). Os tokens estão em `src/components/arc/motion-tokens.ts`.

`design.md` não especifica duração, curva, distância ou animações: os tokens da referência são **MISSING**.

Até decisão posterior, use somente a escala central já existente no projeto, aplique `prefers-reduced-motion` e não use motion como único feedback. Não adicione movimento decorativo em filas, tabelas, métricas financeiras ou dados sensíveis. Toda nova transição deve usar a menor complexidade que explique mudança de estado.
