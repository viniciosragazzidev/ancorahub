/**
 * fetchWithTimeout — wrapper around fetch that adds a timeout via AbortController.
 *
 * If the request doesn't complete within `timeoutMs`, the request is aborted
 * and an error is thrown with code `TIMEOUT`.
 *
 * Usage:
 *   const res = await fetchWithTimeout(url, { timeoutMs: 5000 });
 *   const data = await res.json();
 */

export class FetchTimeoutError extends Error {
  readonly code = "TIMEOUT" as const;
  constructor(message: string, public readonly url: string, public readonly timeoutMs: number) {
    super(message);
    this.name = "FetchTimeoutError";
  }
}

export async function fetchWithTimeout(
  url: string | URL | Request,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const timeoutMs = init?.timeoutMs ?? 10_000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new FetchTimeoutError(
        `Request to ${typeof url === "string" ? url : url.toString()} timed out after ${timeoutMs}ms`,
        typeof url === "string" ? url : url.toString(),
        timeoutMs,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
