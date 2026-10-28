import { describe, expect, it } from "vitest";

import { brokerFirstName, canResumeDistributedQualification, distributedHandoffText, isDistributedPartialQualification } from "./distributed-resume";

const base = { conversationStatus: "CLOSED", corretorId: "broker-1", qualificationState: "PARTIAL", leadStatus: "distributed", brokerMessagesSinceAssignment: 0 };

describe("qualification resumed after the lead was distributed", () => {
  it("resumes a lead that left by the time limit while the broker has not written", () => {
    expect(canResumeDistributedQualification(base)).toBe(true);
  });

  it("stays quiet once the broker talked to the customer", () => {
    expect(canResumeDistributedQualification({ ...base, brokerMessagesSinceAssignment: 1 })).toBe(false);
  });

  it("never resumes a finished qualification, a lead without broker, or a closed sale", () => {
    expect(canResumeDistributedQualification({ ...base, qualificationState: "QUALIFIED" })).toBe(false);
    expect(canResumeDistributedQualification({ ...base, corretorId: null })).toBe(false);
    expect(canResumeDistributedQualification({ ...base, leadStatus: "lost" })).toBe(false);
    expect(canResumeDistributedQualification({ ...base, leadStatus: "converted" })).toBe(false);
    expect(canResumeDistributedQualification({ ...base, conversationStatus: "HUMAN_ACTIVE" })).toBe(false);
  });

  it("routes the official WhatsApp message of a distributed, unfinished lead", () => {
    expect(isDistributedPartialQualification({ corretorId: "b", qualificationState: "PARTIAL" })).toBe(true);
    expect(isDistributedPartialQualification({ corretorId: null, qualificationState: "PARTIAL" })).toBe(false);
    expect(isDistributedPartialQualification(undefined)).toBe(false);
  });

  it("ends naming the broker by first name, without the system code", () => {
    expect(brokerFirstName("Lilian Martins 9209")).toBe("Lilian");
    expect(brokerFirstName("12031 luiz Marques")).toBe("Luiz");
    expect(brokerFirstName("")).toBeNull();
    expect(distributedHandoffText("Lilian Martins 9209")).toBe("Pronto, já passei suas informações para Lilian, que vai continuar seu atendimento por aqui.");
    expect(distributedHandoffText(null)).toBeNull();
  });
});
