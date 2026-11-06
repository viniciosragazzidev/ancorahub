// Public route that serves SVG from the CRM's own origin: every value that
// reaches the markup is validated, and the response can never run script.
const ALLOWED_STYLES = new Set([
  "lorelei",
  "lorelei-neutral",
  "initials",
  "avataaars",
  "avataaars-neutral",
  "notionists",
  "notionists-neutral",
  "micah",
  "personas",
  "adventurer",
  "adventurer-neutral",
  "big-smile",
  "thumbs",
  "shapes",
]);
const DEFAULT_SIZE = 128;
export const MAX_AVATAR_SEED_LENGTH = 80;

export const SVG_SECURITY_HEADERS = {
  "Content-Type": "image/svg+xml",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
} as const;

export function parseAvatarSize(raw: string | null) {
  if (!raw || !/^\d{1,3}$/.test(raw)) return DEFAULT_SIZE;
  const size = Number(raw);
  return size >= 16 && size <= 512 ? size : DEFAULT_SIZE;
}

export function parseAvatarStyle(raw: string | null) {
  return raw && ALLOWED_STYLES.has(raw) ? raw : "lorelei";
}

/** Up to two uppercase letters or digits; anything else is dropped. */
export function avatarInitials(seed: string) {
  const initials = seed
    .split(/\s+/)
    .map((word) => word.normalize("NFD").replace(/[^A-Za-z0-9]/g, "").charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return initials || "--";
}

export function buildFallbackAvatarSvg(seed: string, size: number) {
  const initials = avatarInitials(seed);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
        <rect width="100" height="100" rx="50" fill="#16A34A" />
        <text x="50" y="55" font-family="sans-serif" font-size="36" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${initials}</text>
      </svg>`;
}
