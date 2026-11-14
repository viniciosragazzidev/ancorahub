"use client";

import { useState } from "react";

/**
 * Regra do pulso do contador (Fila, Leads): pulsa uma vez quando o número SOBE.
 * Descer, repetir o mesmo valor ou a primeira pintura não pulsam. Devolve a nova chave do pulso.
 */
export function nextRisePulse(previous: number, next: number, pulse: number) {
  return next > previous ? pulse + 1 : pulse;
}

/**
 * Chave para `LiteAttention.pulseKey`: `undefined` até a primeira subida, depois um número novo a cada subida.
 * Ajusta o estado durante a renderização (sem efeito), então o pulso sai na mesma pintura do número novo.
 */
export function useRisePulse(count: number) {
  const [state, setState] = useState({ count, pulse: 0 });
  if (state.count !== count) setState({ count, pulse: nextRisePulse(state.count, count, state.pulse) });
  return state.pulse > 0 ? state.pulse : undefined;
}
