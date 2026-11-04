import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { REPORT_PAGE, dateTimeLabel, drawReportFooters, drawReportLogo, embedTenantLogo, printable, reportColors as colors } from "./report-pdf-kit";

export type DutyEscalaPdfBroker = { name: string; code: string | null; branchName: string | null };
export type DutyEscalaPdfType = { id: string; name: string; hue: number | null; modality: "online" | "presencial" };
export type DutyEscalaPdfOccurrence = {
  id: string;
  /** null when the source plantão has no configured type. */
  typeId: string | null;
  scheduleName: string;
  /** YYYY-MM-DD */
  dutyDate: string;
  /** "09:00" or "09:00:00" */
  startsAt: string;
  endsAt: string;
  modality: "online" | "presencial";
  minimumBrokers: number;
  brokers: DutyEscalaPdfBroker[];
};
export type DutyEscalaPdfInput = {
  tenantName: string;
  tenantLogoUrl?: string | null;
  generatedAt?: Date;
  /** "01/10/2026 a 05/11/2026" */
  periodLabel: string;
  /** "Geral" | "Unidade Centro" | "Tipo PME" */
  scopeLabel: string;
  /** draft => "RASCUNHO" pill in the header */
  status: "draft" | "published";
  /** false when the PDF is for one unit (every broker is from it): hide the unit next to names. */
  showBranch: boolean;
  types: DutyEscalaPdfType[];
  occurrences: DutyEscalaPdfOccurrence[];
};

type Palette = { strong: RGB; soft: RGB; text: RGB };

/** WinAnsi-safe text: dashes become "-" instead of "?" before the kit's printable(). */
function safe(value: unknown, max = 100) {
  return printable(String(value ?? "").replace(/[‒-―]/g, "-"), max);
}

function hslToRgb(hue: number, saturation: number, lightness: number): RGB {
  const h = (((hue % 360) + 360) % 360) / 360;
  const s = saturation / 100;
  const l = lightness / 100;
  if (s === 0) return rgb(l, l, l);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return rgb(channel(h + 1 / 3), channel(h), channel(h - 1 / 3));
}

/** Type color family from its hue (HSL); a null hue falls back to a neutral slate gray family. */
export function hueToRgb(hue: number | null): Palette {
  if (hue === null || !Number.isFinite(hue)) {
    return { strong: rgb(0.4, 0.44, 0.5), soft: rgb(0.95, 0.955, 0.965), text: rgb(0.24, 0.27, 0.32) };
  }
  return { strong: hslToRgb(hue, 65, 42), soft: hslToRgb(hue, 70, 95), text: hslToRgb(hue, 60, 28) };
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const MARGIN = REPORT_PAGE.margin;
const MAX_BAND_COLUMNS = 4;

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const weekendTint = rgb(0.955, 0.96, 0.975);
const gridLine = rgb(0.83, 0.85, 0.88);
const draftBg = rgb(1, 0.93, 0.8);

type Column = { id: string; name: string; modalityLabel: string; palette: Palette };

type CellLine =
  | { kind: "time"; text: string; warning: string | null; palette: Palette }
  | { kind: "broker"; name: string; branch: string | null; palette: Palette }
  | { kind: "note"; text: string; color: RGB }
  | { kind: "gap" };

function lineHeight(line: CellLine, scale: number) {
  if (line.kind === "time") return 10.5 * scale;
  if (line.kind === "gap") return 5 * scale;
  return 9.6 * scale;
}

function fit(value: string, font: PDFFont, size: number, maxWidth: number) {
  let text = safe(value, 240);
  if (maxWidth <= 0) return "";
  while (text.length > 1 && font.widthOfTextAtSize(text, size) > maxWidth) text = `${text.slice(0, -2)}…`;
  return font.widthOfTextAtSize(text, size) > maxWidth ? "" : text;
}

function hhmm(value: string) {
  return value.slice(0, 5);
}

function modalityLabel(modality: "online" | "presencial") {
  return modality === "online" ? "Online" : "Presencial";
}

function dateLabel(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return { weekday: WEEKDAYS[weekday] ?? "", day: `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`, weekend: weekday === 0 || weekday === 6 };
}

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function brokerKey(broker: DutyEscalaPdfBroker) {
  return `${broker.code ?? ""}|${broker.name}|${broker.branchName ?? ""}`;
}

function drawPill(page: PDFPage, text: string, x: number, centerY: number, font: PDFFont, size: number, background: RGB, color: RGB) {
  const label = safe(text, 40);
  const height = size + 7;
  const radius = height / 2;
  const width = font.widthOfTextAtSize(label, size) + 16;
  page.drawEllipse({ x: x + radius, y: centerY, xScale: radius, yScale: radius, color: background });
  page.drawEllipse({ x: x + width - radius, y: centerY, xScale: radius, yScale: radius, color: background });
  page.drawRectangle({ x: x + radius, y: centerY - radius, width: width - height, height, color: background });
  page.drawText(label, { x: x + 8, y: centerY - size * 0.35, size, font, color });
  return width;
}

// ---------------------------------------------------------------------------
// Encoder
// ---------------------------------------------------------------------------

export async function encodeDutyEscalaPdf(input: DutyEscalaPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(safe(`Escala de plantões · ${input.scopeLabel} · ${input.periodLabel}`, 200));
  pdf.setAuthor(safe(input.tenantName, 120));
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await embedTenantLogo(pdf, input.tenantLogoUrl);
  const generatedLabel = dateTimeLabel(input.generatedAt ?? new Date());

  // Untyped occurrences are omitted from this PDF; only configured categories belong in its legend/grid.
  const knownTypes = new Map(input.types.map((type) => [type.id, type]));
  const occurrences = input.occurrences.filter((occurrence) => occurrence.typeId !== null && knownTypes.has(occurrence.typeId));
  const columnIdOf = (occurrence: DutyEscalaPdfOccurrence) => occurrence.typeId!;
  const presentIds = new Set(occurrences.map(columnIdOf));
  const columns: Column[] = input.types
    .filter((type) => presentIds.has(type.id))
    .map((type) => ({ id: type.id, name: type.name, modalityLabel: modalityLabel(type.modality), palette: hueToRgb(type.hue) }));
  const singlePlantao = columns.length === 1;
  const scale = singlePlantao ? 1.25 : 1;
  const PAGE_W = singlePlantao ? REPORT_PAGE.height : REPORT_PAGE.width;
  const PAGE_H = singlePlantao ? REPORT_PAGE.width : REPORT_PAGE.height;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const BOTTOM_LIMIT = MARGIN + 18;
  const FULL_HEADER_H = 64 * scale;
  const COMPACT_HEADER_H = 30 * scale;
  const SECTION_TITLE_H = 24 * scale;
  const COLUMN_HEADER_H = 30 * scale;
  const DATE_COL_W = 74 * scale;
  const CELL_PAD_X = 6 * scale;
  const CELL_PAD_Y = 6 * scale;
  const MIN_ROW_H = 26 * scale;
  /** Tallest row that still fits a fresh continuation page; taller cells are clipped with "+ N". */
  const MAX_ROW_H = PAGE_H - MARGIN - COMPACT_HEADER_H - SECTION_TITLE_H - COLUMN_HEADER_H - BOTTOM_LIMIT - 4 * scale;

  // ---- Grouping: date -> column -> occurrences (sorted by time) ----
  const grid = new Map<string, Map<string, DutyEscalaPdfOccurrence[]>>();
  for (const occurrence of occurrences) {
    const byColumn = grid.get(occurrence.dutyDate) ?? new Map<string, DutyEscalaPdfOccurrence[]>();
    const columnId = columnIdOf(occurrence);
    byColumn.set(columnId, [...(byColumn.get(columnId) ?? []), occurrence]);
    grid.set(occurrence.dutyDate, byColumn);
  }
  for (const byColumn of grid.values()) {
    for (const list of byColumn.values()) {
      list.sort((a, b) => hhmm(a.startsAt).localeCompare(hhmm(b.startsAt)) || hhmm(a.endsAt).localeCompare(hhmm(b.endsAt)) || a.scheduleName.localeCompare(b.scheduleName, "pt-BR"));
    }
  }
  const allDates = [...grid.keys()].sort();
  const uniqueBrokers = new Set(occurrences.flatMap((occurrence) => occurrence.brokers.map(brokerKey)));

  // ---- Page scaffolding ----
  let page!: PDFPage;
  let y = 0;

  const drawFullHeader = () => {
    const top = PAGE_H - MARGIN;
    const titleX = drawReportLogo(page, logo, top, 46 * scale);
    const rightReserve = singlePlantao ? 150 : 190;
    const titleWidth = PAGE_W - MARGIN - titleX - rightReserve;
    page.drawText(fit(input.tenantName, bold, 8.5 * scale, titleWidth), { x: titleX, y: top - 9 * scale, size: 8.5 * scale, font: bold, color: colors.muted });
    const title = "Escala de plantões";
    page.drawText(safe(title), { x: titleX, y: top - 30 * scale, size: 19 * scale, font: bold, color: colors.ink });
    if (input.status === "draft") {
      drawPill(page, "RASCUNHO", titleX + bold.widthOfTextAtSize(safe(title), 19 * scale) + 10 * scale, top - 24 * scale, bold, 7.5 * scale, draftBg, colors.warning);
    }
    page.drawText(fit(`${input.scopeLabel} · ${input.periodLabel}`, regular, 9.5 * scale, titleWidth + 60), { x: titleX, y: top - 45 * scale, size: 9.5 * scale, font: regular, color: colors.muted });

    const right = PAGE_W - MARGIN;
    const generated = safe(`Gerado em ${generatedLabel}`);
    page.drawText(generated, { x: right - regular.widthOfTextAtSize(generated, 7.5 * scale), y: top - 9 * scale, size: 7.5 * scale, font: regular, color: colors.muted });
    if (occurrences.length) {
      const stats = safe(plural(occurrences.length, "plantão", "plantões"));
      page.drawText(stats, { x: right - bold.widthOfTextAtSize(stats, 13 * scale), y: top - 28 * scale, size: 13 * scale, font: bold, color: colors.accent });
      const sub = safe(`${plural(allDates.length, "dia", "dias")} · ${plural(uniqueBrokers.size, "corretor", "corretores")}`);
      page.drawText(sub, { x: right - regular.widthOfTextAtSize(sub, 8 * scale), y: top - 41 * scale, size: 8 * scale, font: regular, color: colors.muted });
    }
    y = top - FULL_HEADER_H + 8 * scale;
    page.drawRectangle({ x: MARGIN, y: y - 1.6 * scale, width: CONTENT_W, height: 1.6 * scale, color: colors.accent });
    y -= 12 * scale;
  };

  const drawCompactHeader = () => {
    const top = PAGE_H - MARGIN;
    const title = safe("Escala de plantões");
    page.drawText(title, { x: MARGIN, y: top - 11 * scale, size: 11 * scale, font: bold, color: colors.ink });
    let x = MARGIN + bold.widthOfTextAtSize(title, 11 * scale) + 8 * scale;
    if (input.status === "draft") x += drawPill(page, "RASCUNHO", x, top - 7.5 * scale, bold, 6.5 * scale, draftBg, colors.warning) + 8 * scale;
    const detail = fit(`${input.scopeLabel} · ${input.periodLabel}`, regular, 8.5 * scale, PAGE_W - MARGIN - x - 160 * scale);
    page.drawText(detail, { x, y: top - 11 * scale, size: 8.5 * scale, font: regular, color: colors.muted });
    const tenant = fit(input.tenantName, regular, 7.5 * scale, 150 * scale);
    page.drawText(tenant, { x: PAGE_W - MARGIN - regular.widthOfTextAtSize(tenant, 7.5 * scale), y: top - 11 * scale, size: 7.5 * scale, font: regular, color: colors.muted });
    y = top - 19 * scale;
    page.drawRectangle({ x: MARGIN, y: y - 0.8 * scale, width: CONTENT_W, height: 0.8 * scale, color: colors.accent });
    y -= COMPACT_HEADER_H - 19 * scale;
  };

  const addPage = (full = false) => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    if (full) drawFullHeader();
    else drawCompactHeader();
  };

  const drawSectionTitle = (title: string, detail: string) => {
    const baseline = y - 14 * scale;
    page.drawText(safe(title), { x: MARGIN, y: baseline, size: 11.5 * scale, font: bold, color: colors.header });
    const info = safe(detail);
    page.drawText(info, { x: PAGE_W - MARGIN - regular.widthOfTextAtSize(info, 8 * scale), y: baseline, size: 8 * scale, font: regular, color: colors.muted });
    y -= SECTION_TITLE_H;
  };

  // ---- Legend ----
  const drawLegend = () => {
    if (!columns.length) return;
    const counts = new Map<string, number>();
    for (const occurrence of occurrences) counts.set(columnIdOf(occurrence), (counts.get(columnIdOf(occurrence)) ?? 0) + 1);
    const label = safe("Legenda");
    const rowH = 18 * scale;
    let x: number = MARGIN;
    let rowTop = y;
    page.drawText(label, { x, y: rowTop - 12 * scale, size: 7.5 * scale, font: bold, color: colors.muted });
    x += bold.widthOfTextAtSize(label, 7.5 * scale) + 12 * scale;
    const startX = x;
    for (const column of columns) {
      const name = fit(column.name, bold, 8 * scale, 180 * scale);
      const meta = safe(`${column.modalityLabel} · ${counts.get(column.id) ?? 0}`);
      const chipW = (8 + 10 + 6 + 10) * scale + bold.widthOfTextAtSize(name, 8 * scale) + regular.widthOfTextAtSize(meta, 7 * scale);
      if (x + chipW > PAGE_W - MARGIN && x > startX) {
        x = startX;
        rowTop -= rowH + 4 * scale;
      }
      const chipY = rowTop - rowH;
      page.drawRectangle({ x, y: chipY, width: chipW, height: rowH, color: column.palette.soft, borderColor: column.palette.strong, borderWidth: 0.6 });
      page.drawRectangle({ x: x + 6 * scale, y: chipY + 5 * scale, width: 8 * scale, height: 8 * scale, color: column.palette.strong });
      page.drawText(name, { x: x + 18 * scale, y: chipY + 6 * scale, size: 8 * scale, font: bold, color: column.palette.text });
      page.drawText(meta, { x: x + 18 * scale + bold.widthOfTextAtSize(name, 8 * scale) + 6 * scale, y: chipY + 6.3 * scale, size: 7 * scale, font: regular, color: colors.muted });
      x += chipW + 8 * scale;
    }
    y = rowTop - rowH - 14 * scale;
  };

  // ---- Board cells ----
  const buildCellLines = (occurrences: DutyEscalaPdfOccurrence[], column: Column): CellLine[] => {
    const scheduleNames = new Set(occurrences.map((occurrence) => occurrence.scheduleName));
    const lines: CellLine[] = [];
    occurrences.forEach((occurrence, index) => {
      if (index > 0) lines.push({ kind: "gap" });
      const missing = Math.max(0, occurrence.minimumBrokers - occurrence.brokers.length);
      const time = `${hhmm(occurrence.startsAt)}-${hhmm(occurrence.endsAt)}`;
      lines.push({
        kind: "time",
        text: scheduleNames.size > 1 ? `${time} · ${occurrence.scheduleName}` : time,
        warning: missing > 0 ? `faltam ${missing}` : null,
        palette: column.palette,
      });
      if (!occurrence.brokers.length) lines.push({ kind: "note", text: "Sem corretores", color: colors.muted });
      const brokers = [...occurrence.brokers].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      for (const broker of brokers) {
        lines.push({ kind: "broker", name: broker.name, branch: input.showBranch ? broker.branchName : null, palette: column.palette });
      }
    });
    // Clip cells taller than a page, keeping the tail as "+ N corretores".
    const maxContent = MAX_ROW_H - CELL_PAD_Y * 2;
    const total = lines.reduce((sum, line) => sum + lineHeight(line, scale), 0);
    if (total <= maxContent) return lines;
    const kept: CellLine[] = [];
    let used = 9.6 * scale;
    for (const line of lines) {
      if (used + lineHeight(line, scale) > maxContent) break;
      kept.push(line);
      used += lineHeight(line, scale);
    }
    const hiddenBrokers = lines.slice(kept.length).filter((line) => line.kind === "broker").length;
    kept.push({ kind: "note", text: `+ ${plural(hiddenBrokers, "corretor", "corretores")}`, color: colors.muted });
    return kept;
  };

  const cellHeight = (lines: CellLine[]) => (lines.length ? lines.reduce((sum, line) => sum + lineHeight(line, scale), 0) + CELL_PAD_Y * 2 : 0);

  const drawCellLines = (lines: CellLine[], x: number, top: number, width: number) => {
    let lineTop = top - CELL_PAD_Y;
    const innerX = x + CELL_PAD_X;
    const innerW = width - CELL_PAD_X * 2;
    let blockStart: number | null = null;
    let blockPalette: Palette | null = null;
    const closeBlock = (bottom: number) => {
      if (blockStart !== null && blockPalette) {
        page.drawRectangle({ x: innerX, y: bottom + scale, width: 1.6 * scale, height: blockStart - bottom - scale, color: blockPalette.strong });
      }
      blockStart = null;
    };
    for (const line of lines) {
      const height = lineHeight(line, scale);
      const baseline = lineTop - height + 2.6 * scale;
      if (line.kind === "gap") {
        closeBlock(lineTop);
      } else if (line.kind === "time") {
        closeBlock(lineTop);
        blockStart = lineTop;
        blockPalette = line.palette;
        let warningWidth = 0;
        if (line.warning) {
          const warning = safe(line.warning);
          warningWidth = bold.widthOfTextAtSize(warning, 6.5 * scale) + 4 * scale;
          page.drawText(warning, { x: innerX + innerW - warningWidth + 4 * scale, y: baseline + 0.4 * scale, size: 6.5 * scale, font: bold, color: colors.warning });
        }
        page.drawText(fit(line.text, bold, 7.6 * scale, innerW - 6 * scale - warningWidth), { x: innerX + 6 * scale, y: baseline, size: 7.6 * scale, font: bold, color: line.palette.text });
      } else if (line.kind === "note") {
        page.drawText(fit(line.text, regular, 7 * scale, innerW - 6 * scale), { x: innerX + 6 * scale, y: baseline + 0.4 * scale, size: 7 * scale, font: regular, color: line.color });
      } else {
        let cursor = innerX + 6 * scale;
        const remaining = innerX + innerW - cursor;
        const branchFull = line.branch ? safe(line.branch, 120) : "";
        const branchBudget = branchFull ? Math.min(regular.widthOfTextAtSize(branchFull, 6.2 * scale), remaining * 0.4) : 0;
        const name = fit(line.name, regular, 7.4 * scale, remaining - (branchFull ? branchBudget + 4 * scale : 0));
        page.drawText(name, { x: cursor, y: baseline, size: 7.4 * scale, font: regular, color: colors.ink });
        cursor += regular.widthOfTextAtSize(name, 7.4 * scale);
        if (branchFull) {
          const branch = fit(branchFull, regular, 6.2 * scale, innerX + innerW - cursor - 4 * scale);
          if (branch) page.drawText(branch, { x: cursor + 4 * scale, y: baseline + 0.3 * scale, size: 6.2 * scale, font: regular, color: colors.muted });
        }
      }
      lineTop -= height;
    }
    closeBlock(lineTop);
  };

  // ---- Board ----
  const bands: Column[][] = [];
  for (let index = 0; index < columns.length; index += MAX_BAND_COLUMNS) bands.push(columns.slice(index, index + MAX_BAND_COLUMNS));

  const drawColumnHeader = (band: Column[], columnWidth: number) => {
    const headerY = y - COLUMN_HEADER_H;
    page.drawRectangle({ x: MARGIN, y: headerY, width: DATE_COL_W, height: COLUMN_HEADER_H, color: colors.header });
    page.drawText(safe("Data"), { x: MARGIN + 8 * scale, y: headerY + 11.5 * scale, size: 8.5 * scale, font: bold, color: colors.headerText });
    band.forEach((column, index) => {
      const x = MARGIN + DATE_COL_W + index * columnWidth;
      page.drawRectangle({ x, y: headerY, width: columnWidth, height: COLUMN_HEADER_H, color: column.palette.strong });
      page.drawText(fit(column.name, bold, 9 * scale, columnWidth - 16 * scale), { x: x + 8 * scale, y: headerY + 16 * scale, size: 9 * scale, font: bold, color: colors.headerText });
      page.drawText(fit(column.modalityLabel, regular, 7 * scale, columnWidth - 16 * scale), { x: x + 8 * scale, y: headerY + 6 * scale, size: 7 * scale, font: regular, color: rgb(0.94, 0.95, 0.97) });
      if (index > 0) page.drawLine({ start: { x, y: headerY }, end: { x, y: headerY + COLUMN_HEADER_H }, thickness: 0.8, color: colors.headerText });
    });
    page.drawLine({ start: { x: MARGIN + DATE_COL_W, y: headerY }, end: { x: MARGIN + DATE_COL_W, y: headerY + COLUMN_HEADER_H }, thickness: 0.8, color: colors.headerText });
    y = headerY;
  };

  const drawBand = (band: Column[], bandIndex: number) => {
    const columnWidth = (CONTENT_W - DATE_COL_W) / band.length;
    const bandIds = new Set(band.map((column) => column.id));
    const dates = allDates.filter((date) => [...(grid.get(date)?.keys() ?? [])].some((id) => bandIds.has(id)));
    const bandOccurrences = occurrences.filter((occurrence) => bandIds.has(columnIdOf(occurrence))).length;
    const baseTitle = bands.length > 1 ? `Quadro (parte ${bandIndex + 1} de ${bands.length})` : "Quadro";
    const detail = `${plural(dates.length, "dia", "dias")} · ${plural(bandOccurrences, "plantão", "plantões")}`;

    const rows = dates.map((date) => {
      const cells = band.map((column) => buildCellLines(grid.get(date)?.get(column.id) ?? [], column));
      const height = Math.max(MIN_ROW_H, ...cells.map(cellHeight));
      return { date, cells, height };
    });

    const minStart = SECTION_TITLE_H + COLUMN_HEADER_H + (rows[0]?.height ?? MIN_ROW_H);
    if (bandIndex > 0 || y - minStart < BOTTOM_LIMIT) addPage();
    drawSectionTitle(baseTitle, detail);
    drawColumnHeader(band, columnWidth);

    rows.forEach((row, rowIndex) => {
      if (y - row.height < BOTTOM_LIMIT) {
        addPage();
        drawSectionTitle(`${baseTitle} · continuação`, detail);
        drawColumnHeader(band, columnWidth);
      }
      const rowY = y - row.height;
      const label = dateLabel(row.date);
      page.drawRectangle({ x: MARGIN, y: rowY, width: DATE_COL_W, height: row.height, color: label.weekend ? weekendTint : rgb(1, 1, 1) });
      page.drawText(safe(label.weekday), { x: MARGIN + 8 * scale, y: row.height > 34 * scale ? y - 15 * scale : rowY + row.height / 2 - 3 * scale, size: 9 * scale, font: bold, color: label.weekend ? colors.muted : colors.ink });
      page.drawText(safe(label.day), { x: MARGIN + 8 * scale + bold.widthOfTextAtSize(safe(label.weekday), 9 * scale) + 5 * scale, y: row.height > 34 * scale ? y - 15 * scale : rowY + row.height / 2 - 3 * scale, size: 9 * scale, font: regular, color: label.weekend ? colors.muted : colors.ink });

      row.cells.forEach((lines, columnIndex) => {
        const column = band[columnIndex];
        const x = MARGIN + DATE_COL_W + columnIndex * columnWidth;
        if (lines.length) {
          page.drawRectangle({ x, y: rowY, width: columnWidth, height: row.height, color: column.palette.soft });
          drawCellLines(lines, x, y, columnWidth);
        } else {
          page.drawRectangle({ x, y: rowY, width: columnWidth, height: row.height, color: label.weekend ? weekendTint : rgb(1, 1, 1) });
          const dash = "-";
          page.drawText(dash, { x: x + columnWidth / 2 - regular.widthOfTextAtSize(dash, 9 * scale) / 2, y: rowY + row.height / 2 - 3 * scale, size: 9 * scale, font: regular, color: rgb(0.7, 0.72, 0.76) });
        }
      });
      // Grid lines
      page.drawLine({ start: { x: MARGIN, y: rowY }, end: { x: PAGE_W - MARGIN, y: rowY }, thickness: rowIndex === rows.length - 1 ? 0.8 : 0.5, color: gridLine });
      page.drawLine({ start: { x: MARGIN, y: rowY }, end: { x: MARGIN, y }, thickness: 0.5, color: gridLine });
      for (let index = 0; index <= band.length; index += 1) {
        const x = MARGIN + DATE_COL_W + index * columnWidth;
        page.drawLine({ start: { x, y: rowY }, end: { x, y }, thickness: 0.5, color: gridLine });
      }
      y = rowY;
    });
    y -= 16 * scale;
  };

  // ---- Compose ----
  addPage(true);
  if (!occurrences.length) {
    const boxH = 90;
    const boxY = y - 30 - boxH;
    page.drawRectangle({ x: MARGIN, y: boxY, width: CONTENT_W, height: boxH, color: colors.stripe, borderColor: colors.border, borderWidth: 0.6 });
    const message = safe("Nenhum plantão neste recorte.");
    page.drawText(message, { x: MARGIN + (CONTENT_W - bold.widthOfTextAtSize(message, 13)) / 2, y: boxY + boxH / 2 + 2, size: 13, font: bold, color: colors.ink });
    const hint = safe(`${input.scopeLabel} · ${input.periodLabel}`);
    page.drawText(hint, { x: MARGIN + (CONTENT_W - regular.widthOfTextAtSize(hint, 8.5)) / 2, y: boxY + boxH / 2 - 15, size: 8.5, font: regular, color: colors.muted });
  } else {
    drawLegend();
    bands.forEach((band, index) => drawBand(band, index));
  }

  drawReportFooters(pdf, `${input.tenantName} · Escala de plantões`, regular, { width: PAGE_W, height: PAGE_H, margin: MARGIN });
  return new Uint8Array(await pdf.save());
}
