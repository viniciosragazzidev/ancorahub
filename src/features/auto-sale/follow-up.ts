/**
 * Cadência de follow-up (§10 do plano, D12), derivada das taxas de resposta do estudo de 12/11:
 * 45 min depois da cotação (na sessão), 20 h depois da última mensagem do cliente (dentro da janela de
 * 24 h da Meta), D+2 e D+5. Nunca sexta depois das 14h nem no fim de semana. Pura.
 */
import { nextSendWindowStart, saoPauloParts } from "./guardrails";
import { DEFAULT_AUTO_SALE_SETTINGS, type AutoSaleSettings } from "./settings";

export const FOLLOW_UP_STEPS = 4;

/** Atraso de cada passo, contado da referência (cotação no passo 0; última mensagem do cliente nos demais). */
const STEP_DELAY_MS = [45 * 60_000, 20 * 3_600_000, 2 * 86_400_000, 5 * 86_400_000];

/** Passos 2 e 3 caem fora da janela de 24 h: na Meta precisam de template aprovado. */
export function followUpNeedsTemplate(step: number) {
  return step >= 2;
}

function avoidFridayAfternoon(date: Date, window: Pick<AutoSaleSettings, "sendStartHour" | "sendEndHour">) {
  const { weekday, hour, minute } = saoPauloParts(date);
  if (weekday === 5 && hour >= 14) {
    // Pula para o sábado 0h; a janela de envio (só dias úteis) leva à abertura de segunda.
    return nextSendWindowStart(new Date(date.getTime() + (24 - hour) * 3_600_000 - minute * 60_000), window);
  }
  return date;
}

/** Quando o próximo follow-up sai; null quando a cadência acabou. */
export function nextFollowUpAt(input: {
  step: number;
  quotedAt: Date | null;
  lastCustomerMessageAt: Date | null;
  window?: Pick<AutoSaleSettings, "sendStartHour" | "sendEndHour">;
}): Date | null {
  if (input.step >= FOLLOW_UP_STEPS) return null;
  const reference = input.step === 0 ? input.quotedAt : input.lastCustomerMessageAt ?? input.quotedAt;
  if (!reference) return null;
  const window = input.window ?? DEFAULT_AUTO_SALE_SETTINGS;
  const due = new Date(reference.getTime() + STEP_DELAY_MS[input.step]);
  return avoidFridayAfternoon(nextSendWindowStart(due, window), window);
}

/** O follow-up do passo 1 só vale dentro da janela de 24 h; fora dela, pula para o passo 2 (template). */
export function stepForNow(step: number, lastCustomerMessageAt: Date | null, now: Date) {
  if (step === 1 && lastCustomerMessageAt && now.getTime() - lastCustomerMessageAt.getTime() >= 24 * 3_600_000) return 2;
  return step;
}
