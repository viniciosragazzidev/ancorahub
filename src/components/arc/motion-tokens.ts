export const motionTokens = {
  duration: { instant: 0.12, fast: 0.16, exit: 0.18, standard: 0.24, considered: 0.48, draw: 0.32, /** Nível 3 (FEEDBACK.md): teto de uma celebração, sem bloquear. */ celebrate: 1.4 },
  ease: {
    enter: [0.16, 1, 0.3, 1],
    exit: [0.7, 0, 0.84, 0],
    standard: [0.22, 1, 0.36, 1],
    /** For elements that move while already on screen. */
    inOut: [0.65, 0, 0.35, 1],
  },
  spring: {
    responsive: { type: "spring", stiffness: 520, damping: 38 },
    gentle: { type: "spring", stiffness: 340, damping: 34 },
    /** Presses, toggles, thumbs, and small indicators. Settles fast with a hint of life. */
    snappy: { type: "spring", visualDuration: 0.26, bounce: 0.12 },
    /** Panels, height changes, and layout shifts. Critically damped, never overshoots. */
    smooth: { type: "spring", visualDuration: 0.4, bounce: 0 },
    /** Shape morphs, shared layout highlights, and width changes that follow new content. */
    morph: { type: "spring", visualDuration: 0.42, bounce: 0.16 },
    /** Só nível 3 e o salto do mascote comemorando (FEEDBACK.md §5). Nunca no modo normal. */
    celebrate: { type: "spring", visualDuration: 0.5, bounce: 0.24 },
  },
  /** Stagger steps in seconds. Keep total stagger under roughly 0.4s. `max` is the number of distinct delays: item `max - 1` and later items share one. */
  stagger: { char: 0.016, word: 0.04, line: 0.08, item: 0.035, max: 8 },
  /** Blur radii in px for text and content crossfades. Keep blur small and brief. */
  blur: { subtle: 2, soft: 4, text: 8 },
  /** LiteAttention: pulso único de anel. Começa em `opacity` e some; cresce pouco. */
  attention: { duration: 0.6, opacity: 0.5 },
  /** LiteNumber: cada dígito sai de `fromOpacity` até 1 enquanto rola. */
  number: { fromOpacity: 0.4 },
  /** Offsets in px for entering and leaving elements, by element type. */
  distance: { xs: 4, sm: 6, md: 8, lg: 12, sheet: 24 },
  /** Ritmo das camadas de feedback (FEEDBACK.md §1): visual na hora, texto +80 ms, número +160 ms, depois +320 ms. */
  beat: { visual: 0, text: 0.08, number: 0.16, after: 0.32 },
  /** Erro de ação: 2 ciclos de 4 px em 250 ms (MOTION.md, campos). */
  shake: { distance: 4, cycles: 2, duration: 0.25 },
  /** Limites de celebração: nível 2 uma vez por dia por tipo, nível 3 até 3 por dia; o botão que falhou volta em 1,4 s. */
  celebration: { maxPerDay: { 2: 1, 3: 3 }, holdDuringLeadOffer: true, revertAfter: 1.4 },
  /** Humor do mascote: uma passada por troca. */
  mascot: { alert: 0.42, alertLift: 5, cheer: 0.56, cheerLift: 8, thinkingGaze: 2 },
  /** Scale targets for presses and pops. */
  scale: { pressButton: 0.97, pressRow: 0.99, pressCard: 0.985, popIn: 0.96, attention: 1.04 },
} as const;
