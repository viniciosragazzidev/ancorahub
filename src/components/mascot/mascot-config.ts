/**
 * Contrato do mascote da Âncora Saúde (docs/design-system/MASCOTE.md).
 * Um lugar só para: estados, arte de reserva, nomes da máquina de estados da Rive e textos acessíveis.
 */

export const MASCOT_STATES = ["idle", "welcome", "loading", "lead_accepted", "lead_converted", "success", "error"] as const;
export type MascotState = (typeof MASCOT_STATES)[number];

/**
 * Arquivo .riv do personagem articulado. Fica `null` até o rig existir: aí o componente usa a arte de
 * reserva. Quando o .riv for entregue, coloque em public/mascote/ e troque para "/mascote/mascote.riv".
 * Nada é baixado de fora: o arquivo é servido pelo próprio app.
 */
export const MASCOT_RIVE: { src: string | null; artboard: string; stateMachine: string; stateInput: string } = {
  src: null,
  artboard: "Mascote",
  stateMachine: "Mascote",
  /** Entrada numérica da máquina de estados: o índice de MASCOT_STATES (0 = idle ... 6 = error). */
  stateInput: "estado",
};

export function mascotStateIndex(state: MascotState) {
  return MASCOT_STATES.indexOf(state);
}

/** Arte de reserva (WebP com fundo transparente, recortada das pranchas aprovadas). */
export const MASCOT_ART = {
  repouso: { src: "/mascote/repouso.webp", width: 242, height: 379 },
  positivo: { src: "/mascote/positivo.webp", width: 349, height: 653 },
} as const;
export type MascotArt = keyof typeof MASCOT_ART;

export const MASCOT_STATE_ART: Record<MascotState, MascotArt> = {
  idle: "repouso",
  welcome: "positivo",
  loading: "repouso",
  lead_accepted: "positivo",
  lead_converted: "positivo",
  success: "positivo",
  error: "repouso",
};

/** Proporção da caixa (largura / altura): a mesma em todos os estados, para a troca de pose não mexer no layout. */
export const MASCOT_BOX_RATIO = 0.64;

export const MASCOT_LABELS: Record<MascotState, string> = {
  idle: "Mascote da Âncora Saúde",
  welcome: "Mascote da Âncora Saúde dando as boas-vindas",
  loading: "Mascote da Âncora Saúde esperando",
  lead_accepted: "Mascote da Âncora Saúde fazendo sinal de positivo",
  lead_converted: "Mascote da Âncora Saúde comemorando",
  success: "Mascote da Âncora Saúde fazendo sinal de positivo",
  error: "Mascote da Âncora Saúde atento",
};
