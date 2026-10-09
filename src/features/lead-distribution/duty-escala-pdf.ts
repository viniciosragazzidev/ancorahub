import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { REPORT_PAGE, dateTimeLabel, drawReportFooters, drawReportLogo, embedTenantLogo, printable, reportColors as colors } from "./report-pdf-kit";

export type DutyEscalaPdfBroker = { name: string; code: string | null; branchName: string | null };
export type DutyEscalaPdfType = { id: string; name: string; hue: number | null; modality: "online" | "presencial" };
export type DutyEscalaPdfOccurrence = {
  id: string;
  /** null = "Sem tipo" */
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

const { width: PAGE_W, height: PAGE_H, margin: MARGIN } = REPORT_PAGE;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM_LIMIT = MARGIN + 18; // footer sits at y=17
const FULL_HEADER_H = 64;
const COMPACT_HEADER_H = 30;
const SECTION_TITLE_H = 24;
const COLUMN_HEADER_H = 30;
const DATE_COL_W = 74;
const MAX_BAND_COLUMNS = 4;
const CELL_PAD_X = 6;
const CELL_PAD_Y = 6;
const TIME_LINE_H = 10.5;
const BROKER_LINE_H = 9.6;
const OCCURRENCE_GAP = 5;
const MIN_ROW_H = 26;
/** Tallest row that still fits a fresh continuation page; taller cells are clipped with "+ N". */
const MAX_ROW_H = PAGE_H - MARGIN - COMPACT_HEADER_H - SECTION_TITLE_H - COLUMN_HEADER_H - BOTTOM_LIMIT - 4;

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const NO_TYPE_ID = "__sem_tipo__";
/** Warm stone neutral, so "Sem tipo" never looks like a type that just has no hue. */
const NO_TYPE_PALETTE: Palette = { strong: rgb(0.52, 0.49, 0.45), soft: rgb(0.97, 0.965, 0.955), text: rgb(0.33, 0.3, 0.27) };
const weekendTint = rgb(0.955, 0.96, 0.975);
const gridLine = rgb(0.83, 0.85, 0.88);
const draftBg = rgb(1, 0.93, 0.8);

type Column = { id: string; name: string; modalityLabel: string; palette: Palette };

type CellLine =
  | { kind: "time"; text: string; warning: string | null; palette: Palette }
  | { kind: "broker"; code: string | null; name: string; branch: string | null; palette: Palette }
  | { kind: "note"; text: string; color: RGB }
  | { kind: "gap" };

function lineHeight(line: CellLine) {
  if (line.kind === "time") return TIME_LINE_H;
  if (line.kind === "gap") return OCCURRENCE_GAP;
  return BROKER_LINE_H;
}

function fit(value: string, font: PDFFont, size: number, maxWidth: number) {
  let text = safe(value, 240);
  if (maxWidth <= 0) return "";
  while (text.length > 1 && font.widthOfTextAtSize(text, size) > maxWidth) text = `${text.slice(0, -2)}…`;
  return font.widthOfTextAtSize(text, size) > maxWidth ? "" : text;
}

/** Word-wraps into at most two lines; the second one is truncated with "…". */
function wrapTwoLines(value: string, font: PDFFont, size: number, maxWidth: number) {
  const words = safe(value, 120).split(" ").filter(Boolean);
  let first = "";
  let index = 0;
  while (index < words.length) {
    const candidate = first ? `${first} ${words[index]}` : words[index];
    if (font.widthOfTextAtSize(candidate, size) > maxWidth) break;
    first = candidate;
    index += 1;
  }
  if (!first) return [fit(value, font, size, maxWidth)];
  const rest = words.slice(index).join(" ");
  return rest ? [first, fit(rest, font, size, maxWidth)] : [first];
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

  // ---- Columns (types present, ordered as input.types, "Sem tipo" last) ----
  const knownTypes = new Map(input.types.map((type) => [type.id, type]));
  const columnIdOf = (occurrence: DutyEscalaPdfOccurrence) => (occurrence.typeId && knownTypes.has(occurrence.typeId) ? occurrence.typeId : NO_TYPE_ID);
  const presentIds = new Set(input.occurrences.map(columnIdOf));
  const columns: Column[] = input.types
    .filter((type) => presentIds.has(type.id))
    .map((type) => ({ id: type.id, name: type.name, modalityLabel: modalityLabel(type.modality), palette: hueToRgb(type.hue) }));
  if (presentIds.has(NO_TYPE_ID)) {
    const modalities = new Set(input.occurrences.filter((occurrence) => columnIdOf(occurrence) === NO_TYPE_ID).map((occurrence) => occurrence.modality));
    columns.push({
      id: NO_TYPE_ID,
      name: "Sem tipo",
      modalityLabel: modalities.size === 1 ? modalityLabel([...modalities][0]) : "Online e presencial",
      palette: NO_TYPE_PALETTE,
    });
  }

  // ---- Grouping: date -> column -> occurrences (sorted by time) ----
  const grid = new Map<string, Map<string, DutyEscalaPdfOccurrence[]>>();
  for (const occurrence of input.occurrences) {
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
  const uniqueBrokers = new Set(input.occurrences.flatMap((occurrence) => occurrence.brokers.map(brokerKey)));

  // ---- Page scaffolding ----
  let page!: PDFPage;
  let y = 0;

  const drawFullHeader = () => {
    const top = PAGE_H - MARGIN;
    const titleX = drawReportLogo(page, logo, top, 46);
    const rightReserve = 190;
    const titleWidth = PAGE_W - MARGIN - titleX - rightReserve;
    page.drawText(fit(input.tenantName, bold, 8.5, titleWidth), { x: titleX, y: top - 9, size: 8.5, font: bold, color: colors.muted });
    const title = "Escala de plantões";
    page.drawText(safe(title), { x: titleX, y: top - 30, size: 19, font: bold, color: colors.ink });
    if (input.status === "draft") {
      drawPill(page, "RASCUNHO", titleX + bold.widthOfTextAtSize(safe(title), 19) + 10, top - 24, bold, 7.5, draftBg, colors.warning);
    }
    page.drawText(fit(`${input.scopeLabel} · ${input.periodLabel}`, regular, 9.5, titleWidth + 60), { x: titleX, y: top - 45, size: 9.5, font: regular, color: colors.muted });

    const right = PAGE_W - MARGIN;
    const generated = safe(`Gerado em ${generatedLabel}`);
    page.drawText(generated, { x: right - regular.widthOfTextAtSize(generated, 7.5), y: top - 9, size: 7.5, font: regular, color: colors.muted });
    if (input.occurrences.length) {
      const stats = safe(plural(input.occurrences.length, "plantão", "plantões"));
      page.drawText(stats, { x: right - bold.widthOfTextAtSize(stats, 13), y: top - 28, size: 13, font: bold, color: colors.accent });
      const sub = safe(`${plural(allDates.length, "dia", "dias")} · ${plural(uniqueBrokers.size, "corretor", "corretores")}`);
      page.drawText(sub, { x: right - regular.widthOfTextAtSize(sub, 8), y: top - 41, size: 8, font: regular, color: colors.muted });
    }
    y = top - FULL_HEADER_H + 8;
    page.drawRectangle({ x: MARGIN, y: y - 1.6, width: CONTENT_W, height: 1.6, color: colors.accent });
    y -= 12;
  };

  const drawCompactHeader = () => {
    const top = PAGE_H - MARGIN;
    const title = safe("Escala de plantões");
    page.drawText(title, { x: MARGIN, y: top - 11, size: 11, font: bold, color: colors.ink });
    let x = MARGIN + bold.widthOfTextAtSize(title, 11) + 8;
    if (input.status === "draft") x += drawPill(page, "RASCUNHO", x, top - 7.5, bold, 6.5, draftBg, colors.warning) + 8;
    const detail = fit(`${input.scopeLabel} · ${input.periodLabel}`, regular, 8.5, PAGE_W - MARGIN - x - 160);
    page.drawText(detail, { x, y: top - 11, size: 8.5, font: regular, color: colors.muted });
    const tenant = fit(input.tenantName, regular, 7.5, 150);
    page.drawText(tenant, { x: PAGE_W - MARGIN - regular.widthOfTextAtSize(tenant, 7.5), y: top - 11, size: 7.5, font: regular, color: colors.muted });
    y = top - 19;
    page.drawRectangle({ x: MARGIN, y: y - 0.8, width: CONTENT_W, height: 0.8, color: colors.accent });
    y -= COMPACT_HEADER_H - 19;
  };

  const addPage = (full = false) => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    if (full) drawFullHeader();
    else drawCompactHeader();
  };

  const drawSectionTitle = (title: string, detail: string) => {
    const baseline = y - 14;
    page.drawText(safe(title), { x: MARGIN, y: baseline, size: 11.5, font: bold, color: colors.header });
    const info = safe(detail);
    page.drawText(info, { x: PAGE_W - MARGIN - regular.widthOfTextAtSize(info, 8), y: baseline, size: 8, font: regular, color: colors.muted });
    y -= SECTION_TITLE_H;
  };

  // ---- Legend ----
  const drawLegend = () => {
    if (!columns.length) return;
    const counts = new Map<string, number>();
    for (const occurrence of input.occurrences) counts.set(columnIdOf(occurrence), (counts.get(columnIdOf(occurrence)) ?? 0) + 1);
    const label = safe("Legenda");
    const rowH = 18;
    let x: number = MARGIN;
    let rowTop = y;
    page.drawText(label, { x, y: rowTop - 12, size: 7.5, font: bold, color: colors.muted });
    x += bold.widthOfTextAtSize(label, 7.5) + 12;
    const startX = x;
    for (const column of columns) {
      const name = fit(column.name, bold, 8, 180);
      const meta = safe(`${column.modalityLabel} · ${counts.get(column.id) ?? 0}`);
      const chipW = 8 + 10 + bold.widthOfTextAtSize(name, 8) + 6 + regular.widthOfTextAtSize(meta, 7) + 10;
      if (x + chipW > PAGE_W - MARGIN && x > startX) {
        x = startX;
        rowTop -= rowH + 4;
      }
      const chipY = rowTop - rowH;
      page.drawRectangle({ x, y: chipY, width: chipW, height: rowH, color: column.palette.soft, borderColor: column.palette.strong, borderWidth: 0.6 });
      page.drawRectangle({ x: x + 6, y: chipY + 5, width: 8, height: 8, color: column.palette.strong });
      page.drawText(name, { x: x + 18, y: chipY + 6, size: 8, font: bold, color: column.palette.text });
      page.drawText(meta, { x: x + 18 + bold.widthOfTextAtSize(name, 8) + 6, y: chipY + 6.3, size: 7, font: regular, color: colors.muted });
      x += chipW + 8;
    }
    y = rowTop - rowH - 14;
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
        lines.push({ kind: "broker", code: broker.code, name: broker.name, branch: input.showBranch ? broker.branchName : null, palette: column.palette });
      }
    });
    // Clip cells taller than a page, keeping the tail as "+ N corretores".
    const maxContent = MAX_ROW_H - CELL_PAD_Y * 2;
    const total = lines.reduce((sum, line) => sum + lineHeight(line), 0);
    if (total <= maxContent) return lines;
    const kept: CellLine[] = [];
    let used = BROKER_LINE_H;
    for (const line of lines) {
      if (used + lineHeight(line) > maxContent) break;
      kept.push(line);
      used += lineHeight(line);
    }
    const hiddenBrokers = lines.slice(kept.length).filter((line) => line.kind === "broker").length;
    kept.push({ kind: "note", text: `+ ${plural(hiddenBrokers, "corretor", "corretores")}`, color: colors.muted });
    return kept;
  };

  const cellHeight = (lines: CellLine[]) => (lines.length ? lines.reduce((sum, line) => sum + lineHeight(line), 0) + CELL_PAD_Y * 2 : 0);

  const drawCellLines = (lines: CellLine[], x: number, top: number, width: number) => {
    let lineTop = top - CELL_PAD_Y;
    const innerX = x + CELL_PAD_X;
    const innerW = width - CELL_PAD_X * 2;
    let blockStart: number | null = null;
    let blockPalette: Palette | null = null;
    const closeBlock = (bottom: number) => {
      if (blockStart !== null && blockPalette) {
        page.drawRectangle({ x: innerX, y: bottom + 1, width: 1.6, height: blockStart - bottom - 1, color: blockPalette.strong });
      }
      blockStart = null;
    };
    for (const line of lines) {
      const height = lineHeight(line);
      const baseline = lineTop - height + 2.6;
      if (line.kind === "gap") {
        closeBlock(lineTop);
      } else if (line.kind === "time") {
        closeBlock(lineTop);
        blockStart = lineTop;
        blockPalette = line.palette;
        let warningWidth = 0;
        if (line.warning) {
          const warning = safe(line.warning);
          warningWidth = bold.widthOfTextAtSize(warning, 6.5) + 4;
          page.drawText(warning, { x: innerX + innerW - warningWidth + 4, y: baseline + 0.4, size: 6.5, font: bold, color: colors.warning });
        }
        page.drawText(fit(line.text, bold, 7.6, innerW - 6 - warningWidth), { x: innerX + 6, y: baseline, size: 7.6, font: bold, color: line.palette.text });
      } else if (line.kind === "note") {
        page.drawText(fit(line.text, regular, 7, innerW - 6), { x: innerX + 6, y: baseline + 0.4, size: 7, font: regular, color: line.color });
      } else {
        let cursor = innerX + 6;
        const available = innerW - 6;
        const sep = safe(" · ");
        const code = line.code ? fit(line.code, bold, 7, available * 0.4) : "";
        if (code) {
          page.drawText(code, { x: cursor, y: baseline, size: 7, font: bold, color: line.palette.text });
          cursor += bold.widthOfTextAtSize(code, 7);
          page.drawText(sep, { x: cursor, y: baseline, size: 7, font: regular, color: colors.muted });
          cursor += regular.widthOfTextAtSize(sep, 7);
        }
        const remaining = innerX + innerW - cursor;
        const branchFull = line.branch ? safe(line.branch, 120) : "";
        const branchBudget = branchFull ? Math.min(regular.widthOfTextAtSize(branchFull, 6.2), remaining * 0.4) : 0;
        const name = fit(line.name, regular, 7.4, remaining - (branchFull ? branchBudget + 4 : 0));
        page.drawText(name, { x: cursor, y: baseline, size: 7.4, font: regular, color: colors.ink });
        cursor += regular.widthOfTextAtSize(name, 7.4);
        if (branchFull) {
          const branch = fit(branchFull, regular, 6.2, innerX + innerW - cursor - 4);
          if (branch) page.drawText(branch, { x: cursor + 4, y: baseline + 0.3, size: 6.2, font: regular, color: colors.muted });
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
    page.drawText(safe("Data"), { x: MARGIN + 8, y: headerY + 11.5, size: 8.5, font: bold, color: colors.headerText });
    band.forEach((column, index) => {
      const x = MARGIN + DATE_COL_W + index * columnWidth;
      page.drawRectangle({ x, y: headerY, width: columnWidth, height: COLUMN_HEADER_H, color: column.palette.strong });
      page.drawText(fit(column.name, bold, 9, columnWidth - 16), { x: x + 8, y: headerY + 16, size: 9, font: bold, color: colors.headerText });
      page.drawText(fit(column.modalityLabel, regular, 7, columnWidth - 16), { x: x + 8, y: headerY + 6, size: 7, font: regular, color: rgb(0.94, 0.95, 0.97) });
      if (index > 0) page.drawLine({ start: { x, y: headerY }, end: { x, y: headerY + COLUMN_HEADER_H }, thickness: 0.8, color: colors.headerText });
    });
    page.drawLine({ start: { x: MARGIN + DATE_COL_W, y: headerY }, end: { x: MARGIN + DATE_COL_W, y: headerY + COLUMN_HEADER_H }, thickness: 0.8, color: colors.headerText });
    y = headerY;
  };

  const drawBand = (band: Column[], bandIndex: number) => {
    const columnWidth = (CONTENT_W - DATE_COL_W) / band.length;
    const bandIds = new Set(band.map((column) => column.id));
    const dates = allDates.filter((date) => [...(grid.get(date)?.keys() ?? [])].some((id) => bandIds.has(id)));
    const bandOccurrences = input.occurrences.filter((occurrence) => bandIds.has(columnIdOf(occurrence))).length;
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
      page.drawText(safe(label.weekday), { x: MARGIN + 8, y: row.height > 34 ? y - 15 : rowY + row.height / 2 - 3, size: 9, font: bold, color: label.weekend ? colors.muted : colors.ink });
      page.drawText(safe(label.day), { x: MARGIN + 8 + bold.widthOfTextAtSize(safe(label.weekday), 9) + 5, y: row.height > 34 ? y - 15 : rowY + row.height / 2 - 3, size: 9, font: regular, color: label.weekend ? colors.muted : colors.ink });

      row.cells.forEach((lines, columnIndex) => {
        const column = band[columnIndex];
        const x = MARGIN + DATE_COL_W + columnIndex * columnWidth;
        if (lines.length) {
          page.drawRectangle({ x, y: rowY, width: columnWidth, height: row.height, color: column.palette.soft });
          drawCellLines(lines, x, y, columnWidth);
        } else {
          page.drawRectangle({ x, y: rowY, width: columnWidth, height: row.height, color: label.weekend ? weekendTint : rgb(1, 1, 1) });
          const dash = "-";
          page.drawText(dash, { x: x + columnWidth / 2 - regular.widthOfTextAtSize(dash, 9) / 2, y: rowY + row.height / 2 - 3, size: 9, font: regular, color: rgb(0.7, 0.72, 0.76) });
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
    y -= 16;
  };

  // ---- Summary per broker ----
  const drawSummary = () => {
    type BrokerRow = { code: string | null; name: string; branch: string | null; counts: Map<string, number>; total: number };
    const brokers = new Map<string, BrokerRow>();
    for (const occurrence of input.occurrences) {
      const columnId = columnIdOf(occurrence);
      const seen = new Set<string>();
      for (const broker of occurrence.brokers) {
        const key = brokerKey(broker);
        if (seen.has(key)) continue;
        seen.add(key);
        const row = brokers.get(key) ?? { code: broker.code, name: broker.name, branch: broker.branchName, counts: new Map(), total: 0 };
        row.counts.set(columnId, (row.counts.get(columnId) ?? 0) + 1);
        row.total += 1;
        brokers.set(key, row);
      }
    }
    const rows = [...brokers.values()].sort((a, b) => {
      if (input.showBranch) {
        if (a.branch && !b.branch) return -1;
        if (!a.branch && b.branch) return 1;
        const byBranch = (a.branch ?? "").localeCompare(b.branch ?? "", "pt-BR");
        if (byBranch) return byBranch;
      }
      return a.name.localeCompare(b.name, "pt-BR") || (a.code ?? "").localeCompare(b.code ?? "", "pt-BR");
    });

    const codeW = 62;
    const totalW = 56;
    const branchW = input.showBranch ? (columns.length > 4 ? 118 : 140) : 0;
    const typeW = Math.max(46, Math.min(96, (CONTENT_W - codeW - totalW - branchW - 160) / Math.max(1, columns.length)));
    const nameW = CONTENT_W - codeW - totalW - branchW - typeW * columns.length;
    const HEAD_H = 30;
    const ROW_H = 18;
    const detail = plural(rows.length, "corretor", "corretores");

    const drawHead = () => {
      const headY = y - HEAD_H;
      page.drawRectangle({ x: MARGIN, y: headY, width: CONTENT_W, height: HEAD_H, color: colors.header });
      let x: number = MARGIN;
      const label = (text: string, width: number, align: "left" | "center" = "left") => {
        const value = fit(text, bold, 7.8, width - 12);
        const textX = align === "center" ? x + (width - bold.widthOfTextAtSize(value, 7.8)) / 2 : x + 7;
        page.drawText(value, { x: textX, y: headY + 11.5, size: 7.8, font: bold, color: colors.headerText });
        x += width;
      };
      label("Código", codeW);
      label("Corretor", nameW);
      if (input.showBranch) label("Unidade", branchW);
      for (const column of columns) {
        page.drawRectangle({ x, y: headY, width: typeW, height: 3, color: column.palette.strong });
        const nameLines = wrapTwoLines(column.name, bold, 7.4, typeW - 10);
        nameLines.forEach((value, lineIndex) => {
          const lineY = nameLines.length === 1 ? headY + 11.5 : headY + 16.5 - lineIndex * 9;
          page.drawText(value, { x: x + (typeW - bold.widthOfTextAtSize(value, 7.4)) / 2, y: lineY, size: 7.4, font: bold, color: colors.headerText });
        });
        x += typeW;
      }
      label("Total", totalW, "center");
      y = headY;
    };

    addPage();
    drawSectionTitle("Resumo por corretor", detail);
    drawHead();

    const drawRow = (row: BrokerRow | null, index: number) => {
      if (y - ROW_H < BOTTOM_LIMIT) {
        addPage();
        drawSectionTitle("Resumo por corretor · continuação", detail);
        drawHead();
      }
      const rowY = y - ROW_H;
      const isTotal = row === null;
      if (isTotal) page.drawRectangle({ x: MARGIN, y: rowY, width: CONTENT_W, height: ROW_H, color: colors.sectionBg });
      else if (index % 2 === 1) page.drawRectangle({ x: MARGIN, y: rowY, width: CONTENT_W, height: ROW_H, color: colors.stripe });
      if (!isTotal) page.drawRectangle({ x: PAGE_W - MARGIN - totalW, y: rowY, width: totalW, height: ROW_H, color: colors.sectionBg, opacity: 0.6 });
      // Thicker rule where the unit changes (rows are grouped by unit).
      const previous = index > 0 ? rows[index - 1] : null;
      if (input.showBranch && !isTotal && previous && previous.branch !== row.branch) {
        page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1, color: colors.muted });
      }
      page.drawLine({ start: { x: MARGIN, y: rowY }, end: { x: PAGE_W - MARGIN, y: rowY }, thickness: 0.4, color: colors.border });
      const textY = rowY + 6;
      let x: number = MARGIN;
      if (isTotal) {
        page.drawText(safe("Total"), { x: x + 7, y: textY, size: 7.8, font: bold, color: colors.ink });
        x += codeW + nameW + branchW;
      } else {
        page.drawText(fit(row.code ?? "-", regular, 7.6, codeW - 12), { x: x + 7, y: textY, size: 7.6, font: regular, color: row.code ? colors.muted : colors.border });
        x += codeW;
        page.drawText(fit(row.name, bold, 7.8, nameW - 12), { x: x + 7, y: textY, size: 7.8, font: bold, color: colors.ink });
        x += nameW;
        if (input.showBranch) {
          page.drawText(fit(row.branch ?? "Sem unidade", regular, 7.6, branchW - 12), { x: x + 7, y: textY, size: 7.6, font: regular, color: colors.muted });
          x += branchW;
        }
      }
      for (const column of columns) {
        const count = isTotal ? rows.reduce((sum, item) => sum + (item.counts.get(column.id) ?? 0), 0) : (row.counts.get(column.id) ?? 0);
        const text = count ? String(count) : "-";
        const font = count ? bold : regular;
        page.drawText(text, { x: x + (typeW - font.widthOfTextAtSize(text, 8)) / 2, y: textY, size: 8, font, color: count ? column.palette.text : colors.border });
        x += typeW;
      }
      const total = String(isTotal ? rows.reduce((sum, item) => sum + item.total, 0) : row.total);
      page.drawText(total, { x: x + (totalW - bold.widthOfTextAtSize(total, 8.4)) / 2, y: textY, size: 8.4, font: bold, color: colors.ink });
      y = rowY;
    };

    rows.forEach((row, index) => drawRow(row, index));
    if (rows.length) drawRow(null, rows.length);
    else {
      const emptyY = y - ROW_H;
      page.drawText(safe("Nenhum corretor escalado."), { x: MARGIN + 7, y: emptyY + 6, size: 8, font: regular, color: colors.muted });
      y = emptyY;
    }
  };

  // ---- Compose ----
  addPage(true);
  if (!input.occurrences.length) {
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
    drawSummary();
  }

  drawReportFooters(pdf, `${input.tenantName} · Escala de plantões`, regular);
  return new Uint8Array(await pdf.save());
}
