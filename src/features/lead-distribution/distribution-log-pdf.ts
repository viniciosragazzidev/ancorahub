import { PDFDocument, StandardFonts, type PDFPage } from "pdf-lib";
import type { DistributionLogRow } from "./broker-summary-service";
import { REPORT_PAGE, dateTimeLabel, drawBadge, drawCell, drawReportFooters, drawReportLogo, embedTenantLogo, printable, reportColors as colors } from "./report-pdf-kit";

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

  const { width: pageWidth, height: pageHeight, margin } = REPORT_PAGE;
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

    const titleX = drawReportLogo(page, logo, y, logoBoxHeight);
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

  drawReportFooters(pdf, `${input.tenantName} · Distribuição`, regular);

  return new Uint8Array(await pdf.save());
}
