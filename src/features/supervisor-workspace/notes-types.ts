export const SUPERVISOR_NOTE_KINDS = ["orientacao", "elogio", "alerta"] as const;

export type SupervisorNoteKind = (typeof SUPERVISOR_NOTE_KINDS)[number];

export type SupervisorNote = {
  id: string;
  kind: SupervisorNoteKind;
  body: string;
  createdAt: string;
};
