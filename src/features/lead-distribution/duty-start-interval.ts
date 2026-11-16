import { SELF_CONFIRM_TOLERANCE_MINUTES } from "./duty-presence-domain";

/**
 * Intervalo de início de plantão (11/11, pedido do Vinicios; exceção estreita à DEC-151).
 * Na primeira hora de uma ocorrência, enquanto ainda há escalados por confirmar presença e só
 * 1 a 3 já confirmaram, cada confirmado recebe no máximo um lead a cada 8 minutos. Assim os
 * primeiros a chegar não levam a fila acumulada antes de os colegas confirmarem. Puro: sem banco.
 */
export const DUTY_START_INTERVAL_MINUTES = 8;
export const DUTY_START_INTERVAL_MAX_CONFIRMED = 3;
/**
 * Teto do começo do plantão (16/11/2026, pedido do Vinicios): com o intervalo ativo, cada corretor recebe no máximo
 * 3 leads desde o início da ocorrência; com 3, espera até todos confirmarem ou a janela acabar. Sem o teto, quem
 * confirmava cedo somava um lead a cada 8 min a janela inteira (um corretor chegou a 6).
 */
export const DUTY_START_INTERVAL_MAX_LEADS = 3;

/** Bateu o teto do começo do plantão: só volta a receber quando o intervalo acabar. */
export function dutyStartIntervalCapReached(offersSinceStart: number) {
  return offersSinceStart >= DUTY_START_INTERVAL_MAX_LEADS;
}

export type DutyStartIntervalState =
  | { active: true; endsAt: Date; confirmedCount: number; pendingCount: number }
  | { active: false };

export function resolveDutyStartInterval(input: {
  occurrenceStartsAt: Date;
  now: Date;
  /** Escalados da ocorrência que já podem receber (presença confirmada). */
  confirmedCount: number;
  /** Escalados que ainda podem confirmar: sem confirmação, não ausentes e dentro da tolerância. */
  pendingCount: number;
}): DutyStartIntervalState {
  const endsAt = new Date(input.occurrenceStartsAt.getTime() + SELF_CONFIRM_TOLERANCE_MINUTES * 60_000);
  if (input.now >= endsAt) return { active: false };
  if (input.pendingCount <= 0) return { active: false };
  if (input.confirmedCount < 1 || input.confirmedCount > DUTY_START_INTERVAL_MAX_CONFIRMED) return { active: false };
  return { active: true, endsAt, confirmedCount: input.confirmedCount, pendingCount: input.pendingCount };
}

/** O lead quente (alta aptidão, DEC-153) não espera o intervalo. */
export function leadWaitsDutyStartInterval(qualificationStatus: string | null | undefined) {
  return qualificationStatus !== "hot";
}

/**
 * Quando o corretor volta a poder receber: 8 min depois da última oferta (exceto CANCELLED) ou
 * atribuição dele neste plantão. Null quando já pode receber.
 */
export function dutyStartIntervalReleaseAt(input: { lastOfferAt: Date | null; lastAssignedAt: Date | null; now: Date; intervalEndsAt?: Date | null }) {
  const anchor = [input.lastOfferAt, input.lastAssignedAt].reduce<Date | null>((latest, at) => (!at ? latest : !latest || at > latest ? at : latest), null);
  if (!anchor) return null;
  const releasedAt = new Date(anchor.getTime() + DUTY_START_INTERVAL_MINUTES * 60_000);
  if (releasedAt <= input.now) return null;
  // O intervalo some no fim da janela: ninguém espera além dela.
  if (input.intervalEndsAt && input.intervalEndsAt < releasedAt) return input.intervalEndsAt > input.now ? input.intervalEndsAt : null;
  return releasedAt;
}
