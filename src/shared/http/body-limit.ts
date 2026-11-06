/** Webhooks read the whole body before checking the signature; refuse oversized ones first. */
export const WEBHOOK_MAX_BODY_BYTES = 1024 * 1024;

export function exceedsBodyLimit(request: Request, maxBytes = WEBHOOK_MAX_BODY_BYTES) {
  const declared = Number(request.headers.get("content-length") ?? "");
  return Number.isFinite(declared) && declared > maxBytes;
}
