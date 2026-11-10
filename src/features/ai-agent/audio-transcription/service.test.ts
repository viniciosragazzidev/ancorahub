import { beforeEach, describe, expect, it, vi } from "vitest";

import { opusOggFixture } from "./ogg-fixture";

/*
 * Banco em memória com o mínimo que o serviço usa (select/insert/update e os
 * dois índices únicos da 0225), para provar os limites de ponta a ponta:
 * os 2 primeiros áudios do lead em qualificação viram texto, o 3º não.
 */
type Row = Record<string, unknown>;
type Column = { table: string; key: string };
type Predicate = (row: Row) => boolean;

const state = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  flag: true,
  audio: new Uint8Array(0),
  transcribe: vi.fn(),
  usage: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("drizzle-orm", () => ({
  and: (...predicates: Array<Predicate | undefined>) => (row: Row) => predicates.every((predicate) => !predicate || predicate(row)),
  eq: (column: Column, value: unknown) => (row: Row) => row[column.key] === value,
  isNotNull: (column: Column) => (row: Row) => row[column.key] !== null && row[column.key] !== undefined,
  inArray: (column: Column, values: unknown[]) => (row: Row) => values.includes(row[column.key]),
}));
vi.mock("@/shared/db", () => {
  const schema = new Proxy({}, {
    get: (_target, table: string) => new Proxy({ __table: table }, {
      get: (target, key: string) => (key === "__table" ? target.__table : { table, key }),
    }),
  });
  const tableName = (table: { __table: string }) => table.__table;
  const rowsOf = (name: string) => (state.tables[name] ??= []);
  const pick = (fields: Record<string, Column> | undefined, row: Row) =>
    fields ? Object.fromEntries(Object.entries(fields).map(([alias, column]) => [alias, row[column.key]])) : { ...row };

  function violatesUnique(name: string, row: Row) {
    if (name !== "leadAudioTranscriptions") return false;
    return rowsOf(name).some((other) =>
      other.tenantId === row.tenantId && (
        other.providerMessageId === row.providerMessageId
        || (row.slot != null && other.leadId === row.leadId && other.slot === row.slot)
      ));
  }

  const database = {
    select: (fields?: Record<string, Column>) => ({
      from: (table: { __table: string }) => ({
        where: (predicate: Predicate) => {
          const run = (limit?: number) => rowsOf(tableName(table)).filter(predicate).slice(0, limit).map((row) => pick(fields, row));
          const result = Promise.resolve().then(() => run());
          return Object.assign(result, { limit: (limit: number) => Promise.resolve(run(limit)) });
        },
      }),
    }),
    insert: (table: { __table: string }) => ({
      values: (row: Row) => ({
        onConflictDoNothing: () => {
          const name = tableName(table);
          const insert = () => {
            if (violatesUnique(name, row)) return [];
            rowsOf(name).push({ ...row });
            return [row];
          };
          let done: Row[] | null = null;
          const once = () => (done ??= insert());
          return Object.assign(Promise.resolve().then(once), {
            returning: (fields: Record<string, Column>) => Promise.resolve().then(() => once().map((inserted) => pick(fields, inserted))),
          });
        },
      }),
    }),
    update: (table: { __table: string }) => ({
      set: (patch: Row) => ({
        where: (predicate: Predicate) => Promise.resolve().then(() => {
          for (const row of rowsOf(tableName(table)).filter(predicate)) Object.assign(row, patch);
        }),
      }),
    }),
  };
  return { getDatabase: () => database, schema };
});
vi.mock("./flag", () => ({ isAiAudioTranscriptionEnabled: async () => state.flag }));
vi.mock("@/shared/storage/r2-storage", () => ({
  downloadR2Object: async () => new Blob([state.audio]),
}));
vi.mock("./transcriber", () => ({
  resolveTranscriptionTarget: async () => ({ provider: "groq", model: "whisper-large-v3-turbo", apiKey: "test" }),
  transcribeAudio: (...args: unknown[]) => state.transcribe(...args),
}));
vi.mock("../ai-usage-log", () => ({ logAiUsage: (...args: unknown[]) => state.usage(...args) }));

import { createEmptyMemory, extractFieldsFromMessage } from "../memory";
import { prepareQualificationAudio } from "./service";

const TENANT = "tenant-1";
const LEAD = "lead-1";

function seedLead(patch: Row = {}) {
  state.tables.leads.push({ id: LEAD, tenantId: TENANT, qualificationStatus: "qualifying", distributionStatus: "unassigned", corretorId: null, ...patch });
}

function seedAudio(messageId: string, patch: Row = {}) {
  state.tables.whatsappMessages.push({
    tenantId: TENANT, leadId: LEAD, messageId, body: "[audio]", mediaKind: "audio",
    mediaMimeType: "audio/ogg; codecs=opus", mediaSizeBytes: 4_000, mediaStorageKey: `whatsapp-media/${messageId}.ogg`, ...patch,
  });
}

const prepare = (messageId: string, patch: Partial<Parameters<typeof prepareQualificationAudio>[0]> = {}) =>
  prepareQualificationAudio({ tenantId: TENANT, leadId: LEAD, providerMessageId: messageId, conversationStatus: "AI_ACTIVE", automationState: "AI_ACTIVE", ...patch });

const bodyOf = (messageId: string) => state.tables.whatsappMessages.find((row) => row.messageId === messageId)?.body;
const slotsUsed = () => state.tables.leadAudioTranscriptions.filter((row) => row.slot != null).length;

beforeEach(() => {
  state.tables = { leads: [], whatsappMessages: [], leadAudioTranscriptions: [] };
  state.flag = true;
  state.audio = opusOggFixture(20);
  state.transcribe.mockReset();
  state.transcribe.mockImplementation(async () => ({ text: "Meu nome é Ana, tenho 34 anos e moro em Niterói", durationSeconds: 20 }));
  state.usage.mockReset();
});

describe("IA ouve os 2 primeiros áudios do lead em qualificação", () => {
  it("transcreve o 1º e o 2º, recusa o 3º sem chamar o provedor", async () => {
    seedLead();
    seedAudio("a1");
    seedAudio("a2");
    seedAudio("a3");

    expect(await prepare("a1")).toEqual({ kind: "transcribed", text: "Meu nome é Ana, tenho 34 anos e moro em Niterói" });
    expect(await prepare("a2")).toMatchObject({ kind: "transcribed" });
    expect(await prepare("a3")).toEqual({ kind: "declined", reason: "over_limit" });

    expect(state.transcribe).toHaveBeenCalledTimes(2);
    expect(bodyOf("a1")).toBe("Meu nome é Ana, tenho 34 anos e moro em Niterói");
    expect(bodyOf("a3")).toBe("[audio]");
    expect(slotsUsed()).toBe(2);
    expect(state.tables.leadAudioTranscriptions.map((row) => [row.providerMessageId, row.slot, row.status])).toEqual([
      ["a1", 1, "transcribed"],
      ["a2", 2, "transcribed"],
      ["a3", null, "over_limit"],
    ]);
    // Uso e custo registrados por chamada.
    expect(state.usage).toHaveBeenCalledTimes(2);
    expect(state.usage.mock.calls[0]![0]).toMatchObject({ purpose: "audio_transcription", success: true, leadId: LEAD });
  });

  it("o texto do áudio alimenta a qualificação como se o cliente tivesse escrito", async () => {
    seedLead();
    seedAudio("k1");
    state.transcribe.mockResolvedValueOnce({ text: "Oi, meu nome é Maria Eduarda, tenho 29 anos e moro em Salvador", durationSeconds: 8 });
    const outcome = await prepare("k1");
    expect(outcome.kind).toBe("transcribed");
    const memory = extractFieldsFromMessage(outcome.kind === "transcribed" ? outcome.text : "", createEmptyMemory());
    expect(memory.customerName?.value).toBe("Maria Eduarda");
    expect(memory.age?.value).toBe("29");
    expect(memory.city?.value).toBe("Salvador");
  });

  it("dois áudios simultâneos além do limite nunca passam de 2 vezes", async () => {
    seedLead();
    for (const id of ["b1", "b2", "b3", "b4"]) seedAudio(id);
    const results = await Promise.all(["b1", "b2", "b3", "b4"].map((id) => prepare(id)));

    expect(results.filter((result) => result.kind === "transcribed")).toHaveLength(2);
    expect(slotsUsed()).toBe(2);
    expect(state.transcribe).toHaveBeenCalledTimes(2);
  });

  it("o mesmo áudio processado de novo devolve o texto sem gastar outra vez", async () => {
    seedLead();
    seedAudio("c1");
    await prepare("c1");
    expect(await prepare("c1")).toMatchObject({ kind: "transcribed", text: "Meu nome é Ana, tenho 34 anos e moro em Niterói" });
    expect(state.transcribe).toHaveBeenCalledTimes(1);
    expect(slotsUsed()).toBe(1);
  });

  it.each([
    ["qualificado", { qualificationStatus: "qualified" }],
    ["frio", { qualificationStatus: "cold" }],
    ["com corretor", { corretorId: "broker-1" }],
    ["segurado pelo diretor", { distributionStatus: "manual_hold" }],
  ])("não transcreve áudio de lead %s", async (_label, patch) => {
    seedLead(patch);
    seedAudio("d1");
    expect(await prepare("d1")).toEqual({ kind: "skipped", reason: "not_in_qualification" });
    expect(state.transcribe).not.toHaveBeenCalled();
    expect(bodyOf("d1")).toBe("[audio]");
    expect(state.tables.leadAudioTranscriptions).toHaveLength(0);
  });

  it("não transcreve quando a conversa saiu da IA ou é turno de correção", async () => {
    seedLead();
    seedAudio("e1");
    expect(await prepare("e1", { conversationStatus: "WAITING_HUMAN" })).toMatchObject({ kind: "skipped", reason: "not_in_qualification" });
    expect(await prepare("e1", { correctionOnly: true })).toMatchObject({ kind: "skipped", reason: "not_in_qualification" });
    expect(state.transcribe).not.toHaveBeenCalled();
  });

  it("flag da empresa desligada: nada muda", async () => {
    state.flag = false;
    seedLead();
    seedAudio("f1");
    expect(await prepare("f1")).toEqual({ kind: "skipped", reason: "flag_off" });
    expect(state.tables.leadAudioTranscriptions).toHaveLength(0);
  });

  it("áudio acima de 2 minutos pede resumo e não gasta a vez", async () => {
    seedLead();
    seedAudio("g1");
    seedAudio("g2");
    state.audio = opusOggFixture(150);
    expect(await prepare("g1")).toEqual({ kind: "declined", reason: "too_long" });
    state.audio = opusOggFixture(30);
    expect(await prepare("g2")).toMatchObject({ kind: "transcribed" });
    expect(state.transcribe).toHaveBeenCalledTimes(1);
    expect(state.tables.leadAudioTranscriptions.find((row) => row.providerMessageId === "g2")?.slot).toBe(1);
  });

  it("falha do provedor pede para escrever e conta como uma das 2 vezes", async () => {
    seedLead();
    seedAudio("h1");
    state.transcribe.mockRejectedValueOnce(new Error("timeout"));
    expect(await prepare("h1")).toEqual({ kind: "declined", reason: "failed" });
    expect(bodyOf("h1")).toBe("[audio]");
    expect(state.tables.leadAudioTranscriptions[0]).toMatchObject({ slot: 1, status: "failed" });
    expect(state.usage.mock.calls[0]![0]).toMatchObject({ success: false });
  });

  it("áudio sem fala reconhecida pede para escrever", async () => {
    seedLead();
    seedAudio("i1");
    state.transcribe.mockResolvedValueOnce({ text: "   ", durationSeconds: 3 });
    expect(await prepare("i1")).toEqual({ kind: "declined", reason: "failed" });
    expect(bodyOf("i1")).toBe("[audio]");
  });

  it("áudio sem arquivo guardado pede para escrever sem gastar a vez", async () => {
    seedLead();
    seedAudio("j1", { mediaStorageKey: null, mediaKind: null });
    expect(await prepare("j1")).toEqual({ kind: "declined", reason: "no_file" });
    expect(slotsUsed()).toBe(0);
  });
});
