export class MultipartLimitError extends Error {
  constructor() { super("Arquivo acima do limite ou formulário inválido."); this.name = "MultipartLimitError"; }
}

/** Bound the actual stream, not the untrusted Content-Length, before parsing multipart. */
export async function readBoundedFormData(request: Request, maxBytes: number) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || contentType.length > 300 || !/^multipart\/form-data;.*boundary=/i.test(contentType) || !request.body) throw new MultipartLimitError();
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) throw new MultipartLimitError();
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new MultipartLimitError(); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return await new Request(request.url, { method: "POST", headers: { "content-type": contentType }, body: bytes }).formData(); }
  catch { throw new MultipartLimitError(); }
}
