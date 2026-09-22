import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type { DistributionLogRow } from "./broker-summary-service";

// Palette from docs/design-system.md — accent/header reuse the tenant-report
// styling already established in unassigned-leads-pdf.ts; the badge below
// mirrors the "info" Status Badge variant (Powder Blue / Electric Blue).
const colors = {
  ink: rgb(0.06, 0.09, 0.16),
  muted: rgb(0.36, 0.41, 0.49),
  border: rgb(0.86, 0.88, 0.91),
  header: rgb(0.08, 0.16, 0.28),
  headerText: rgb(1, 1, 1),
  stripe: rgb(0.97, 0.98, 0.99),
  accent: rgb(0.06, 0.58, 0.4),
  sectionBg: rgb(0.93, 0.96, 0.95),
  badgeBg: rgb(0xdb / 255, 0xea / 255, 0xff / 255),
  badgeText: rgb(0x25 / 255, 0x63 / 255, 0xeb / 255),
};

function printable(value: unknown, max = 100) {
  return String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?")
    .slice(0, max);
}

function drawCell(page: PDFPage, value: string, x: number, y: number, width: number, font: PDFFont, size = 8, color = colors.ink) {
  let text = printable(value, 120);
  while (text.length > 1 && font.widthOfTextAtSize(text, size) > width - 14) {
    text = `${text.slice(0, -2)}…`;
  }
  page.drawText(text, { x: x + 7, y: y + 8, size, font, color });
}

function dateTimeLabel(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(value);
}

/** Pill-shaped "fila/plantão" badge (design system: 9999px radius, Powder Blue / Electric Blue "info" tone). */
function drawBadge(page: PDFPage, text: string, x: number, y: number, maxWidth: number, font: PDFFont, size = 7.5) {
  const paddingX = 6;
  const badgeHeight = size + 6;
  let label = printable(text, 40);
  while (label.length > 1 && font.widthOfTextAtSize(label, size) + paddingX * 2 > maxWidth) {
    label = `${label.slice(0, -2)}…`;
  }
  const textWidth = font.widthOfTextAtSize(label, size);
  const badgeWidth = Math.min(maxWidth, textWidth + paddingX * 2);
  const radius = badgeHeight / 2;
  const badgeY = y + (22 - badgeHeight) / 2;
  const centerY = badgeY + radius;

  if (badgeWidth <= badgeHeight) {
    page.drawEllipse({ x: x + badgeWidth / 2, y: centerY, xScale: badgeWidth / 2, yScale: radius, color: colors.badgeBg });
  } else {
    page.drawEllipse({ x: x + radius, y: centerY, xScale: radius, yScale: radius, color: colors.badgeBg });
    page.drawEllipse({ x: x + badgeWidth - radius, y: centerY, xScale: radius, yScale: radius, color: colors.badgeBg });
    page.drawRectangle({ x: x + radius, y: badgeY, width: badgeWidth - radius * 2, height: badgeHeight, color: colors.badgeBg });
  }
  page.drawText(label, { x: x + (badgeWidth - textWidth) / 2, y: badgeY + (badgeHeight - size) / 2 + 1, size, font, color: colors.badgeText });
}

/**
 * Best-effort logo fetch — a missing/unreachable/unsupported logo must never block the export.
 * Tenant logos are uploaded as PNG, JPEG, WebP or SVG (see LogoUpload); pdf-lib only embeds
 * PNG/JPEG, so every logo is normalized to PNG through sharp before embedding.
 */
async function embedTenantLogo(pdf: PDFDocument, logoUrl: string | null | undefined): Promise<PDFImage | null> {
  if (!logoUrl) return null;
  try {
    const response = await fetch(logoUrl);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const sharp = (await import("sharp")).default;
    const pngBytes = await sharp(bytes).png().toBuffer();
    return await pdf.embedPng(pngBytes);
  } catch {
    return null;
  }
}

export async function encodeDistributionLogPdf(input: {
  rows: DistributionLogRow[];
  startDate: Date;
  endDate: Date;
  branchLabel: string;
  tenantName: string;
  tenantLogoUrl?: string | null;
  generatedAt?: Date;
}) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await embedTenantLogo(pdf, input.tenantLogoUrl);

  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const margin = 32;
  const columns = [
    { label: "Código", width: 55 },
    { label: "Corretor", width: 155 },
    { label: "Fila / Plantão", width: 130 },
    { label: "Lead", width: 175 },
    { label: "Telefone", width: 135 },
    { label: "Distribuído em", width: 127 },
  ] as const;
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const rowHeight = 22;
  const headerHeight = 24;
  const sectionHeight = 22;
  const footerHeight = 24;
  const logoBoxHeight = 34;

  const sameDay = input.startDate.toDateString() === input.endDate.toDateString();
  const periodLabel = sameDay
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(input.startDate)
    : `${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(input.startDate)} a ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(input.endDate)}`;

  let page!: PDFPage;
  let y = 0;

  const drawTableHeader = () => {
    const headerY = y - headerHeight;
    page.drawRectangle({ x: margin, y: headerY, width: tableWidth, height: headerHeight, color: colors.header });
    let x = margin;
    for (const column of columns) {
      drawCell(page, column.label, x, headerY, column.width, bold, 8, colors.headerText);
      x += column.width;
    }
    y = headerY;
  };

  const drawSection = (fonteLabel: string, count: number) => {
    const sectionY = y - sectionHeight;
    page.drawRectangle({ x: margin, y: sectionY, width: tableWidth, height: sectionHeight, color: colors.sectionBg, borderColor: colors.border, borderWidth: 0.45 });
    page.drawText(printable(fonteLabel, 90), { x: margin + 8, y: sectionY + 7, size: 9, font: bold, color: colors.header });
    const countLabel = `${count} lead${count === 1 ? "" : "s"}`;
    page.drawText(countLabel, { x: margin + tableWidth - 8 - bold.widthOfTextAtSize(countLabel, 8), y: sectionY + 7, size: 8, font: regular, color: colors.muted });
    y = sectionY;
    drawTableHeader();
  };

  const addPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;

    let titleX = margin;
    if (logo) {
      const scale = Math.min(logoBoxHeight / logo.height, 100 / logo.width);
      const logoWidth = logo.width * scale;
      const logoHeight = logo.height * scale;
      page.drawImage(logo, { x: margin, y: y - logoBoxHeight + (logoBoxHeight - logoHeight) / 2, width: logoWidth, height: logoHeight });
      titleX = margin + logoWidth + 16;
    }
    page.drawText(input.tenantName, { x: titleX, y: y - 12, size: 11, font: bold, color: colors.ink });
    page.drawText("Leads distribuídos", { x: titleX, y: y - 27, size: 15, font: bold, color: colors.ink });
    page.drawText(
      `${input.branchLabel} · ${periodLabel} · Exportado em ${dateTimeLabel(input.generatedAt ?? new Date())}`,
      { x: titleX, y: y - 41, size: 8, font: regular, color: colors.muted },
    );

    const totalLabel = `${input.rows.length} lead${input.rows.length === 1 ? "" : "s"} distribuído${input.rows.length === 1 ? "" : "s"}`;
    page.drawText(totalLabel, { x: pageWidth - margin - bold.widthOfTextAtSize(totalLabel, 11), y: y - 12, size: 11, font: bold, color: colors.accent });

    y -= logoBoxHeight + 12;
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.7, color: colors.border });
    y -= 16;
  };

  addPage();

  // "Separe por fonte": group rows by their acquisition source (channel +
  // campaign/reference), in the order they already arrive (the service
  // sorts by fonteLabel then assignedAt).
  const sections: Array<{ fonteLabel: string; rows: DistributionLogRow[] }> = [];
  for (const row of input.rows) {
    const current = sections[sections.length - 1];
    if (current && current.fonteLabel === row.fonteLabel) current.rows.push(row);
    else sections.push({ fonteLabel: row.fonteLabel, rows: [row] });
  }

  for (const section of sections) {
    if (y - sectionHeight - headerHeight < margin + footerHeight) addPage();
    drawSection(section.fonteLabel, section.rows.length);
    section.rows.forEach((row, index) => {
      if (y - rowHeight < margin + footerHeight) {
        addPage();
        drawSection(section.fonteLabel, section.rows.length);
      }
      const rowY = y - rowHeight;
      if (index % 2 === 1) page.drawRectangle({ x: margin, y: rowY, width: tableWidth, height: rowHeight, color: colors.stripe });
      page.drawRectangle({ x: margin, y: rowY, width: tableWidth, height: rowHeight, borderColor: colors.border, borderWidth: 0.4 });
      let x = margin;
      drawCell(page, row.brokerCode, x, rowY, columns[0].width, regular);
      x += columns[0].width;
      drawCell(page, row.brokerName, x, rowY, columns[1].width, regular);
      x += columns[1].width;
      drawBadge(page, row.queueName, x + 7, rowY, columns[2].width - 14, bold);
      x += columns[2].width;
      drawCell(page, row.leadName, x, rowY, columns[3].width, regular);
      x += columns[3].width;
      drawCell(page, row.leadPhone, x, rowY, columns[4].width, regular);
      x += columns[4].width;
      drawCell(page, dateTimeLabel(row.assignedAt), x, rowY, columns[5].width, regular);
      y = rowY;
    });
  }

  if (!input.rows.length) {
    const emptyY = y - rowHeight;
    page.drawRectangle({ x: margin, y: emptyY, width: tableWidth, height: rowHeight, borderColor: colors.border, borderWidth: 0.45 });
    drawCell(page, "Nenhum lead distribuído neste período.", margin, emptyY, tableWidth, regular, 8, colors.muted);
  }

  const pages = pdf.getPages();
  pages.forEach((pageItem, index) => {
    pageItem.drawText(`${input.tenantName} · Distribuição`, { x: margin, y: 17, size: 7, font: regular, color: colors.muted });
    const pageLabel = `Página ${index + 1} de ${pages.length}`;
    pageItem.drawText(pageLabel, { x: pageWidth - margin - regular.widthOfTextAtSize(pageLabel, 7), y: 17, size: 7, font: regular, color: colors.muted });
  });

  return new Uint8Array(await pdf.save());
}
