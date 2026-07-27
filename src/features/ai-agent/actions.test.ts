import { describe, expect, it, vi } from "vitest";

const { getRequiredTenantContext } = vi.hoisted(() => ({
  getRequiredTenantContext: vi.fn(),
}));

vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext }));
vi.mock("@/shared/db", () => ({ getDatabase: vi.fn(), schema: {} }));
vi.mock("./conversation-state-machine", () => ({ transitionConversationState: vi.fn() }));

import {
  closeConversationAction,
  resetAiConversationAction,
  returnConversationToAiAction,
  takeoverConversationAction,
} from "./actions";

describe("AI conversation server actions", () => {
  it.each([
    ["assumir", takeoverConversationAction],
    ["devolver", returnConversationToAiAction],
    ["encerrar", closeConversationAction],
    ["reiniciar", resetAiConversationAction],
  ])("rejects an invalid conversation id before reading session data when attempting to %s", async (_label, action) => {
    const result = await action(" ");

    expect(result).toEqual({ success: false, error: "Conversa inválida." });
    expect(getRequiredTenantContext).not.toHaveBeenCalled();
  });
});
