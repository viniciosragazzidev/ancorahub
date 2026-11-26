import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { TenantContext } from "@/shared/auth/types";

const state = vi.hoisted(() => ({
  ready: true,
  results: [] as unknown[][],
  inserts: [] as { table: unknown; values: unknown }[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/reports/metrics/metric-scope", () => ({ resolveReportDataScope: async () => ({ leadScope: undefined }) }));
vi.mock("@/shared/db", async () => {
  const schema = await import("@/shared/db/schema");
  function chain() {
    const result = state.results.shift() ?? [];
    const builder: Record<string, unknown> = {};
    for (const name of ["from", "orderBy", "leftJoin", "where", "limit"]) builder[name] = () => builder;
    builder.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
    return builder;
  }
  return {
    schema,
    getDatabase: () => ({
      execute: async () => [{ ready: state.ready }],
      select: () => chain(),
      insert: (table: unknown) => ({ values: async (values: unknown) => { state.inserts.push({ table, values }); } }),
    }),
  };
});

import { schema } from "@/shared/db";

import {
  DIRECTION_HOLD_REPLY,
  buildTaughtKnowledge,
  canAnswerDirectionQuestions,
  carrierNamedIn,
  findTaughtAnswer,
  shouldAskDirection,
  toExcerptLine,
  validateDirectionAnswer,
} from "./direction-questions-core";
import { answerDirectionQuestion, findTaughtDirectionAnswer, recordDirectionQuestion, type DirectionAnswerPorts, type StoredDirectionQuestion } from "./direction-questions-service";

let clock = Date.UTC(2026, 10, 26, 12);
vi.useFakeTimers({ toFake: ["Date"] });

beforeEach(() => {
  // O "a tabela existe?" fica 1 minuto em cache: cada teste anda o relógio para ler de novo.
  clock += 5 * 60_000;
  vi.setSystemTime(clock);
  state.ready = true;
  state.results = [];
  state.inserts = [];
});

afterAll(() => {
  vi.useRealTimers();
});

const director = { userId: "dir-1", tenantId: "t1", role: "director", jobTitle: "director", branchId: null } as TenantContext;
const supervisor = { ...director, role: "supervisor", jobTitle: "supervisor" } as TenantContext;

const recordInput = {
  tenantId: "t1", leadId: "lead-1", conversationId: "conv-1", phone: "5521999990000", transport: "waha", wahaRunId: "run-1",
  question: "A Amil cobre o Hospital Copa Star? meu email é ana@x.com",
};

describe("quando a IA leva a pergunta para a direção", () => {
  it("resposta lateral que só adiou vira pergunta para a direção", () => {
    expect(shouldAskDirection("Vocês trabalham com qual operadora?", "O corretor vai detalhar isso na cotação.")).toBe(true);
  });

  it("sem resposta lateral, só pergunta de fato específico (cobertura, MEI, carência) vai para a direção", () => {
    expect(shouldAskDirection("A Amil cobre o Hospital Copa Star?", null)).toBe(true);
    expect(shouldAskDirection("Aceita CNPJ MEI?", null)).toBe(true);
    expect(shouldAskDirection("Qual a carência para parto no Bradesco?", null)).toBe(true);
    expect(shouldAskDirection("Vocês abrem sábado?", null)).toBe(false);
  });

  it("pergunta de preço e resposta que a IA deu de verdade seguem como antes", () => {
    expect(shouldAskDirection("Quanto custa o plano da Amil?", null)).toBe(false);
    expect(shouldAskDirection("Aceita MEI?", "Sim, trabalhamos com planos para MEI.")).toBe(false);
  });

  it("a frase ao lead é neutra e não usa travessão", () => {
    expect(DIRECTION_HOLD_REPLY).toBe("Vou confirmar isso com a equipe e já te retorno.");
    expect(DIRECTION_HOLD_REPLY).not.toContain("—");
  });
});

describe("registro da pergunta", () => {
  it("grava a pergunta sem dado pessoal, com o canal da conversa e o trecho da conversa", async () => {
    state.results = [
      [], // nenhuma igual aberta
      [
        { direction: "outbound", senderRole: "assistant", body: "Qual a sua idade?", sentAt: new Date("2026-11-26T11:59:00Z") },
        { direction: "incoming", senderRole: null, body: "A Amil cobre o Copa Star?", sentAt: new Date("2026-11-26T11:58:00Z") },
      ],
    ];
    expect(await recordDirectionQuestion(recordInput)).toBe(true);
    expect(state.inserts).toHaveLength(1);
    expect(state.inserts[0]!.table).toBe(schema.aiDirectionQuestions);
    const values = state.inserts[0]!.values as Record<string, unknown>;
    expect(values).toMatchObject({ tenantId: "t1", leadId: "lead-1", conversationId: "conv-1", transport: "waha", wahaRunId: "run-1", status: "open" });
    expect(values.question).toContain("[e-mail]");
    expect(values.question).not.toContain("ana@x.com");
    // Mais antiga primeiro: o diretor lê a conversa na ordem.
    expect((values.excerpt as { from: string }[]).map((line) => line.from)).toEqual(["lead", "ia"]);
  });

  it("a mesma pergunta já aberta nesta conversa não duplica, mas a IA segue dizendo que vai confirmar", async () => {
    state.results = [[{ id: "q-1" }]];
    expect(await recordDirectionQuestion(recordInput)).toBe(true);
    expect(state.inserts).toHaveLength(0);
  });

  it("antes da migration 0246 nada é gravado e a IA segue como hoje", async () => {
    state.ready = false;
    expect(await recordDirectionQuestion(recordInput)).toBe(false);
    expect(await findTaughtDirectionAnswer("t1", "A Amil cobre o Copa Star?")).toBeNull();
    expect(state.inserts).toHaveLength(0);
  });

  it("trecho: quem falou e texto sem telefone", () => {
    expect(toExcerptLine({ direction: "inbound", senderRole: null, body: "me liga no 21 99999-0000", sentAt: null })).toEqual({ from: "lead", text: "me liga no [número]", at: null });
    expect(toExcerptLine({ direction: "outbound", senderRole: "agent", body: "Oi", sentAt: null })?.from).toBe("equipe");
    expect(toExcerptLine({ direction: "outbound", senderRole: "assistant", body: "  ", sentAt: null })).toBeNull();
  });
});

function question(overrides: Partial<StoredDirectionQuestion> = {}): StoredDirectionQuestion {
  return {
    id: "q-1", tenantId: "t1", leadId: "lead-1", phone: "5521999990000", transport: "meta", conversationId: "conv-1",
    communicationChannelId: "ch-1", wahaRunId: null, question: "A Amil cobre o Hospital Copa Star?", status: "open", ...overrides,
  };
}

function ports(stored: StoredDirectionQuestion | null = question(), overrides: Partial<DirectionAnswerPorts> = {}) {
  const calls = { sent: [] as string[], taught: [] as string[], saved: [] as unknown[] };
  const value: DirectionAnswerPorts = {
    load: async () => stored,
    sendToLead: async (_q, text) => { calls.sent.push(text); },
    teach: async (_q, answer) => { calls.taught.push(answer); return "doc-1"; },
    save: async (_q, update) => { calls.saved.push(update); },
    ...overrides,
  };
  return { value, calls };
}

describe("resposta da direção", () => {
  it("envia ao lead pelo canal da conversa, ensina a IA e marca como respondida", async () => {
    const { value, calls } = ports();
    const result = await answerDirectionQuestion(director, { id: "q-1", answer: "  Sim, no plano S450.  ", sendToLead: true, teach: true }, value);
    expect(calls.sent).toEqual(["Sim, no plano S450."]);
    expect(calls.taught).toEqual(["Sim, no plano S450."]);
    expect(calls.saved).toEqual([expect.objectContaining({ answer: "Sim, no plano S450.", actorUserId: "dir-1", taughtDocumentId: "doc-1", sentToLeadAt: expect.any(Date) })]);
    expect(result.taughtDocumentId).toBe("doc-1");
  });

  it("envio falhou: nada é ensinado nem gravado, a pergunta segue aberta", async () => {
    const { value, calls } = ports(question(), { sendToLead: async () => { throw new Error("Meta fora da janela"); } });
    await expect(answerDirectionQuestion(director, { id: "q-1", answer: "Sim.", sendToLead: true, teach: true }, value)).rejects.toThrow("Meta fora da janela");
    expect(calls.taught).toEqual([]);
    expect(calls.saved).toEqual([]);
  });

  it("só guardar: sem envio e sem ensinar", async () => {
    const { value, calls } = ports();
    await answerDirectionQuestion(director, { id: "q-1", answer: "Não cobre.", sendToLead: false, teach: false }, value);
    expect(calls.sent).toEqual([]);
    expect(calls.taught).toEqual([]);
    expect(calls.saved).toEqual([expect.objectContaining({ sentToLeadAt: null, taughtDocumentId: null })]);
  });

  it("só diretor e gestor de unidade respondem", async () => {
    expect(canAnswerDirectionQuestions("director")).toBe(true);
    expect(canAnswerDirectionQuestions("manager", "manager")).toBe(true);
    expect(canAnswerDirectionQuestions("manager", "marketing")).toBe(false);
    expect(canAnswerDirectionQuestions("supervisor")).toBe(false);
    expect(canAnswerDirectionQuestions("broker")).toBe(false);
    const { value, calls } = ports();
    await expect(answerDirectionQuestion(supervisor, { id: "q-1", answer: "Sim.", sendToLead: true, teach: true }, value)).rejects.toThrow("Só o diretor ou o gestor da unidade");
    expect(calls.sent).toEqual([]);
  });

  it("pergunta fora do escopo, já respondida ou resposta vazia é recusada antes de enviar", async () => {
    await expect(answerDirectionQuestion(director, { id: "q-1", answer: "Sim.", sendToLead: true, teach: false }, ports(null).value)).rejects.toThrow("Pergunta não encontrada.");
    await expect(answerDirectionQuestion(director, { id: "q-1", answer: "Sim.", sendToLead: true, teach: false }, ports(question({ status: "answered" })).value)).rejects.toThrow("já foi respondida");
    expect(validateDirectionAnswer({ id: "q-1", answer: " ", sendToLead: true, teach: true })).toEqual({ ok: false, error: "Escreva a resposta antes de enviar." });
    expect(validateDirectionAnswer({ id: "q-1", answer: "x".repeat(1001), sendToLead: true, teach: true }).ok).toBe(false);
  });
});

describe("Ensinar a IA", () => {
  it("o texto guardado tem a pergunta, a resposta da direção e a operadora citada", () => {
    const carrier = carrierNamedIn("A Amil cobre o Copa Star?", [{ id: "c-1", name: "Bradesco" }, { id: "c-2", name: "Amil" }]);
    expect(carrier?.id).toBe("c-2");
    const knowledge = buildTaughtKnowledge({ question: "A Amil cobre o Copa Star?", answer: "Sim, no S450.", carrierName: carrier?.name });
    expect(knowledge.title).toBe("Resposta da direção: A Amil cobre o Copa Star?");
    expect(knowledge.content).toContain("Operadora: Amil.");
    expect(knowledge.content).toContain("Resposta confirmada pela direção: Sim, no S450.");
    expect(carrierNamedIn("Aceita MEI?", [{ id: "c-2", name: "Amil" }])).toBeNull();
  });

  it("da próxima vez, pergunta parecida recebe a resposta ensinada; outra operadora não", () => {
    const taught = [{ question: "A Amil cobre o Hospital Copa Star?", answer: "Sim, no plano S450." }];
    expect(findTaughtAnswer("amil cobre hospital copa star", taught)).toBe("Sim, no plano S450.");
    expect(findTaughtAnswer("Oi, a Amil cobre o hospital Copa Star?", taught)).toBe("Sim, no plano S450.");
    expect(findTaughtAnswer("A Bradesco cobre o Copa Star?", taught)).toBeNull();
    expect(findTaughtAnswer("Aceita MEI?", taught)).toBeNull();
  });

  it("a IA busca só as respostas ensinadas da empresa", async () => {
    state.results = [[{ question: "Aceita CNPJ MEI?", answer: "Sim, a partir de 2 vidas." }]];
    expect(await findTaughtDirectionAnswer("t1", "Vocês aceitam CNPJ MEI?")).toBe("Sim, a partir de 2 vidas.");
  });
});
