import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { extractPdfText } from "./pdf-text";

async function buildPdf(lines: string[]) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]);
  lines.forEach((line, index) => page.drawText(line, { x: 50, y: 780 - index * 20, size: 12, font }));
  return new Uint8Array(await doc.save());
}

describe("extractPdfText", () => {
  it("reads the text of a text-based PDF", async () => {
    const bytes = await buildPdf(["Tabela Unimed 2026", "Plano Ouro 30-39 anos: 412,50"]);
    const text = await extractPdfText(bytes);
    expect(text).toContain("Tabela Unimed 2026");
    expect(text).toContain("Plano Ouro 30-39 anos: 412,50");
  });

  it("returns almost nothing for a PDF without text layer", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([595, 842]);
    const text = await extractPdfText(new Uint8Array(await doc.save()));
    expect(text.trim().length).toBeLessThan(10);
  });
});
