import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";

import { embedTenantLogo } from "@/features/lead-distribution/report-pdf-kit";

export type ConversationExportRow = { label: string; value: string };

/** Who wrote it: the client on the left, the company (AI, broker, system) on the right. */
export type ConversationMessageTone = "client" | "ai" | "human" | "system";

export type ConversationExportMessage = {
  sentAt: Date;
  sender: string;
  channel: string | null;
  tone: ConversationMessageTone;
  body: string;
};

export type ConversationTemperature = "hot" | "warm" | "cold";

export type ConversationExportInput = {
  tenantName: string;
  logoUrl: string | null;
  generatedAt: Date;
  generatedBy: string;
  leadName: string;
  status: string | null;
  temperature: { label: string; tone: ConversationTemperature | null } | null;
  /** Unit and arrival, under the lead card's title. */
  leadSubtitle: string | null;
  lead: ConversationExportRow[];
  broker: { name: string; subtitle: string | null; rows: ConversationExportRow[] } | null;
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

export function conversationMessageTone(direction: string, senderRole: string | null | undefined): ConversationMessageTone {
  const outbound = direction === "outgoing" || direction === "outbound";
  if (!outbound) return "client";
  if (senderRole === "assistant" || direction === "outbound") return "ai";
  if (senderRole === "system") return "system";
  return "human";
}

export function conversationChannelLabel(provider: string | null | undefined) {
  if (!provider) return null;
  if (provider.includes("meta")) return "WhatsApp oficial";
  if (provider.includes("waha")) return "WhatsApp (WAHA)";
  return null;
}

export { conversationMessageBody } from "./message-media-text";

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

// Lite "Conversa" tokens (docs/design-system/lite/LITE_CHAT_DESIGN_SYSTEM.md), translucent ones over white.
const hex = (value: string) => rgb(parseInt(value.slice(1, 3), 16) / 255, parseInt(value.slice(3, 5), 16) / 255, parseInt(value.slice(5, 7), 16) / 255);
const lite = {
  background: hex("#f7f7f9"),
  surface: hex("#ffffff"),
  surfaceMuted: hex("#f1f1f5"),
  foreground: hex("#0b0b12"),
  secondary: hex("#4b4b59"),
  muted: hex("#666674"),
  border: hex("#ececef"), // rgb(16 16 40 / .08)
  borderSubtle: hex("#f3f3f5"), // rgb(16 16 40 / .05)
  actionSoft: hex("#e8f1fe"), // --chat-action-soft, oklch(62% .2 255 / .1)
  whatsappSoft: hex("#e5f5eb"), // WhatsApp oklch(64% .17 150 / .12): the broker's bubble
  hot: hex("#e8553d"), // oklch(64% .2 30)
  warm: hex("#e0a32e"), // oklch(75% .16 75)
  cold: hex("#4d9be0"), // oklch(68% .12 235)
} as const;

const BUBBLE_FILL: Record<ConversationMessageTone, RGB> = { client: lite.surfaceMuted, ai: lite.actionSoft, human: lite.whatsappSoft, system: lite.surface };

/** A4 portrait, in points; 1px of the screen tokens is drawn as .75pt. */
const PAGE = { width: 595.28, height: 841.89, margin: 36 } as const;
const PX = 0.75;

/** Rounded rectangle from its top-left corner, each corner with its own radius (SVG path, y grows down). */
function roundedRect(page: PDFPage, x: number, top: number, width: number, height: number, radius: [number, number, number, number], fill: RGB, border?: RGB) {
  const [tl, tr, br, bl] = radius.map((value) => Math.min(value, width / 2, height / 2));
  const path = `M ${tl} 0 H ${width - tr} Q ${width} 0 ${width} ${tr} V ${height - br} Q ${width} ${height} ${width - br} ${height} H ${bl} Q 0 ${height} 0 ${height - bl} V ${tl} Q 0 0 ${tl} 0 Z`;
  page.drawSvgPath(path, { x, y: top, color: fill, ...(border ? { borderColor: border, borderWidth: 0.75 } : {}) });
}

function dayLabel(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" }).format(value);
}

function timeLabel(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(value);
}

function shortDateTime(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(value);
}

function dayKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(value);
}

export async function encodeConversationExportPdf(input: ConversationExportInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfSafeText(`Conversa - ${input.leadName}`));
  pdf.setAuthor(pdfSafeText(input.tenantName));
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  // The Lite scale stops at weight 500; the standard fonts only have regular and bold.
  const strong = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo: PDFImage | null = await embedTenantLogo(pdf, input.logoUrl);
  const { width, height, margin } = PAGE;
  const contentWidth = width - margin * 2;
  const bottom = margin + 14;

  let page!: PDFPage;
  let y = 0;
  const newPage = () => {
    page = pdf.addPage([width, height]);
    page.drawRectangle({ x: 0, y: 0, width, height, color: lite.background });
    y = height - margin;
  };
  const write = (value: string, x: number, size: number, font: PDFFont, color: RGB) => {
    page.drawText(pdfSafeText(value), { x, y, size, font, color });
  };
  const widthOf = (value: string, size: number, font: PDFFont) => font.widthOfTextAtSize(pdfSafeText(value), size);
  newPage();

  // ── Header: logo, title, who exported, and the conversation at a glance.
  let titleX = margin;
  if (logo) {
    const scale = Math.min(28 / logo.height, 90 / logo.width);
    page.drawImage(logo, { x: margin, y: y - logo.height * scale, width: logo.width * scale, height: logo.height * scale });
    titleX = margin + logo.width * scale + 12;
  }
  y -= 14;
  write(`Conversa com ${input.leadName}`, titleX, 16, strong, lite.foreground);
  y -= 15;
  write(`Exportada em ${shortDateTime(input.generatedAt)} por ${input.generatedBy} · ${input.tenantName}`, titleX, 8, regular, lite.muted);
  y -= 20;

  const first = input.messages[0];
  const last = input.messages[input.messages.length - 1];
  const pills: Array<{ text: string; dot?: RGB }> = [
    ...(input.status ? [{ text: input.status }] : []),
    ...(input.temperature ? [{ text: input.temperature.label, dot: input.temperature.tone ? lite[input.temperature.tone] : undefined }] : []),
    { text: `${input.messages.length} ${input.messages.length === 1 ? "mensagem" : "mensagens"}` },
    ...(first && last ? [{ text: `${shortDateTime(first.sentAt)} a ${shortDateTime(last.sentAt)}` }] : []),
  ];
  let pillX = margin;
  const pillHeight = 18;
  for (const pill of pills) {
    const textWidth = widthOf(pill.text, 8, regular);
    const pillWidth = textWidth + 20 + (pill.dot ? 10 : 0);
    roundedRect(page, pillX, y + 4, pillWidth, pillHeight, [9, 9, 9, 9], lite.surface, lite.border);
    let textX = pillX + 10;
    if (pill.dot) {
      page.drawCircle({ x: textX + 3, y: y - 5, size: 3, color: pill.dot });
      textX += 10;
    }
    page.drawText(pdfSafeText(pill.text), { x: textX, y: y - 8, size: 8, font: regular, color: lite.foreground });
    pillX += pillWidth + 6;
  }
  y -= pillHeight + 14;

  // ── Lead and broker cards ("facts": title, subtitle, label/value grid).
  const cardGap = 12;
  const cardWidth = (contentWidth - cardGap) / 2;
  const pad = 14;
  const labelWidth = 82;
  const valueWidth = cardWidth - pad * 2 - labelWidth - 8;
  type Card = { title: string; subtitle: string | null; rows: Array<{ label: string; lines: string[] }> };
  const toCard = (title: string, subtitle: string | null, rows: ConversationExportRow[]): Card => ({
    title, subtitle, rows: rows.map((row) => ({ label: row.label, lines: wrapPdfText(row.value, regular, 8.5, valueWidth) })),
  });
  const cards = [
    toCard("Lead", input.leadSubtitle, input.lead),
    input.broker ? toCard(input.broker.name, input.broker.subtitle ?? "Corretor", input.broker.rows) : toCard("Corretor", "Sem corretor atribuído", []),
  ];
  // Room on the first page for the cards; what does not fit stays in the lead's record.
  const maxCardHeight = y - bottom - 90;
  const heights = cards.map((card) => {
    let total = pad + 13 + (card.subtitle ? 12 : 0) + 8;
    const kept: Card["rows"] = [];
    for (const row of card.rows) {
      const rowHeight = Math.max(row.lines.length, 1) * 11 + 5;
      if (total + rowHeight + pad + 14 > maxCardHeight) {
        kept.push({ label: "", lines: ["Demais informações na ficha do lead."] });
        total += 16;
        break;
      }
      kept.push(row);
      total += rowHeight;
    }
    card.rows = kept;
    return total + pad - 5;
  });
  const cardHeight = Math.max(...heights);
  cards.forEach((card, index) => {
    const x = margin + index * (cardWidth + cardGap);
    roundedRect(page, x, y, cardWidth, cardHeight, [18, 18, 18, 18], lite.surface, lite.border);
    let cardY = y - pad - 9;
    page.drawText(pdfSafeText(card.title), { x: x + pad, y: cardY, size: 10.5, font: strong, color: lite.foreground });
    cardY -= 13;
    if (card.subtitle) {
      page.drawText(pdfSafeText(card.subtitle), { x: x + pad, y: cardY, size: 8, font: regular, color: lite.muted });
      cardY -= 12;
    }
    cardY -= 6;
    page.drawLine({ start: { x: x + pad, y: cardY + 6 }, end: { x: x + cardWidth - pad, y: cardY + 6 }, thickness: 0.75, color: lite.borderSubtle });
    cardY -= 6;
    for (const row of card.rows) {
      if (row.label) page.drawText(pdfSafeText(row.label), { x: x + pad, y: cardY, size: 7.5, font: regular, color: lite.muted });
      row.lines.forEach((line, lineIndex) => {
        page.drawText(line, { x: x + pad + (row.label ? labelWidth + 8 : 0), y: cardY - lineIndex * 11, size: 8.5, font: regular, color: row.label ? lite.foreground : lite.muted });
      });
      cardY -= Math.max(row.lines.length, 1) * 11 + 5;
    }
  });
  y -= cardHeight + 22;

  // ── The conversation in two columns: client on the left, company on the right.
  const columnGap = 28;
  const columnWidth = (contentWidth - columnGap) / 2;
  const rightX = margin + columnWidth + columnGap;
  const bubbleMax = columnWidth;
  const bubblePadX = 9;
  const bubblePadY = 6;
  const bodySize = 9;
  const lineHeight = 12.5;
  const centerX = margin + columnWidth + columnGap / 2;
  const columnHeader = () => {
    write("Cliente", margin, 9, strong, lite.foreground);
    const right = "Corretor e IA";
    write(right, width - margin - widthOf(right, 9, strong), 9, strong, lite.foreground);
    y -= 7;
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.75, color: lite.border });
    // The line between the two sides runs down the whole page; dates and system notes sit over it.
    page.drawLine({ start: { x: centerX, y }, end: { x: centerX, y: bottom }, thickness: 0.75, color: lite.border });
    y -= 16;
  };
  if (y - 60 < bottom) newPage();
  columnHeader();
  if (input.truncatedFrom) {
    const note = `A conversa tem ${input.truncatedFrom} mensagens; este arquivo traz as ${input.messages.length} mais recentes.`;
    write(note, (width - widthOf(note, 8, regular)) / 2, 8, regular, lite.muted);
    y -= 18;
  }
  if (!input.messages.length) {
    const empty = "Nenhuma mensagem registrada para este lead.";
    write(empty, (width - widthOf(empty, 9, regular)) / 2, 9, regular, lite.muted);
  }

  let currentDay = "";
  for (const message of input.messages) {
    const ensure = (space: number) => {
      if (y - space >= bottom) return;
      newPage();
      columnHeader();
    };
    const day = dayKey(message.sentAt);
    if (day !== currentDay) {
      currentDay = day;
      ensure(48);
      const label = dayLabel(message.sentAt);
      const dayWidth = widthOf(label, 8, regular) + 20;
      roundedRect(page, (width - dayWidth) / 2, y + 11, dayWidth, 16, [8, 8, 8, 8], lite.surfaceMuted);
      write(label, (width - widthOf(label, 8, regular)) / 2, 8, regular, lite.secondary);
      y -= 26;
    }

    // A system note (Lite "system" block): centered, secondary text, no balloon.
    if (message.tone === "system") {
      const noteLines = wrapPdfText(message.body, regular, 8.5, contentWidth * 0.6);
      const meta = `${message.sender} · ${timeLabel(message.sentAt)}`;
      const blockWidth = Math.max(widthOf(meta, 7.5, regular), ...noteLines.map((line) => regular.widthOfTextAtSize(line, 8.5))) + 16;
      ensure(12 + noteLines.length * 11 + 14);
      page.drawRectangle({ x: (width - blockWidth) / 2, y: y - 4 - noteLines.length * 11, width: blockWidth, height: 14 + noteLines.length * 11, color: lite.background });
      write(meta, (width - widthOf(meta, 7.5, regular)) / 2, 7.5, regular, lite.muted);
      y -= 11;
      for (const line of noteLines) {
        page.drawText(line, { x: (width - regular.widthOfTextAtSize(line, 8.5)) / 2, y, size: 8.5, font: regular, color: lite.secondary });
        y -= 11;
      }
      y -= 14;
      continue;
    }

    const right = message.tone !== "client";
    const meta = `${message.sender} · ${timeLabel(message.sentAt)}${message.channel ? ` · ${message.channel}` : ""}`;
    const lines = wrapPdfText(message.body || "(mensagem vazia)", regular, bodySize, bubbleMax - bubblePadX * 2);
    const textWidth = Math.max(...lines.map((line) => regular.widthOfTextAtSize(line, bodySize)), 24);
    const bubbleWidth = Math.min(bubbleMax, textWidth + bubblePadX * 2);
    const columnX = right ? rightX : margin;
    const bubbleX = right ? columnX + columnWidth - bubbleWidth : columnX;
    // The speaker's top corner is the tight one (16px balloon, 6px corner).
    const radius: [number, number, number, number] = right ? [16 * PX, 6 * PX, 16 * PX, 16 * PX] : [6 * PX, 16 * PX, 16 * PX, 16 * PX];

    // A long message continues on the next page in another balloon.
    let remaining = lines;
    let firstChunk = true;
    while (remaining.length) {
      ensure(firstChunk ? 12 + bubblePadY * 2 + lineHeight : bubblePadY * 2 + lineHeight);
      if (firstChunk) {
        const metaWidth = widthOf(meta, 7.5, regular);
        write(meta, right ? columnX + columnWidth - metaWidth : columnX, 7.5, regular, lite.muted);
        y -= 10;
      }
      const fit = Math.max(1, Math.floor((y - bottom - bubblePadY * 2) / lineHeight));
      const chunk = remaining.slice(0, fit);
      remaining = remaining.slice(fit);
      const bubbleHeight = chunk.length * lineHeight + bubblePadY * 2 - 3;
      roundedRect(page, bubbleX, y, bubbleWidth, bubbleHeight, radius, BUBBLE_FILL[message.tone]);
      let textY = y - bubblePadY - bodySize + 1;
      for (const line of chunk) {
        page.drawText(line, { x: bubbleX + bubblePadX, y: textY, size: bodySize, font: regular, color: lite.foreground });
        textY -= lineHeight;
      }
      // Between messages more room than between a label and its own balloon.
      y -= bubbleHeight + (remaining.length ? 0 : 16);
      firstChunk = false;
    }
  }

  // On the last page the line between the sides stops with the conversation.
  if (y > bottom) page.drawRectangle({ x: centerX - 1, y: bottom - 1, width: 2, height: y - bottom + 7, color: lite.background });

  // Footer on every page.
  const pages = pdf.getPages();
  pages.forEach((item, index) => {
    const left = pdfSafeText(`${input.tenantName} · Conversa com ${input.leadName}`);
    item.drawText(left, { x: margin, y: 18, size: 7, font: regular, color: lite.muted });
    const label = `Página ${index + 1} de ${pages.length}`;
    item.drawText(label, { x: width - margin - regular.widthOfTextAtSize(label, 7), y: 18, size: 7, font: regular, color: lite.muted });
  });
  return pdf.save();
}
