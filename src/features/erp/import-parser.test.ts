import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { IMPORT_LAYOUTS, parseCsv, parseImportFile } from "./import-parser";
import { excelCalendarDate, readOpenXmlRows } from "./openxml-reader";

const header = IMPORT_LAYOUTS.implantations.join(";");
const row = "lead-one;ref-one;review;policy-one;2026-11-01;;Conferir documentos";

describe("bounded ERP import files", () => {
  it("reads accented headers, quoted separators and multiline fields", () => {
    const csv = `${header.replace("referencia", "referência")}\r\nlead-one;ref-one;review;policy-one;2026-11-01;;"Conferir;\ncom a operadora"`;
    const result = parseImportFile(Buffer.from(csv), "input.csv", "implantations", 100);
    expect(result[0].values.motivo).toBe("Conferir;\ncom a operadora");
  });
  it("does not silently drop rows, extra columns or malformed CSV quotes", () => {
    expect(() => parseImportFile(Buffer.from(`${header}\n${row}\n${row}`), "input.csv", "implantations", 1)).toThrow();
    expect(() => parseImportFile(Buffer.from(`${header}\n${row};extra`), "input.csv", "implantations", 100)).toThrow();
    expect(() => parseCsv('a;b\n"unterminated;b', 10)).toThrow();
    expect(() => parseCsv('a;b\n"value"garbage;b', 10)).toThrow();
  });
  it("rejects formulas, unsupported authority columns and non-UTF8 files", () => {
    expect(() => parseImportFile(Buffer.from(`${header}\n${row.replace("ref-one", "=HYPERLINK(1)")}`), "input.csv", "implantations", 100)).toThrow();
    expect(() => parseImportFile(Buffer.from(`tenant_id;${header}\ntenant-b;${row}`), "input.csv", "implantations", 100)).toThrow();
    expect(() => parseImportFile(Buffer.from([0xff, 0xfe, 0x61]), "input.csv", "implantations", 100)).toThrow();
  });
  it("reads a real XLSX built from literal values", () => {
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([[...IMPORT_LAYOUTS.implantations], row.split(";")]), "Dados");
    const bytes: Buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx", compression: true });
    expect(parseImportFile(bytes, "input.xlsx", "implantations", 100)[0].values.negocio_id).toBe("lead-one");
  });
  it("rejects XLSX formulas before using their cached value", () => {
    const book = XLSX.utils.book_new(); const sheet = XLSX.utils.aoa_to_sheet([[...IMPORT_LAYOUTS.implantations], row.split(";")]);
    sheet.B2 = { t: "n", f: "1+1", v: 2 }; XLSX.utils.book_append_sheet(book, sheet, "Dados");
    const bytes: Buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
    expect(() => parseImportFile(bytes, "input.xlsx", "implantations", 100)).toThrow(/fórmulas/);
  });
  it("does not evaluate XML entities or resolve external references", () => {
    const files = new Map([["xl/workbook.xml", Buffer.from('<!DOCTYPE workbook [<!ENTITY x SYSTEM "file:///private">]><workbook/>')]]);
    expect(() => readOpenXmlRows(files, 100)).toThrow(/instruções/);
  });
  it("preserves calendar dates across the two Excel epochs and rejects its fictitious leap day", () => {
    expect(excelCalendarDate(1, false)).toBe("1900-01-01"); expect(excelCalendarDate(61, false)).toBe("1900-03-01");
    expect(excelCalendarDate(0, true)).toBe("1904-01-01"); expect(() => excelCalendarDate(60, false)).toThrow();
  });
});
