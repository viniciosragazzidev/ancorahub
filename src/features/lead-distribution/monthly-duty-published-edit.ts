/**
 * Rules for adding or removing one broker on a plantão of the PUBLISHED escala
 * (pure, tested). The action only loads the data and writes; the decisions are here.
 */

export type PublishedAddInput = {
  ended: boolean;
  /** Broker is an active broker of the tenant (corretor ativo, unidade ativa). */
  brokerIsPlanningBroker: boolean;
  alreadyOnPlantao: boolean;
  /** The broker's unit is allowed in the plantão's type. */
  allowedInType: boolean;
  /** The Diretor confirmed to schedule a broker outside the type's units. */
  force: boolean;
  scheduleActive: boolean;
  /** Already on the weekly roster of this plantão (on duty every week). */
  onWeeklyRoster: boolean;
};

export type PublishedRemoveInput = {
  entryFound: boolean;
  origin: string | undefined;
  ended: boolean;
  started: boolean;
};

/** Mensagem de erro, ou null quando pode escalar. */
export function publishedAddProblem(input: PublishedAddInput): string | null {
  if (input.ended) return "Este plantão já terminou. Não é possível escalar corretores nele.";
  if (!input.scheduleActive) return "Este plantão não está mais ativo na escala.";
  if (!input.brokerIsPlanningBroker) return "Este corretor está fora da corretora ou da política de inclusão na escala.";
  if (input.alreadyOnPlantao) return "Este corretor já está neste plantão.";
  if (input.onWeeklyRoster) return "Este corretor já está na escala semanal deste plantão.";
  if (!input.allowedInType && !input.force) return "A unidade deste corretor não participa deste tipo de plantão. Confirme para escalar mesmo assim.";
  return null;
}

/** Mensagem de erro, ou null quando pode remover. Plantão em andamento não muda. */
export function publishedRemoveProblem(input: PublishedRemoveInput): string | null {
  if (!input.entryFound) return "Este corretor não está neste plantão.";
  if (input.origin === "weekly") return "Este corretor está na escala semanal do plantão. Remova-o pelo próprio plantão.";
  if (input.ended) return "Este plantão já terminou. Não é possível alterar a escala dele.";
  if (input.started) return "Este plantão já começou. Não é possível remover corretor dele.";
  return null;
}
