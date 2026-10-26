import { describe, expect, it } from "vitest";
import { buildPrivateQualificationContext, evaluateQualification, leadMatchesQualificationEntryRules, qualificationLeadColumns, replaceHandoffTextPreservingExtension, resolveDeterministicQualificationTurn } from "./service";
import { createEmptyMemory } from "@/features/ai-agent/memory";
import type { AgentBehaviorPolicy } from "@/features/agent-training/service";
import { afterHoursText } from "./broker-window";
import { AFTER_HOURS_QUALIFIED_HANDOFF_TEXT, DEFAULT_QUALIFIED_HANDOFF_TEXT, effectiveHandoffText, renderConversationVariables } from "./reply-composer";

const policy = {
  assistantName: "Ana", tone: "friendly", formOfAddress: "voce", objective: "qualify_and_handoff",
  requiredFields: ["customerName", "city"], maxQuestions: 2, businessDays: "", handoffMessage: "Encaminho.", quickReplyTemplates: {}, knowledgePolicy: { enabled: false, requireSourceForCommercialClaims: true },
  qualification: { profileKey: "pf", fieldWeights: { customerName: 40, city: 60 }, entryRules: { origins: ["meta"], campaigns: [], leadTypes: ["PF"], branchIds: [], tags: [] } },
} satisfies AgentBehaviorPolicy;

describe("scripted reply acknowledgement", () => {
  const memory = { ...createEmptyMemory(), customerName: { value: "Teste Lead", confidence: 1 as const }, customerFirstName: { value: "Teste", confidence: 1 as const }, collectedFields: ["customerName"] };
  it("confirms only what the customer's last message answered", () => {
    expect(resolveDeterministicQualificationTurn({ memory, policy, answered: ["customerName"] }).reply).toMatch(/^(Prazer, Teste!|Que bom falar com você, Teste!) /);
    expect(resolveDeterministicQualificationTurn({ memory, policy }).reply).toMatch(/^(Em qual cidade|Me conta sua cidade)/);
    expect(resolveDeterministicQualificationTurn({ memory, policy, answered: ["customerName"], answeredNow: false }).reply).toMatch(/^(Em qual cidade|Me conta sua cidade)/);
  });

  it("renders the name and the summary in the handoff text", () => {
    const done = { ...memory, city: { value: "Itaboraí", confidence: 1 as const }, collectedFields: ["customerName", "city"] };
    expect(resolveDeterministicQualificationTurn({ memory: done, policy, handoffMessage: "Obrigado, {{nome}}! ({{resumo}})" }).reply).toBe("Obrigado, Teste! (Itaboraí)");
  });

  it("keeps the optional relation invitation after switching a two-age handoff to the night text", () => {
    const family = {
      ...memory,
      planType: { value: "familiar", confidence: 1 as const },
      numberOfLives: { value: "2", confidence: 1 as const },
      age: { value: "46, 10", confidence: 1 as const },
      collectedFields: ["customerName", "city", "planType", "numberOfLives", "age"],
    };
    const turn = resolveDeterministicQualificationTurn({ memory: family, policy });
    const daytimeHandoff = renderConversationVariables(effectiveHandoffText(null, DEFAULT_QUALIFIED_HANDOFF_TEXT), family);
    const nightText = renderConversationVariables(
      afterHoursText(null, DEFAULT_QUALIFIED_HANDOFF_TEXT, AFTER_HOURS_QUALIFIED_HANDOFF_TEXT, new Date("2026-10-21T23:00:00.000Z")),
      family,
    );

    expect(turn.beneficiaryInvitation).toBeTruthy();
    const nightTurn = replaceHandoffTextPreservingExtension(turn, daytimeHandoff, nightText);
    expect(nightTurn.reply).toBe(`${nightText} ${turn.beneficiaryInvitation}`);
  });
});

describe("flow chosen by the director (Atendimento > Fluxo)", () => {
  it("asks in the saved order and with the director's text", () => {
    const custom: AgentBehaviorPolicy = { ...policy, requiredFields: ["city", "customerName"], questionTexts: { city: "De qual cidade você fala?" } };
    expect(resolveDeterministicQualificationTurn({ memory: createEmptyMemory(), policy: custom }).reply).toBe("De qual cidade você fala?");
  });

  it("keeps the director's saved text exact even when it was already asked", () => {
    const custom: AgentBehaviorPolicy = { ...policy, requiredFields: ["city", "customerName"], questionTexts: { city: "De qual cidade você fala?" } };
    const reply = resolveDeterministicQualificationTurn({ memory: createEmptyMemory(), policy: custom, pastOutboundTexts: new Set(["De qual cidade você fala?"]) }).reply;
    expect(reply).toBe("De qual cidade você fala?");
  });
});

describe("lead columns during a live AI conversation", () => {
  it("keeps the lead in qualification while nothing was collected, so distribution waits", () => {
    const empty = evaluateQualification(createEmptyMemory(), policy);
    expect(empty.state).toBe("NOT_STARTED");
    expect(qualificationLeadColumns(empty)).toEqual({ qualificationState: "IN_PROGRESS", qualificationStatus: "qualifying" });
  });

  it("writes any other outcome as evaluated", () => {
    expect(qualificationLeadColumns({ state: "QUALIFIED", qualificationStatus: "hot" })).toEqual({ qualificationState: "QUALIFIED", qualificationStatus: "hot" });
    expect(qualificationLeadColumns({ state: "IN_PROGRESS", qualificationStatus: "pending" })).toEqual({ qualificationState: "IN_PROGRESS", qualificationStatus: "pending" });
  });
});

describe("qualification engine", () => {
  it("calculates a weighted, incomplete qualification without changing commercial status", () => {
    const result = evaluateQualification({ customerName: { value: "Ana", confidence: 1 }, collectedFields: ["customerName"] }, policy);
    expect(result).toMatchObject({ state: "IN_PROGRESS", score: 40, qualificationStatus: "pending", missingFields: ["city"] });
  });
  it("keeps entry rules deterministic and opt-in", () => {
    expect(leadMatchesQualificationEntryRules({ origem: "meta", sourceCampaign: null, tipo: "PF", branchId: null }, policy)).toBe(true);
    expect(leadMatchesQualificationEntryRules({ origem: "manual", sourceCampaign: null, tipo: "PF", branchId: null }, policy)).toBe(false);
  });
  it("treats the PME average age as the required age field", () => {
    const pmePolicy: AgentBehaviorPolicy = { ...policy, requiredFields: ["planType", "numberOfLives", "age"] };
    const result = evaluateQualification({
      planType: { value: "empresarial", confidence: 1 },
      numberOfLives: { value: "18", confidence: 1 },
      averageAge: { value: "36", confidence: 1 },
      collectedFields: ["planType", "numberOfLives", "age"],
    }, pmePolicy);
    expect(result).toMatchObject({ state: "QUALIFIED", missingFields: [] });
  });

  it("builds a private, structured context from facts captured in a long answer", () => {
    const context = buildPrivateQualificationContext({
      ...createEmptyMemory(),
      planType: { value: "empresarial", confidence: 1 },
      numberOfLives: { value: "2", confidence: 1 },
      averageAge: { value: "62", confidence: 1 },
      city: { value: "Recreio dos Bandeirantes", confidence: 1 },
      intent: { value: "opções mais baratas", confidence: 1 },
      collectedFields: ["planType", "numberOfLives", "age", "city", "intent"],
    });

    expect(context.source).toBe("ai_qualification");
    expect(context.summary).toContain("Recreio dos Bandeirantes");
    expect(context.facts).toEqual(expect.arrayContaining([
      "tipo de plano: empresarial",
      "vidas: 2",
      "média de idade: 62",
      "cidade: Recreio dos Bandeirantes",
      "interesse: opções mais baratas",
    ]));
    expect(context.memory.planType?.value).toBe("empresarial");
  });
});
