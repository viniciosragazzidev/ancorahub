import { PDFDocument, StandardFonts, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { REPORT_PAGE, dateTimeLabel, drawBadge, drawCell, drawReportFooters, drawReportLogo, embedTenantLogo, printable, reportColors as colors } from "./report-pdf-kit";

export type DutyScheduleReportBroker = {
  code: string;
  name: string;
  presence: string;
  situation: string;
  /** Situation is a problem (blocked / inactive) and is drawn in the warning tone. */
  situationAlert: boolean;
  leadsInWindow: number;
  activeLeads: number;
  capacity: number | null;
};

export type DutyScheduleReportLead = {
  name: string;
  phone: string;
  queue: string;
  broker: string;
  /** Went through a broker that did not accept in time; drawn in the warning tone. */
  returnedUnaccepted: boolean;
  distribution: string;
  stage: string;
  receivedAt: Date;
  assignedAt: Date | null;
};

export type DutyScheduleReportInput = {
  tenantName: string;
  tenantLogoUrl?: string | null;
  generatedAt?: Date;
  scheduleName: string;
  /** "Matriz 7º Andar · Fila PME · Quarta 08:00–18:00" */
  scheduleDetails: string;
  periodLabel: string;
  summary: Array<{ label: string; value: string }>;
  brokers: DutyScheduleReportBroker[];
  leadGroups: Array<{ label: string; leads: DutyScheduleReportLead[] }>;
  /** Set when the lead list hit the query cap, so the reader knows it is partial. */
  leadsTruncatedAt?: number | null;
};

type Column = { label: string; width: number; badge?: boolean };
type Cell = { text: string; color?: RGB; font?: "bold" };

const ROW_HEIGHT = 22;
const HEADER_HEIGHT = 24;
const SECTION_HEIGHT = 22;
const FOOTER_HEIGHT = 24;
const SUMMARY_HEIGHT = 46;

// Both tables span the full printable width (841.89 - 2 × 32 = 777.89pt).
const BROKER_COLUMNS: Column[] = [
  { label: "Código", width: 60 },
  { label: "Corretor", width: 190 },
  { label: "Presença", width: 110 },
  { label: "Situação", width: 250 },
  { label: "Leads no plantão", width: 85 },
  { label: "Carteira ativa", width: 82.89 },
];
const LEAD_COLUMNS: Column[] = [
  { label: "Lead", width: 125 },
  { label: "Telefone", width: 88 },
  { label: "Fila", width: 80, badge: true },
  { label: "Corretor", width: 110 },
  { label: "Distribuição", width: 98 },
  { label: "Etapa", width: 115 },
  { label: "Recebido em", width: 81 },
  { label: "Distribuído em", width: 80.89 },
];

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function fitText(value: string, font: PDFFont, size: number, maxWidth: number) {
  let text = printable(value, 240);
  while (text.length > 1 && font.widthOfTextAtSize(text, size) > maxWidth) text = `${text.slice(0, -2)}…`;
  return text;
}

export async function encodeDutySchedulePdf(input: DutyScheduleReportInput) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await embedTenantLogo(pdf, input.tenantLogoUrl);
  const { width: pageWidth, height: pageHeight, margin } = REPORT_PAGE;
  const contentWidth = pageWidth - margin * 2;
  const generatedLabel = dateTimeLabel(input.generatedAt ?? new Date());
  const totalLeads = input.leadGroups.reduce((sum, group) => sum + group.leads.length, 0);

  let page!: PDFPage;
  let y = 0;

  const addPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
    const logoBoxHeight = 46;
    const titleX = drawReportLogo(page, logo, y, logoBoxHeight);
    const titleWidth = pageWidth - margin - titleX - 150;
    page.drawText(fitText(input.tenantName, bold, 11, titleWidth), { x: titleX, y: y - 12, size: 11, font: bold, color: colors.ink });
    page.drawText(fitText(`Relatório do plantão · ${input.scheduleName}`, bold, 15, titleWidth), { x: titleX, y: y - 28, size: 15, font: bold, color: colors.ink });
    page.drawText(fitText(input.scheduleDetails, regular, 8, titleWidth), { x: titleX, y: y - 41, size: 8, font: regular, color: colors.muted });
    page.drawText(fitText(`${input.periodLabel} · Exportado em ${generatedLabel}`, regular, 8, titleWidth), { x: titleX, y: y - 52, size: 8, font: regular, color: colors.muted });

    const totalLabel = printable(`${plural(totalLeads, "lead recebido", "leads recebidos")}`);
    page.drawText(totalLabel, { x: pageWidth - margin - bold.widthOfTextAtSize(totalLabel, 11), y: y - 12, size: 11, font: bold, color: colors.accent });

    y -= logoBoxHeight + 14;
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.7, color: colors.border });
    y -= 14;
  };

  const ensureSpace = (height: number) => {
    if (y - height < margin + FOOTER_HEIGHT) {
      addPage();
      return true;
    }
    return false;
  };

  const drawSummary = () => {
    if (!input.summary.length) return;
    const boxWidth = contentWidth / input.summary.length;
    const top = y - SUMMARY_HEIGHT;
    input.summary.forEach((item, index) => {
      const x = margin + index * boxWidth;
      page.drawRectangle({ x, y: top, width: boxWidth, height: SUMMARY_HEIGHT, borderColor: colors.border, borderWidth: 0.45 });
      page.drawText(fitText(item.label, regular, 7.5, boxWidth - 16), { x: x + 8, y: top + SUMMARY_HEIGHT - 15, size: 7.5, font: regular, color: colors.muted });
      page.drawText(fitText(item.value, bold, 15, boxWidth - 16), { x: x + 8, y: top + 9, size: 15, font: bold, color: colors.ink });
    });
    y = top - 18;
  };

  const drawSection = (title: string, countLabel: string, columns: Column[]) => {
    const sectionY = y - SECTION_HEIGHT;
    page.drawRectangle({ x: margin, y: sectionY, width: contentWidth, height: SECTION_HEIGHT, color: colors.sectionBg, borderColor: colors.border, borderWidth: 0.45 });
    page.drawText(fitText(title, bold, 9, contentWidth - 120), { x: margin + 8, y: sectionY + 7, size: 9, font: bold, color: colors.header });
    const count = printable(countLabel);
    page.drawText(count, { x: margin + contentWidth - 8 - regular.widthOfTextAtSize(count, 8), y: sectionY + 7, size: 8, font: regular, color: colors.muted });
    const headerY = sectionY - HEADER_HEIGHT;
    page.drawRectangle({ x: margin, y: headerY, width: contentWidth, height: HEADER_HEIGHT, color: colors.header });
    let x = margin;
    for (const column of columns) {
      drawCell(page, column.label, x, headerY, column.width, bold, 8, colors.headerText);
      x += column.width;
    }
    y = headerY;
  };

  /** A titled table that repeats its section bar and header on every page it spans. */
  const drawTable = (title: string, countLabel: string, columns: Column[], rows: Cell[][], emptyLabel: string) => {
    ensureSpace(SECTION_HEIGHT + HEADER_HEIGHT + ROW_HEIGHT);
    drawSection(title, countLabel, columns);
    if (!rows.length) {
      const emptyY = y - ROW_HEIGHT;
      page.drawRectangle({ x: margin, y: emptyY, width: contentWidth, height: ROW_HEIGHT, borderColor: colors.border, borderWidth: 0.45 });
      drawCell(page, emptyLabel, margin, emptyY, contentWidth, regular, 8, colors.muted);
      y = emptyY;
    }
    rows.forEach((cells, index) => {
      if (ensureSpace(ROW_HEIGHT)) drawSection(`${title} (continuação)`, countLabel, columns);
      const rowY = y - ROW_HEIGHT;
      if (index % 2 === 1) page.drawRectangle({ x: margin, y: rowY, width: contentWidth, height: ROW_HEIGHT, color: colors.stripe });
      page.drawRectangle({ x: margin, y: rowY, width: contentWidth, height: ROW_HEIGHT, borderColor: colors.border, borderWidth: 0.4 });
      let x = margin;
      columns.forEach((column, columnIndex) => {
        const cell = cells[columnIndex];
        if (column.badge && cell.text) drawBadge(page, cell.text, x + 7, rowY, column.width - 14, bold);
        else drawCell(page, cell.text, x, rowY, column.width, cell.font === "bold" ? bold : regular, 8, cell.color);
        x += column.width;
      });
      y = rowY;
    });
    y -= 18;
  };

  addPage();
  drawSummary();

  drawTable(
    "Corretores escalados",
    plural(input.brokers.length, "corretor", "corretores"),
    BROKER_COLUMNS,
    input.brokers.map((broker) => [
      { text: broker.code },
      { text: broker.name, font: "bold" },
      { text: broker.presence },
      { text: broker.situation, color: broker.situationAlert ? colors.warning : undefined },
      { text: String(broker.leadsInWindow) },
      { text: broker.capacity === null ? String(broker.activeLeads) : `${broker.activeLeads} / ${broker.capacity}` },
    ]),
    "Nenhum corretor escalado neste plantão.",
  );

  const leadGroups = input.leadGroups.length ? input.leadGroups : [{ label: "Leads do plantão", leads: [] }];
  for (const group of leadGroups) {
    drawTable(
      input.leadGroups.length ? `Leads do plantão · ${group.label}` : group.label,
      plural(group.leads.length, "lead"),
      LEAD_COLUMNS,
      group.leads.map((lead) => [
        { text: lead.name, font: "bold" },
        { text: lead.phone },
        { text: lead.queue },
        lead.returnedUnaccepted ? { text: "Devolvido (não aceito)", color: colors.warning } : { text: lead.broker },
        { text: lead.distribution },
        { text: lead.stage },
        { text: dateTimeLabel(lead.receivedAt) },
        { text: lead.assignedAt ? dateTimeLabel(lead.assignedAt) : "-" },
      ]),
      "Nenhum lead neste plantão no período.",
    );
  }

  if (input.leadsTruncatedAt) {
    ensureSpace(14);
    page.drawText(printable(`Lista limitada aos ${input.leadsTruncatedAt} leads mais recentes do período.`), { x: margin, y: y, size: 7.5, font: regular, color: colors.muted });
  }

  drawReportFooters(pdf, `${input.tenantName} · ${input.scheduleName}`, regular);
  return new Uint8Array(await pdf.save());
}
