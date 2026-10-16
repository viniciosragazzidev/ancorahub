import { describe, expect, it } from "vitest";

import { IMAGE_EXTRACTION_INSTRUCTION, IMAGE_MIME_TYPES, NO_TEXT_MARKER, usableImageText } from "./image-text";

const table = [
  "Tabela Unimed Nacional PME 2026 | Faixa | Valor",
  "00 a 18 anos | R$ 289,90",
  "19 a 23 anos | R$ 341,20",
  "24 a 28 anos | R$ 398,75",
  "29 a 33 anos | R$ 455,10",
].join("\n");

describe("usableImageText", () => {
  it("keeps a price table read from an image", () => {
    expect(usableImageText(`  ${table}  `)).toBe(table);
  });

  it("drops the answer for an image without text", () => {
    expect(usableImageText(NO_TEXT_MARKER)).toBeNull();
    expect(usableImageText(`${NO_TEXT_MARKER.toLowerCase()}.`)).toBeNull();
  });

  it("drops a caption too short to be material", () => {
    expect(usableImageText("Bom dia, pessoal! Segue a tabela.")).toBeNull();
  });

  it("drops empty and missing answers", () => {
    expect(usableImageText("   ")).toBeNull();
    expect(usableImageText(null)).toBeNull();
    expect(usableImageText(undefined)).toBeNull();
  });
});

describe("image reading rules", () => {
  it("tells the model to transcribe, not interpret, and to answer with the marker when there is no text", () => {
    expect(IMAGE_EXTRACTION_INSTRUCTION).toContain("Não resuma, não interprete e não invente");
    expect(IMAGE_EXTRACTION_INSTRUCTION).toContain(NO_TEXT_MARKER);
  });

  it("accepts only common photo formats", () => {
    expect([...IMAGE_MIME_TYPES].sort()).toEqual(["image/jpeg", "image/png", "image/webp"]);
  });
});
