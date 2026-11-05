/**
 * Gestor e plantão (05/11): o gestor só enxerga e mexe no que é EXCLUSIVO da unidade dele.
 * Nada que misture outra unidade (plantão da empresa toda, tipo com várias unidades, fila de outra
 * unidade, corretor de outra unidade) aparece ou aceita alteração do gestor.
 */

export type ScheduleUnitFacts = {
  /** Unidade gravada no próprio plantão (null = plantão da empresa). */
  branchId: string | null;
  /** Unidades do tipo do plantão ([] = todas as unidades). */
  typeBranchIds: readonly string[] | null | undefined;
  /** Unidade de cada fila que recebe o plantão (null = fila global). */
  queueBranchIds: readonly (string | null)[];
};

/**
 * O plantão é exclusivo da unidade quando ele mesmo é da unidade; ou é da empresa e o tipo foi marcado só
 * para essa unidade; ou é da empresa, o tipo vale para todas e ele alimenta só filas da unidade (ex.: "Plantão
 * 7° Andar" → fila Venâncio Leads do Matriz 7° Andar, 05/11). Em qualquer caso, toda fila que recebe o
 * plantão é da unidade; tipo marcado para outra unidade, ou para várias, fica de fora.
 */
export function isScheduleExclusiveToUnit(facts: ScheduleUnitFacts, unitId: string | null | undefined): boolean {
  if (!unitId) return false;
  const queuesOnlyOfUnit = facts.queueBranchIds.every((queueBranchId) => queueBranchId === unitId);
  if (!queuesOnlyOfUnit) return false;
  if (facts.branchId) return facts.branchId === unitId;
  const typeUnits = facts.typeBranchIds ?? [];
  if (typeUnits.length) return typeUnits.length === 1 && typeUnits[0] === unitId;
  // Tipo de todas as unidades: só conta pelas filas, e precisa ter ao menos uma.
  return facts.queueBranchIds.length > 0;
}

/** O tipo pode ser usado num plantão da unidade: tipo de todas as unidades ou que inclui a unidade. */
export function isTypeUsableByUnit(typeBranchIds: readonly string[] | null | undefined, unitId: string): boolean {
  return !typeBranchIds?.length || typeBranchIds.includes(unitId);
}

export const MANAGER_SCOPE_ERROR = "Plantão fora da sua unidade.";
