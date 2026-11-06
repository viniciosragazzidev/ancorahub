/** The last stage move the IA made by itself, kept in qualificationDetails.aiLastAutoMove. */
export type AiAutoMove = {
  fromStatus: string;
  toStatus: string;
  /** ISO date of the move. */
  at: string;
  confidence: number;
  undoneAt?: string;
  undoneBy?: string;
};

/** How long the broker can put the lead back with "Desfazer". */
export const AI_MOVE_UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Undo only while the lead is still where the IA put it, within 24h, once. */
export function canUndoAiMove(move: AiAutoMove | null | undefined, currentStatus: string, now: Date = new Date()) {
  if (!move?.fromStatus || !move.toStatus || !move.at || move.undoneAt) return false;
  if (currentStatus !== move.toStatus) return false;
  const at = Date.parse(move.at);
  return Number.isFinite(at) && now.getTime() - at <= AI_MOVE_UNDO_WINDOW_MS;
}

/** Depois de um "Desfazer" do corretor, a IA não move este lead sozinha por esta janela (05/11). */
export const AI_MOVE_UNDO_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export function recentlyUndoneAiMove(move: AiAutoMove | null | undefined, now: Date = new Date()) {
  if (!move?.undoneAt) return false;
  const undoneAt = Date.parse(move.undoneAt);
  return Number.isFinite(undoneAt) && now.getTime() - undoneAt < AI_MOVE_UNDO_COOLDOWN_MS;
}
