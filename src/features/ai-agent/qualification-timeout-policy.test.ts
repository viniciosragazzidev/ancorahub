import { describe, expect, it } from "vitest";
import type { ConversationMemory } from "./memory";
import {
  hasQualificationTimedOut,
  qualificationTimeoutAnchor,
  qualificationTimeoutDistributionStatus,
  qualificationTimeoutOutcome,
  type QualificationTimeoutMessage,
} from "./qualification-timeout-policy";

const at = (value: string) => new Date(value);

function message(input: Partial<QualificationTimeoutMessage> & Pick<QualificationTimeoutMessage, "id" | "direction" | "body" | "sentAt">): QualificationTimeoutMessage {
  return {
    id: input.id,
    messageId: input.messageId ?? null,
    senderRole: input.senderRole ?? null,
    direction: input.direction,
    body: input.body,
    sentAt: input.sentAt,
  };
}

describe("qualification timeout policy", () => {
  it("keeps Rita cold when 'Nenhuma' leaves no valid answer in memory", () => {
    const memory: ConversationMemory = {
      collectedFields: ["planType", "intent"],
      planType: { value: "empresarial", confidence: 1, sourceMessageId: "intake" },
      intent: { value: "cotacao empresarial SulAmerica", confidence: 1, sourceMessageId: "intake" },
      updatedAt: at("2026-10-16T12:02:00Z").toISOString(),
    };
    const messages = [
      message({ id: "intake", messageId: "intake", direction: "incoming", body: "quero cotacao empresarial SulAmerica", sentAt: at("2026-10-16T12:00:00Z") }),
      message({ id: "question", direction: "outbound", senderRole: "assistant", body: "Quantas vidas seriam?", sentAt: at("2026-10-16T12:01:00Z") }),
      message({ id: "none", messageId: "none", direction: "incoming", body: "Nenhuma", sentAt: at("2026-10-16T12:02:00Z") }),
    ];

    expect(qualificationTimeoutOutcome(memory, messages)).toEqual({
      qualificationStatus: "cold",
      qualificationState: "PARTIAL",
    });
  });

  it("marks a lead warm only when a valid field came from a reply after a question", () => {
    const memory: ConversationMemory = {
      collectedFields: ["planType", "numberOfLives"],
      planType: { value: "empresarial", confidence: 1, sourceMessageId: "intake" },
      numberOfLives: { value: "3", confidence: 1, sourceMessageId: "answer" },
    };
    const messages = [
      message({ id: "intake", messageId: "intake", direction: "incoming", body: "Quero plano empresarial", sentAt: at("2026-10-16T12:00:00Z") }),
      message({ id: "question", direction: "outbound", senderRole: "assistant", body: "Quantas vidas?", sentAt: at("2026-10-16T12:01:00Z") }),
      message({ id: "answer", messageId: "answer", direction: "incoming", body: "3", sentAt: at("2026-10-16T12:02:00Z") }),
    ];

    expect(qualificationTimeoutOutcome(memory, messages)).toEqual({
      qualificationStatus: "warm",
      qualificationState: "PARTIAL",
    });
  });

  it("rejects zero lives even when the memory contains the value", () => {
    const memory: ConversationMemory = {
      collectedFields: ["numberOfLives"],
      numberOfLives: { value: "0", confidence: 1, sourceMessageId: "answer" },
    };
    const messages = [
      message({ id: "question", direction: "outbound", senderRole: "assistant", body: "Quantas vidas?", sentAt: at("2026-10-16T12:01:00Z") }),
      message({ id: "answer", messageId: "answer", direction: "incoming", body: "0", sentAt: at("2026-10-16T12:02:00Z") }),
    ];

    expect(qualificationTimeoutOutcome(memory, messages).qualificationStatus).toBe("cold");
  });

  it("holds cold timeouts for manual requalification and queues warm timeouts", () => {
    expect(qualificationTimeoutDistributionStatus("cold")).toBe("manual_hold");
    expect(qualificationTimeoutDistributionStatus("warm")).toBe("queued");
  });

  it("restarts the timeout from re-open unless a newer message exists", () => {
    const lastActivityAt = at("2026-10-16T13:00:00Z");
    const reopenedAt = at("2026-10-16T13:25:00Z");

    expect(qualificationTimeoutAnchor(lastActivityAt, reopenedAt)).toEqual(reopenedAt);
    expect(hasQualificationTimedOut({
      lastActivityAt,
      reopenedAt,
      now: at("2026-10-16T13:28:00Z"),
      timeoutMinutes: 15,
    })).toBe(false);
    expect(hasQualificationTimedOut({
      lastActivityAt,
      reopenedAt,
      now: at("2026-10-16T13:41:00Z"),
      timeoutMinutes: 15,
    })).toBe(true);
    expect(qualificationTimeoutAnchor(at("2026-10-16T13:30:00Z"), reopenedAt)).toEqual(at("2026-10-16T13:30:00Z"));
  });
});
