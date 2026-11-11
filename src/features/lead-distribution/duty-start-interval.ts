import { SELF_CONFIRM_TOLERANCE_MINUTES } from "./duty-presence-domain";

/**
 * Intervalo de início de plantão (11/11, pedido do Vinicios; exceção estreita à DEC-151).
 * Na primeira hora de uma ocorrência, enquanto ainda há escalados por confirmar presença e só
 * 1 a 3 já confirmaram, cada confirmado recebe no máximo um lead a cada 8 minutos. Assim os
 * primeiros a chegar não levam a fila acumulada antes de os colegas confirmarem. Puro: sem banco.
 */
export const DUTY_START_INTERVAL_MINUTES = 8;
export const DUTY_START_INTERVAL_MAX_CONFIRMED = 3;

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
