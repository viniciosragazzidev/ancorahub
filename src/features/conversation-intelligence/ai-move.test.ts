import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/features/system-settings/queries", () => ({ getSystemSetting: vi.fn(), setSystemSetting: vi.fn() }));

import { AI_MOVE_UNDO_WINDOW_MS, canUndoAiMove, type AiAutoMove } from "./ai-move";
import { parseAiStageMode } from "./stage-mode";

const movedAt = new Date("2026-10-21T12:00:00Z");
const move: AiAutoMove = { fromStatus: "in_contact", toStatus: "quote_sent", at: movedAt.toISOString(), confidence: 0.93 };

describe("canUndoAiMove", () => {
  it("allows undo while the lead is still where the IA put it, within 24h", () => {
    expect(canUndoAiMove(move, "quote_sent", new Date(movedAt.getTime() + 60_000))).toBe(true);
    expect(canUndoAiMove(move, "quote_sent", new Date(movedAt.getTime() + AI_MOVE_UNDO_WINDOW_MS))).toBe(true);
  });

  it("refuses after 24h", () => {
    expect(canUndoAiMove(move, "quote_sent", new Date(movedAt.getTime() + AI_MOVE_UNDO_WINDOW_MS + 1))).toBe(false);
  });

  it("refuses when the broker already moved the lead again", () => {
    expect(canUndoAiMove(move, "negotiation", movedAt)).toBe(false);
  });

  it("refuses a second undo and a missing move", () => {
    expect(canUndoAiMove({ ...move, undoneAt: movedAt.toISOString() }, "quote_sent", movedAt)).toBe(false);
    expect(canUndoAiMove(null, "quote_sent", movedAt)).toBe(false);
    expect(canUndoAiMove({ ...move, at: "invalid" }, "quote_sent", movedAt)).toBe(false);
  });
});

describe("parseAiStageMode", () => {
  it("starts on automatic and accepts only the three modes", () => {
    expect(parseAiStageMode(undefined)).toBe("auto");
    expect(parseAiStageMode("suggest")).toBe("suggest");
    expect(parseAiStageMode("off")).toBe("off");
    expect(parseAiStageMode("qualquer")).toBe("auto");
  });
});
