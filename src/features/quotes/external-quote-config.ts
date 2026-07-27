import "server-only";

export function getExternalQuoteBaseUrl() {
  const value = process.env.EXTERNAL_QUOTE_APP_URL?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url;
  } catch {
    return null;
  }
}

export function isExternalQuoteConfigured() {
  return Boolean(getExternalQuoteBaseUrl());
}
