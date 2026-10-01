import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", () => ({ getDatabase: vi.fn(), schema: {} }));

describe("a library message sent by the company number keeps the notice's link", () => {
  it("appends the link a message is missing, and leaves one that has it", async () => {
    const { withNoticeLink } = await import("./service");
    const link = "https://crm.ancorasaude.cloud/leads/abc";
    expect(withNoticeLink("Oi Ana, chegou um lead pra você!", link)).toBe(`Oi Ana, chegou um lead pra você!\n\n${link}`);
    expect(withNoticeLink(`Oi Ana! Aceite: ${link}`, link)).toBe(`Oi Ana! Aceite: ${link}`);
    expect(withNoticeLink("Lembrete de tarefa", null)).toBe("Lembrete de tarefa");
  });
});
