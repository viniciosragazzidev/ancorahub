/**
 * Vagas do mascote no app (docs/design-system/MASCOTE.md §8). Cada área que pode mostrar o mascote já
 * tem a vaga no código; ela só aparece quando `enabled` é true. Para ligar uma área ou trocar o estado e
 * o tamanho, mude aqui. O visual do personagem (arte, vídeos, rig) muda em mascot-config.ts.
 *
 * Em desenvolvimento, /dev/mascote tem "Mostrar todas as vagas" para ver cada área com o mascote
 * sem mudar este arquivo.
 */
import type { MascotState } from "./mascot-config";

export type MascotPlacement = "splash" | "empty" | "error" | "loading" | "success" | "celebration";

export type MascotPlacementConfig = {
  enabled: boolean;
  /** Estado padrão da vaga; quem usa a vaga pode trocar (ex.: venda usa lead_converted). */
  state: MascotState;
  /** Altura em px. */
  size: number;
  /** Onde a vaga está, para quem for ligar. */
  where: string;
};

export const MASCOT_PLACEMENTS: Record<MascotPlacement, MascotPlacementConfig> = {
  splash: { enabled: true, state: "lead_accepted", size: 300, where: "src/components/splash-screen.tsx (abertura do PWA); usa a arte própria do capitão, não o <Mascot>" },
  empty: { enabled: false, state: "idle", size: 96, where: "EmptyState (src/components/arc/empty-state), no lugar do ícone" },
  error: { enabled: false, state: "error", size: 112, where: "RouteError (src/components/route-error.tsx), no lugar do ícone" },
  loading: { enabled: false, state: "loading", size: 88, where: "LitePageLoading (src/components/light/lite-page-loading.tsx), acima do esqueleto" },
  success: { enabled: false, state: "success", size: 128, where: "useSuccessOverlay (venda registrada, reatribuição), no lugar do check" },
  celebration: { enabled: false, state: "lead_converted", size: 140, where: "CelebrationLayer da jornada (missão, conquista, nível), no lugar da arte" },
};

/** Chave do "Mostrar todas as vagas" da prévia (só em desenvolvimento). */
export const MASCOT_PREVIEW_ALL_KEY = "ancora:mascote-todas-as-vagas";
