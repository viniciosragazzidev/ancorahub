import { rgb, type PDFDocument, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

/** A4 landscape, in points. */
export const REPORT_PAGE = { width: 841.89, height: 595.28, margin: 32 } as const;

// Palette from docs/design-system.md — accent/header reuse the tenant-report
// styling already established in unassigned-leads-pdf.ts; the badge mirrors
// the "info" Status Badge variant (Powder Blue / Electric Blue).
export const reportColors = {
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
  warning: rgb(0x92 / 255, 0x40 / 255, 0x0e / 255),
};

/** Standard 14 fonts only encode WinAnsi; anything else becomes "?". */
export function printable(value: unknown, max = 100) {
  return String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?")
    .slice(0, max);
}

export function drawCell(page: PDFPage, value: string, x: number, y: number, width: number, font: PDFFont, size = 8, color = reportColors.ink) {
  let text = printable(value, 120);
  while (text.length > 1 && font.widthOfTextAtSize(text, size) > width - 14) {
    text = `${text.slice(0, -2)}…`;
  }
  page.drawText(text, { x: x + 7, y: y + 8, size, font, color });
}

export function dateTimeLabel(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(value);
}

/** Pill-shaped badge (design system: 9999px radius, Powder Blue / Electric Blue "info" tone). */
export function drawBadge(page: PDFPage, text: string, x: number, y: number, maxWidth: number, font: PDFFont, size = 7.5) {
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
    page.drawEllipse({ x: x + badgeWidth / 2, y: centerY, xScale: badgeWidth / 2, yScale: radius, color: reportColors.badgeBg });
  } else {
    page.drawEllipse({ x: x + radius, y: centerY, xScale: radius, yScale: radius, color: reportColors.badgeBg });
    page.drawEllipse({ x: x + badgeWidth - radius, y: centerY, xScale: radius, yScale: radius, color: reportColors.badgeBg });
    page.drawRectangle({ x: x + radius, y: badgeY, width: badgeWidth - radius * 2, height: badgeHeight, color: reportColors.badgeBg });
  }
  page.drawText(label, { x: x + (badgeWidth - textWidth) / 2, y: badgeY + (badgeHeight - size) / 2 + 1, size, font, color: reportColors.badgeText });
}

/**
 * Best-effort logo fetch — a missing/unreachable/unsupported logo must never block the export.
 * Tenant logos are uploaded as PNG, JPEG, WebP or SVG (see LogoUpload); pdf-lib only embeds
 * PNG/JPEG, so every logo is normalized to PNG through sharp before embedding.
 */
export async function embedTenantLogo(pdf: PDFDocument, logoUrl: string | null | undefined): Promise<PDFImage | null> {
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

/** Draws the logo (when present) and returns the x where the title block starts. */
export function drawReportLogo(page: PDFPage, logo: PDFImage | null, top: number, boxHeight = 34) {
  if (!logo) return REPORT_PAGE.margin;
  const scale = Math.min(boxHeight / logo.height, 100 / logo.width);
  const logoWidth = logo.width * scale;
  const logoHeight = logo.height * scale;
  page.drawImage(logo, { x: REPORT_PAGE.margin, y: top - boxHeight + (boxHeight - logoHeight) / 2, width: logoWidth, height: logoHeight });
  return REPORT_PAGE.margin + logoWidth + 16;
}

/** "<tenant> · <area>" on the left and "Página x de y" on the right of every page. */
export function drawReportFooters(pdf: PDFDocument, label: string, font: PDFFont) {
  const pages = pdf.getPages();
  pages.forEach((pageItem, index) => {
    pageItem.drawText(printable(label, 120), { x: REPORT_PAGE.margin, y: 17, size: 7, font, color: reportColors.muted });
    const pageLabel = `Página ${index + 1} de ${pages.length}`;
    pageItem.drawText(pageLabel, { x: REPORT_PAGE.width - REPORT_PAGE.margin - font.widthOfTextAtSize(pageLabel, 7), y: 17, size: 7, font, color: reportColors.muted });
  });
}
