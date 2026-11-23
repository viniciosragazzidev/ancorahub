/**
 * Passar o plantão (23/11): A abre mão de uma ocorrência e B entra no lugar, sem B precisar
 * estar escalado em outro dia. Só uma cadeira muda de dono. Vale para a escala publicada, o
 * rascunho do mês e o plantão avulso (escala semanal de um dia só).
 *
 * Regras puras (testadas). A tela de Plantões e o agente do diretor (`plantao_passar_cadeira`)
 * usam as mesmas: `seatPassCheck` decide e `passSeat` executa com volta garantida.
 */

/** O que a regra precisa de uma ocorrência (compatível com `SeatOccurrence` do agente). */
export type PassSeat = {
  id: string;
  scheduleName: string;
  dutyDate: string;
  startsAt: string;
  endsAt: string;
  brokerIds: readonly string[];
  allowedBrokerIds: readonly string[];
  started: boolean;
  ended: boolean;
  source: "published" | "draft" | "avulso";
};

export type PassPerson = { id: string; name: string; role: string; status: string };

export type PassWarning = "fora_do_tipo" | "mesmo_horario";

export type SeatPassCheck =
  | { ok: true; warnings: PassWarning[]; overlapping: string[] }
  | { ok: false; code: "pessoa" | "nao_estava" | "ja_estava" | "comecou" | "terminou"; reason: string };

const minutes = (value: string) => {
  const [hours, mins] = value.split(":").map(Number);
  return (hours || 0) * 60 + (mins || 0);
};

/** Intervalo em minutos do dia (o fim passa da meia-noite quando é menor ou igual ao início). */
function span(seat: Pick<PassSeat, "startsAt" | "endsAt">) {
  const start = minutes(seat.startsAt);
  let end = minutes(seat.endsAt);
  if (end <= start) end += 24 * 60;
  return [start, end] as const;
}

/** Dois plantões do mesmo dia se cruzam no horário. */
export function seatsOverlap(a: Pick<PassSeat, "dutyDate" | "startsAt" | "endsAt">, b: Pick<PassSeat, "dutyDate" | "startsAt" | "endsAt">) {
  if (a.dutyDate !== b.dutyDate) return false;
  const [aStart, aEnd] = span(a);
  const [bStart, bEnd] = span(b);
  return aStart < bEnd && bStart < aEnd;
}

export function dutyDayLabel(dutyDate: string) {
  return `${dutyDate.slice(8, 10)}/${dutyDate.slice(5, 7)}`;
}

export function passSeatLabel(seat: Pick<PassSeat, "scheduleName" | "dutyDate" | "startsAt" | "endsAt">) {
  return `${seat.scheduleName}, ${dutyDayLabel(seat.dutyDate)}, ${seat.startsAt.slice(0, 5)} às ${seat.endsAt.slice(0, 5)}`;
}

/** Quem sai pode abrir mão desta ocorrência (está nela e ela não começou)? null = pode. */
export function leavingProblem(seat: PassSeat | null, from: Pick<PassPerson, "id" | "name">): Extract<SeatPassCheck, { ok: false }> | null {
  if (!seat || !seat.brokerIds.includes(from.id)) return { ok: false, code: "nao_estava", reason: `${from.name} não está nesse plantão.` };
  if (seat.ended) return { ok: false, code: "terminou", reason: `${passSeatLabel(seat)} já terminou.` };
  if (seat.started) return { ok: false, code: "comecou", reason: `${passSeatLabel(seat)} já começou: a cadeira não muda pela escala. Pause quem sai no plantão.` };
  return null;
}

/**
 * Pode passar a cadeira de `from` para `to` nesta ocorrência? Recusa o que não tem volta
 * (pessoa, plantão começado, B já no plantão). Fora do tipo e outro plantão no mesmo horário
 * viram avisos: a tela pede confirmação, o servidor só segue com o aceite.
 * `sameDaySeats`: as outras ocorrências do dia (para achar choque de horário de B).
 */
export function seatPassCheck(input: {
  seat: PassSeat | null;
  from: PassPerson | null;
  to: PassPerson | null;
  sameDaySeats?: readonly PassSeat[];
}): SeatPassCheck {
  const { seat, from, to } = input;
  if (!from || !to) return { ok: false, code: "pessoa", reason: "Não achei uma das pessoas." };
  if (from.id === to.id) return { ok: false, code: "pessoa", reason: "Escolha outra pessoa para entrar no lugar." };
  if (to.role !== "broker" || to.status !== "active") return { ok: false, code: "pessoa", reason: `${to.name} não é corretor ativo.` };
  const leaving = leavingProblem(seat, from);
  if (leaving || !seat) return leaving ?? { ok: false, code: "nao_estava", reason: `${from.name} não está nesse plantão.` };
  if (seat.brokerIds.includes(to.id)) return { ok: false, code: "ja_estava", reason: `${to.name} já está em ${passSeatLabel(seat)}.` };
  const warnings: PassWarning[] = [];
  if (!seat.allowedBrokerIds.includes(to.id)) warnings.push("fora_do_tipo");
  const overlapping = (input.sameDaySeats ?? [])
    .filter((other) => other.id !== seat.id && other.brokerIds.includes(to.id) && !other.ended && seatsOverlap(seat, other))
    .map((other) => passSeatLabel(other));
  if (overlapping.length) warnings.push("mesmo_horario");
  return { ok: true, warnings, overlapping };
}

/** Texto curto de cada aviso, para o cartão de confirmação e para o agente. */
export function passWarningText(warning: PassWarning, toName: string, seat: Pick<PassSeat, "scheduleName">, overlapping: readonly string[] = []) {
  if (warning === "fora_do_tipo") return `A unidade de ${toName} não participa do tipo de ${seat.scheduleName}.`;
  return `${toName} já está em ${overlapping.join("; ") || "outro plantão"} no mesmo horário.`;
}

export type SeatOps<S> = {
  addSeat(seat: S, brokerId: string, force: boolean): Promise<void>;
  removeSeat(seat: S, brokerId: string): Promise<void>;
};

/**
 * Tira `fromId` e põe `toId`. Se a entrada falhar, quem saía volta (a cadeira nunca fica vazia
 * por erro no meio) e o erro sobe.
 */
export async function passSeat<S>(ops: SeatOps<S>, seat: S, fromId: string, toId: string, force: boolean) {
  await ops.removeSeat(seat, fromId);
  try {
    await ops.addSeat(seat, toId, force);
  } catch (error) {
    await ops.addSeat(seat, fromId, true).catch(() => null);
    throw error;
  }
}
