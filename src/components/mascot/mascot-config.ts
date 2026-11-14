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

/**
 * Animações pré-gravadas (Higgsfield, modelo Wan 2.7, 14/11/2026), geradas a partir das poses aprovadas
 * sobre fundo branco e servidas pelo próprio app (MP4 H.264 sem som, 480 x 640, até 120 KB).
 * O personagem ocupa `subjectHeight` da altura do quadro e o pé fica a `subjectBottom` da base,
 * para o vídeo ter o mesmo tamanho da arte de reserva. Fontes em design/mascote/higgsfield/.
 */
export const MASCOT_VIDEOS = {
  welcome: { src: "/mascote/welcome.mp4", poster: "/mascote/welcome-poster.webp" },
  leadAccepted: { src: "/mascote/lead-accepted.mp4", poster: "/mascote/lead-accepted-poster.webp" },
  leadConverted: { src: "/mascote/lead-converted.mp4", poster: "/mascote/lead-converted-poster.webp" },
} as const;
export const MASCOT_VIDEO_FRAME = { width: 480, height: 640, subjectHeight: 0.78, subjectBottom: 0.107 } as const;
export type MascotVideo = keyof typeof MASCOT_VIDEOS;

/** Estados com animação pré-gravada. Os outros usam a arte de reserva com o movimento provisório. */
export const MASCOT_STATE_VIDEO: Partial<Record<MascotState, MascotVideo>> = {
  welcome: "welcome",
  lead_accepted: "leadAccepted",
  lead_converted: "leadConverted",
  success: "welcome",
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
