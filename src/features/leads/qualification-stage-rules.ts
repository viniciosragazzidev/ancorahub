type DecisaoCorretor =
  | { tipo: "seguir" }
  | { tipo: "manter" }
  | { tipo: "bloquear"; motivo: string };

/**
 * What a manual qualification stage change does to the broker who already holds the lead (05/11 incident:
 * a "move to qualificado" 19 s after the broker accepted removed him and sent the lead back to the queue).
 */
export function decidirCorretorNaMudancaDeEtapa(input: {
  targetStage: "qualificacoes" | "qualificado" | "humano";
  corretorAtual: string | null;
  brokerEscolhido: string | null;
}): DecisaoCorretor {
  if (!input.corretorAtual) return { tipo: "seguir" };
  if (input.targetStage === "qualificacoes") {
    return { tipo: "bloquear", motivo: "Este lead já está com um corretor. Repasse o lead antes de devolvê-lo para a qualificação." };
  }
  if (!input.brokerEscolhido || input.brokerEscolhido === input.corretorAtual) return { tipo: "manter" };
  return { tipo: "seguir" };
}
