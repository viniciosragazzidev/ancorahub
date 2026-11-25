/**
 * Plantão (25/11/2026): a modalidade mostrada ("Plantão presencial", "Online") e o passo da confirmação (com ou
 * sem foto) são coisas separadas. `mode` diz como confirma (segue "Exigir foto na confirmação"); `modality` é a
 * modalidade do plantão e não muda com a foto. Sem `modality` (dados antigos), a tela usa `mode`.
 */
export type PresenceModalityInput = { mode: "online" | "presencial"; modality?: "online" | "presencial" | null };

/** A modalidade que a tela mostra. */
export function presenceModality(ask: PresenceModalityInput): "online" | "presencial" {
  return ask.modality ?? ask.mode;
}

/** Plantão online que pede foto: o texto não fala em "estar na unidade". */
export function isOnlineWithPhoto(ask: PresenceModalityInput) {
  return ask.mode === "presencial" && presenceModality(ask) === "online";
}
