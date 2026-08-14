const NUMERIC_META_ID = /^\d+$/;
const AD_ACCOUNT_ID = /^(?:act_)?\d+$/i;

/** Meta Graph object identifiers are numeric strings in production. */
export function isMetaObjectId(value: string | null | undefined): value is string {
  return typeof value === "string" && NUMERIC_META_ID.test(value.trim());
}

/** Ad account identifiers may be persisted with or without the `act_` prefix. */
export function isMetaAdAccountId(value: string | null | undefined): value is string {
  return typeof value === "string" && AD_ACCOUNT_ID.test(value.trim());
}

export function isMetaPageId(value: string | null | undefined): value is string {
  return isMetaObjectId(value);
}

export function normalizeMetaAdAccountId(value: string): string {
  const normalized = value.trim();
  return normalized.toLowerCase().startsWith("act_") ? normalized : `act_${normalized}`;
}
