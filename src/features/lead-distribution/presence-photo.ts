import "server-only";

import sharp from "sharp";

/** Real image by its first bytes (the declared MIME type is not trusted): JPEG, PNG or WebP. */
export function isAllowedImage(bytes: Uint8Array) {
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  const webp = bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  return jpeg || png || webp;
}

/** Re-encoded on the server: always JPEG, up to 1600px, upright, and without metadata (no GPS/EXIF is ever stored). */
export async function cleanPresencePhoto(bytes: Buffer) {
  return sharp(bytes, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
}
