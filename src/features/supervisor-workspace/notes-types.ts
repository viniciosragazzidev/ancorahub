export const SUPERVISOR_NOTE_KINDS = ["orientacao", "elogio", "alerta", "melhoria", "acompanhamento"] as const;

export type SupervisorNoteKind = (typeof SUPERVISOR_NOTE_KINDS)[number];

export const SUPERVISOR_NOTE_KIND_LABELS: Record<SupervisorNoteKind, string> = {
  orientacao: "Orientação",
  elogio: "Elogio",
  alerta: "Alerta",
  melhoria: "Ponto de melhoria",
  acompanhamento: "Acompanhamento",
};

export type SupervisorNote = {
  id: string;
  kind: SupervisorNoteKind;
  body: string;
  createdAt: string;
  /** "Revisar em": ISO timestamp of the start of the day in São Paulo, or null when there is no reminder. */
  followUpAt: string | null;
};
