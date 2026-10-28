import { PDFDocument, StandardFonts, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

import { dateTimeLabel, drawReportFooters, drawReportLogo, embedTenantLogo, REPORT_PAGE, reportColors } from "@/features/lead-distribution/report-pdf-kit";

export type ConversationExportRow = { label: string; value: string };

export type ConversationExportMessage = {
  sentAt: Date;
  sender: string;
  channel: string | null;
  /** The lead's own messages sit on the left, the company's indented to the right. */
  side: "in" | "out";
  body: string;
};

export type ConversationExportInput = {
  tenantName: string;
  logoUrl: string | null;
  generatedAt: Date;
  generatedBy: string;
  leadName: string;
  lead: ConversationExportRow[];
  broker: ConversationExportRow[] | null;
  messages: ConversationExportMessage[];
  /** More messages than the export carries: the oldest ones are left out. */
  truncatedFrom: number | null;
};

/** Same reading as the conversation screen. */
export function conversationSenderLabel(direction: string, senderRole: string | null | undefined) {
  const outbound = direction === "outgoing" || direction === "outbound";
  if (!outbound) return "Cliente";
  if (senderRole === "assistant" || direction === "outbound") return "IA Assistente";
  if (senderRole === "supervisor") return "Supervisor";
  if (senderRole === "system") return "Sistema";
  return "Atendente";
}

export function conversationChannelLabel(provider: string | null | undefined) {
  if (!provider) return null;
  if (provider.includes("meta")) return "WhatsApp oficial";
  if (provider.includes("waha")) return "WhatsApp (WAHA)";
  return null;
}

const MEDIA_LABELS: Record<string, string> = { audio: "áudio", image: "imagem", video: "vídeo", document: "documento", sticker: "figurinha" };

/** A media message shows as "[áudio]" or "[documento: proposta.pdf]", with its caption when there is one. */
export function conversationMessageBody(input: { body: string | null; mediaKind: string | null; mediaFilename: string | null }) {
  const body = (input.body ?? "").trim();
  if (!input.mediaKind) return body;
  const label = MEDIA_LABELS[input.mediaKind] ?? input.mediaKind;
  const tag = `[${label}${input.mediaFilename ? `: ${input.mediaFilename}` : ""}]`;
  const caption = /^\[[^\]]*\]$/.test(body) ? "" : body;
  return caption ? `${tag} ${caption}` : tag;
}

const ASCII_FALLBACK: Record<string, string> = { "“": "\"", "”": "\"", "‘": "'", "’": "'", "–": "-", "—": "-", "…": "...", "•": "-" };

/**
 * The standard PDF fonts only encode Latin-1: accents stay, typographic quotes and dashes become
 * their ASCII form and emojis are dropped (a WhatsApp conversation is full of them; "?" would not help).
 */
export function pdfSafeText(value: string) {
  return [...value.replace(/\r\n?/g, "\n")]
    .map((char) => ASCII_FALLBACK[char] ?? char)
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return char === "\n" || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff);
    })
    .join("")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Breaks the text into lines that fit `width`; a word longer than the line is cut. */
export function wrapPdfText(value: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const paragraph of pdfSafeText(value).split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ").filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > width) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut -= 1;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

const BODY_SIZE = 9;
const LINE = 12;
const OUT_INDENT = 96;

export async function encodeConversationExportPdf(input: ConversationExportInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfSafeText(`Conversa - ${input.leadName}`));
  pdf.setAuthor(pdfSafeText(input.tenantName));
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo: PDFImage | null = await embedTenantLogo(pdf, input.logoUrl);
  const { width, height, margin } = REPORT_PAGE;
  const contentWidth = width - margin * 2;
  const bottom = margin + 18;

  let page: PDFPage = pdf.addPage([width, height]);
  let y = height - margin;
  const newPage = () => {
    page = pdf.addPage([width, height]);
    y = height - margin;
  };
  const ensure = (space: number) => {
    if (y - space < bottom) newPage();
  };
  const text = (value: string, x: number, size: number, textFont: PDFFont, color = reportColors.ink) => {
    page.drawText(pdfSafeText(value), { x, y, size, font: textFont, color });
  };

  // Header: logo, title, the lead, and who generated it.
  const titleX = drawReportLogo(page, logo, y);
  y -= 14;
  text("Histórico da conversa", titleX, 15, bold);
  y -= 16;
  text(input.leadName, titleX, 11, font);
  y -= 13;
  text(`Gerado em ${dateTimeLabel(input.generatedAt)} por ${input.generatedBy} · ${input.tenantName}`, titleX, 8, font, reportColors.muted);
  y -= 14;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: reportColors.border });
  y -= 20;

  // Lead and broker side by side.
  const columnWidth = (contentWidth - 24) / 2;
  const drawBlock = (title: string, rows: ConversationExportRow[], x: number, startY: number) => {
    let blockY = startY;
    page.drawText(title, { x, y: blockY, size: 10, font: bold, color: reportColors.ink });
    blockY -= 16;
    for (const row of rows) {
      const label = `${pdfSafeText(row.label)}: `;
      const labelWidth = Math.min(bold.widthOfTextAtSize(label, 8), columnWidth * 0.45);
      const lines = wrapPdfText(row.value, font, 8.5, columnWidth - labelWidth);
      // Side by side on the first page: what does not fit stays in the lead's record.
      if (blockY - Math.max(lines.length, 1) * 11 < bottom + 24) {
        page.drawText("Demais informações na ficha do lead.", { x, y: blockY, size: 8, font, color: reportColors.muted });
        blockY -= 14;
        break;
      }
      page.drawText(label, { x, y: blockY, size: 8, font: bold, color: reportColors.muted });
      lines.forEach((line, index) => {
        page.drawText(line, { x: x + labelWidth, y: blockY - index * 11, size: 8.5, font, color: reportColors.ink });
      });
      blockY -= Math.max(lines.length, 1) * 11 + 3;
    }
    return blockY;
  };
  const leadEnd = drawBlock("Lead", input.lead, margin, y);
  const brokerEnd = drawBlock("Corretor", input.broker ?? [{ label: "Corretor", value: "Sem corretor atribuído" }], margin + columnWidth + 24, y);
  y = Math.min(leadEnd, brokerEnd) - 8;
  if (y < bottom + 60) newPage();
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: reportColors.border });
  y -= 20;

  // Messages, oldest first.
  text(`Mensagens (${input.messages.length})`, margin, 10, bold);
  y -= 14;
  if (input.truncatedFrom) {
    text(`A conversa tem ${input.truncatedFrom} mensagens; este arquivo traz as ${input.messages.length} mais recentes.`, margin, 8, font, reportColors.muted);
    y -= 14;
  }
  if (!input.messages.length) {
    text("Nenhuma mensagem registrada para este lead.", margin, BODY_SIZE, font, reportColors.muted);
  }
  for (const message of input.messages) {
    const x = message.side === "out" ? margin + OUT_INDENT : margin;
    const lineWidth = contentWidth - OUT_INDENT;
    const lines = wrapPdfText(message.body || "(mensagem vazia)", font, BODY_SIZE, lineWidth);
    ensure(LINE + LINE * Math.min(lines.length, 3));
    const meta = `${dateTimeLabel(message.sentAt)} · `;
    page.drawText(pdfSafeText(meta), { x, y, size: 7.5, font, color: reportColors.muted });
    const metaWidth = font.widthOfTextAtSize(pdfSafeText(meta), 7.5);
    page.drawText(pdfSafeText(message.sender), { x: x + metaWidth, y, size: 7.5, font: bold, color: reportColors.ink });
    if (message.channel) {
      const senderWidth = bold.widthOfTextAtSize(pdfSafeText(message.sender), 7.5);
      page.drawText(pdfSafeText(` · ${message.channel}`), { x: x + metaWidth + senderWidth, y, size: 7.5, font, color: reportColors.muted });
    }
    y -= LINE;
    for (const line of lines) {
      ensure(LINE);
      page.drawText(line, { x, y, size: BODY_SIZE, font, color: reportColors.ink });
      y -= LINE;
    }
    y -= 6;
  }

  drawReportFooters(pdf, `${input.tenantName} · Conversa exportada`, font);
  return pdf.save();
}
