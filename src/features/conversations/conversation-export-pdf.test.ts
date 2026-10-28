import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  conversationChannelLabel,
  conversationMessageBody,
  conversationMessageTone,
  conversationSenderLabel,
  encodeConversationExportPdf,
  pdfSafeText,
  wrapPdfText,
  type ConversationExportInput,
} from "./conversation-export-pdf";

describe("conversation export", () => {
  it("names who sent each message like the conversation screen", () => {
    expect(conversationSenderLabel("incoming", null)).toBe("Cliente");
    expect(conversationSenderLabel("outgoing", "assistant")).toBe("IA Assistente");
    expect(conversationSenderLabel("outbound", null)).toBe("IA Assistente");
    expect(conversationSenderLabel("outgoing", "supervisor")).toBe("Supervisor");
    expect(conversationSenderLabel("outgoing", "user")).toBe("Atendente");
    expect(conversationChannelLabel("meta_cloud")).toBe("WhatsApp oficial");
    expect(conversationChannelLabel("waha")).toBe("WhatsApp (WAHA)");
    expect(conversationChannelLabel(null)).toBeNull();
    expect(conversationMessageTone("incoming", null)).toBe("client");
    expect(conversationMessageTone("outgoing", "assistant")).toBe("ai");
    expect(conversationMessageTone("outgoing", "user")).toBe("human");
    expect(conversationMessageTone("outgoing", "system")).toBe("system");
  });

  it("shows media as a tag, with the caption when there is one", () => {
    expect(conversationMessageBody({ body: "[audio]", mediaKind: "audio", mediaFilename: null })).toBe("[áudio]");
    expect(conversationMessageBody({ body: "segue a proposta", mediaKind: "document", mediaFilename: "proposta.pdf" })).toBe("[documento: proposta.pdf] segue a proposta");
    expect(conversationMessageBody({ body: " Oi ", mediaKind: null, mediaFilename: null })).toBe("Oi");
  });

  it("keeps accents, drops emojis and turns typographic marks into ASCII", () => {
    expect(pdfSafeText("Olá 🤩🥳 tudo “bem”… São Gonçalo – RJ")).toBe("Olá tudo \"bem\"... São Gonçalo - RJ");
    expect(pdfSafeText("linha 1\r\n\r\n\r\nlinha 2")).toBe("linha 1\n\nlinha 2");
  });

  it("wraps long text inside the line width, cutting a word longer than the line", async () => {
    const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
    const lines = wrapPdfText(`${"palavra ".repeat(40)}\n${"x".repeat(300)}`, font, 9, 200);
    expect(lines.length).toBeGreaterThan(4);
    for (const line of lines) expect(font.widthOfTextAtSize(line, 9)).toBeLessThanOrEqual(200);
  });

  it("builds a PDF that spills onto more pages for a long conversation", async () => {
    const input: ConversationExportInput = {
      tenantName: "Âncora Saúde",
      logoUrl: null,
      generatedAt: new Date("2026-10-28T12:00:00Z"),
      generatedBy: "Vinicios Ragazzi",
      leadName: "Amandão do povo 🤩",
      status: "Em contato",
      temperature: { label: "Quente", tone: "hot" },
      leadSubtitle: "Matriz 7º Andar · chegou em 27/10/2026 12:24",
      lead: [{ label: "Telefone / WhatsApp", value: "(21) 97508-1425" }, { label: "Vidas", value: "3" }, { label: "Idades", value: "34, 32 e 5" }],
      broker: { name: "Lilian Martins", subtitle: "Corretor · recebeu em 27/10/2026 12:30", rows: [{ label: "Telefone", value: "(21) 99999-0000" }] },
      messages: Array.from({ length: 120 }, (_, index) => ({
        sentAt: new Date(Date.UTC(2026, 9, 27, 15, index)),
        sender: index % 2 ? "IA Assistente" : "Cliente",
        channel: "WhatsApp oficial",
        tone: index % 3 === 0 ? "client" as const : index % 3 === 1 ? "ai" as const : "human" as const,
        body: `Mensagem ${index + 1} ${"com bastante texto ".repeat(index % 7)}`,
      })),
      truncatedFrom: null,
    };
    const bytes = await encodeConversationExportPdf(input);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
  });

  it("builds a PDF for a lead with no broker and no messages", async () => {
    const bytes = await encodeConversationExportPdf({
      tenantName: "Âncora", logoUrl: null, generatedAt: new Date(), generatedBy: "Diretor", leadName: "Lead WhatsApp (1425)",
      status: null, temperature: null, leadSubtitle: null,
      lead: [], broker: null, messages: [], truncatedFrom: null,
    });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});
