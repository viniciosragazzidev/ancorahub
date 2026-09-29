import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", () => ({ getDatabase: () => { throw new Error("no database in unit tests"); }, schema: {} }));

import { resolveQuickReply } from "@/features/ai-agent/quick-reply";
import { BUILTIN_SITUATIONS, cleanPhrases, detectLateralSituation, phraseMatches, quickReplyTuning, type TenantSituation } from "./catalog";

const builtinRow = (key: string, phrases: string[], enabled = true): TenantSituation => ({ key, kind: "builtin", title: null, examplePhrases: phrases, response: null, action: null, enabled });
const customRow = (key: string, title: string, phrases: string[], action: "continue" | "transfer" = "continue", enabled = true): TenantSituation => ({ key, kind: "custom", title, examplePhrases: phrases, response: `Resposta de ${title}`, action, enabled });
const quick = (body: string, situations: TenantSituation[], conversationState: "AI_ACTIVE" | "WAITING_HUMAN" = "AI_ACTIVE") =>
  resolveQuickReply({ body, conversationState, isNewConversation: false, hasPriorMessages: true, hasPendingQuestion: true, ...quickReplyTuning(situations) });

describe("phrases", () => {
  it("matches whole words, without accents or punctuation", () => {
    expect(phraseMatches("Vocês atendem em Niterói?", ["atendem em niteroi"])).toBe(true);
    expect(phraseMatches("Niteroiense", ["niteroi"])).toBe(false);
    expect(phraseMatches("qualquer coisa", [])).toBe(false);
  });

  it("cleans, deduplicates and limits typed phrases", () => {
    expect(cleanPhrases(["  Quero  falar com alguém ", "quero falar com alguem", "x", ""])).toEqual(["Quero falar com alguém"]);
    expect(cleanPhrases(Array.from({ length: 40 }, (_, index) => `frase ${index}`))).toHaveLength(30);
  });
});

describe("taught phrases in the quick replies", () => {
  it("recognizes a request for a person the system did not know", () => {
    expect(quick("chama a moça do atendimento", []).resolved).toBe(false);
    expect(quick("chama a moça do atendimento", [builtinRow("human.requested", ["moca do atendimento"])])).toMatchObject({ intent: "REQUEST_HUMAN", templateKey: "human.requested" });
  });

  it("never switches off a critical situation, and switches off an optional one", () => {
    const tuning = quickReplyTuning([builtinRow("opt_out.confirmed", [], false), builtinRow("urgent.requested", [], false)]);
    expect(tuning.disabledRules).toEqual(["urgent"]);
    expect(quick("sair", [builtinRow("opt_out.confirmed", [], false)]).intent).toBe("OPT_OUT");
    expect(quick("é urgente", [builtinRow("urgent.requested", [], false)]).resolved).toBe(false);
  });

  it("keeps the critical situations marked as such", () => {
    expect(BUILTIN_SITUATIONS.filter((item) => item.critical).map((item) => item.key).sort()).toEqual(["human.requested", "opt_out.confirmed", "wrong_number.confirmed"]);
  });
});

describe("questions in the middle of the qualification", () => {
  it("checks the tenant's own situations first", () => {
    const own = customRow("custom:1", "Atendem em Niterói?", ["atendem em niteroi"]);
    expect(detectLateralSituation("vocês atendem em Niterói? qual o valor?", [own])).toMatchObject({ kind: "custom", label: "Atendem em Niterói?", action: "continue" });
  });

  it("keeps a switched-off own situation and an empty reply out", () => {
    expect(detectLateralSituation("atendem em niteroi", [customRow("custom:1", "Niterói", ["atendem em niteroi"], "continue", false)])).toBeNull();
    expect(detectLateralSituation("atendem em niteroi", [{ ...customRow("custom:1", "Niterói", ["atendem em niteroi"]), response: " " }])).toBeNull();
  });

  it("uses taught phrases and the built-in recognition of the common questions, unless switched off", () => {
    expect(detectLateralSituation("quanto custa?", [])).toMatchObject({ kind: "faq", key: "faq.price" });
    expect(detectLateralSituation("sai caro?", [builtinRow("faq.price", ["sai caro"])])).toMatchObject({ kind: "faq", key: "faq.price" });
    expect(detectLateralSituation("quanto custa?", [builtinRow("faq.price", [], false)])).toBeNull();
    expect(detectLateralSituation("Itaboraí", [])).toBeNull();
  });

  it("transfers when that is the own situation's action", () => {
    expect(detectLateralSituation("quero cancelar meu plano atual", [customRow("custom:2", "Cancelamento", ["cancelar meu plano"], "transfer")])).toMatchObject({ kind: "custom", action: "transfer" });
  });
});
