import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";

export type UnassignedLeadPdfRow = {
  name: string;
  contact: string;
  lives: string;
  city: string;
  enteredAt: Date;
};

const colors = {
  ink: rgb(0.06, 0.09, 0.16),
  muted: rgb(0.36, 0.41, 0.49),
  border: rgb(0.86, 0.88, 0.91),
  header: rgb(0.08, 0.16, 0.28),
  headerText: rgb(1, 1, 1),
  stripe: rgb(0.97, 0.98, 0.99),
  accent: rgb(0.06, 0.58, 0.4),
};

function printable(value: unknown, max = 80) {
  return String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?")
    .slice(0, max);
}

function drawCell(
  page: PDFPage,
  value: string,
  x: number,
  y: number,
  width: number,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  size = 8,
  color = colors.ink,
) {
  let text = printable(value, 100);
  while (text.length > 1 && font.widthOfTextAtSize(text, size) > width - 14) {
    text = `${text.slice(0, -2)}…`;
  }
  page.drawText(text, { x: x + 7, y: y + 8, size, font, color });
}

function dateLabel(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(value);
}

export async function encodeUnassignedLeadsPdf(input: {
  rows: UnassignedLeadPdfRow[];
  generatedAt?: Date;
}) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const margin = 32;
  const columns = [
    { label: "Nome", width: 190 },
    { label: "Contato", width: 185 },
    { label: "Vidas", width: 70 },
    { label: "Cidade", width: 170 },
    { label: "Entrada", width: 162 },
  ] as const;
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const rowHeight = 25;
  const headerHeight = 28;
  const footerHeight = 24;

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

  const addPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
    page.drawText("Leads sem distribuição", { x: margin, y, size: 20, font: bold, color: colors.ink });
    page.drawText(
      `Exportado em ${dateLabel(input.generatedAt ?? new Date())} · ${input.rows.length} registro${input.rows.length === 1 ? "" : "s"}`,
      { x: margin, y: y - 19, size: 9, font: regular, color: colors.muted },
    );
    page.drawText("Somente leads operacionais sem corretor e não arquivados.", {
      x: margin,
      y: y - 34,
      size: 8,
      font: regular,
      color: colors.accent,
    });
    y -= 52;
    drawTableHeader();
  };

  addPage();
  for (const [index, row] of input.rows.entries()) {
    if (y - rowHeight < margin + footerHeight) addPage();
    const rowY = y - rowHeight;
    if (index % 2 === 1) {
      page.drawRectangle({ x: margin, y: rowY, width: tableWidth, height: rowHeight, color: colors.stripe });
    }
    page.drawRectangle({ x: margin, y: rowY, width: tableWidth, height: rowHeight, borderColor: colors.border, borderWidth: 0.45 });
    const values = [row.name, row.contact, row.lives, row.city, dateLabel(row.enteredAt)];
    let x = margin;
    values.forEach((value, columnIndex) => {
      drawCell(page, value, x, rowY, columns[columnIndex].width, regular);
      x += columns[columnIndex].width;
    });
    y = rowY;
  }

  if (!input.rows.length) {
    const emptyY = y - rowHeight;
    page.drawRectangle({ x: margin, y: emptyY, width: tableWidth, height: rowHeight, borderColor: colors.border, borderWidth: 0.45 });
    drawCell(page, "Nenhum lead sem distribuição encontrado.", margin, emptyY, tableWidth, regular, 8, colors.muted);
  }

  for (const pageItem of pdf.getPages()) {
    pageItem.drawText("AncoraHub · Distribuição", { x: margin, y: 17, size: 7, font: regular, color: colors.muted });
    pageItem.drawText(`Página ${pdf.getPages().indexOf(pageItem) + 1} de ${pdf.getPageCount()}`, {
      x: pageWidth - margin - 80,
      y: 17,
      size: 7,
      font: regular,
      color: colors.muted,
    });
  }

  return new Uint8Array(await pdf.save());
}
