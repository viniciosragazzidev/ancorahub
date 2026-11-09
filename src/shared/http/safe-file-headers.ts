/**
 * Headers for serving stored files (WhatsApp media, lead documents, operator
 * materials) from the CRM origin.
 *
 * The MIME type of these files comes from whoever sent or uploaded them. A
 * contact can send an .html or .svg on WhatsApp; served inline from our
 * origin it would run script with the logged-in user's session. So only types
 * the browser renders without executing code are shown inline; everything
 * else is downloaded as an opaque attachment, and every response is sandboxed.
 */

const INLINE_SAFE_MIME = /^(image\/(jpeg|png|webp|gif|avif|bmp)|audio\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+|application\/ogg|application\/pdf)$/;

/** Raster images a browser can never execute: avatars and pictures. */
export const RASTER_IMAGE_MIME = /^image\/(jpeg|png|webp|gif|avif)$/;

export function normalizeMime(mimeType: string | null | undefined) {
  return (mimeType ?? "").split(";")[0]!.trim().toLowerCase();
}

export function isInlineSafeMime(mimeType: string | null | undefined) {
  return INLINE_SAFE_MIME.test(normalizeMime(mimeType));
}

/** Filename safe for a quoted Content-Disposition value, plus an RFC 5987 copy for accents. */
function dispositionFilename(filename: string | null | undefined) {
  const cleaned = (filename ?? "arquivo").replace(/[\r\n"\\]/g, "").replace(/[/]/g, "_").trim().slice(0, 180) || "arquivo";
  const ascii = cleaned.normalize("NFD").replace(/[^\x20-\x7e]/g, "");
  return `filename="${ascii || "arquivo"}"; filename*=UTF-8''${encodeURIComponent(cleaned)}`;
}

export function safeFileHeaders(input: { mimeType: string | null | undefined; filename: string | null | undefined }) {
  const mime = normalizeMime(input.mimeType);
  const inline = isInlineSafeMime(mime);
  // Chrome's PDF viewer does not open inside a sandboxed or CSP-restricted
  // document, and it runs no script on our origin, so inline PDFs get no CSP.
  // Everything else is sandboxed.
  const pdfViewer = inline && mime === "application/pdf";
  return {
    "Content-Type": inline ? mime : "application/octet-stream",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; ${dispositionFilename(input.filename)}`,
    "X-Content-Type-Options": "nosniff",
    ...(pdfViewer
      ? {}
      : { "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox" }),
    "Cache-Control": "private, no-store",
  };
}
