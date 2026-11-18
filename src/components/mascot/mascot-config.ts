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

/** Ilustrações oficiais do Capitão Âncora (WebP transparente; fontes em design/mascote/capitao-ancora/). */
export const MASCOT_ART = {
  repouso: { src: "/mascote/repouso.webp", width: 696, height: 1328 },
  boasVindas: { src: "/mascote/boas-vindas.webp", width: 793, height: 1288 },
  positivo: { src: "/mascote/positivo.webp", width: 895, height: 1298 },
} as const;
export type MascotArt = keyof typeof MASCOT_ART;

export const MASCOT_STATE_ART: Record<MascotState, MascotArt> = {
  idle: "repouso",
  welcome: "boasVindas",
  loading: "repouso",
  lead_accepted: "positivo",
  lead_converted: "positivo",
  success: "positivo",
  error: "repouso",
};

/** Proporção da caixa (largura / altura): a mesma em todos os estados, para a troca de pose não mexer no layout. */
export const MASCOT_BOX_RATIO = 0.64;

export const MASCOT_LABELS: Record<MascotState, string> = {
  idle: "Capitão Âncora",
  welcome: "Capitão Âncora dando as boas-vindas",
  loading: "Capitão Âncora aguardando",
  lead_accepted: "Capitão Âncora fazendo sinal de positivo e segurando um troféu",
  lead_converted: "Capitão Âncora comemorando",
  success: "Capitão Âncora fazendo sinal de positivo",
  error: "Capitão Âncora atento",
};
