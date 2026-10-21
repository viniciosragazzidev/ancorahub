/**
 * A/B of the first contact (plan §5, pilar D). Each lead gets a stable variant
 * (hash of lead + experiment), so a retry never changes the message. Once every
 * variant has enough sends, the sampling favours the one with more replies
 * (Thompson sampling on "replied") while 10% of leads keep exploring evenly.
 */
export type VariantStats = { variant: string; sent: number; replied: number };

/** Sends per variant before the system starts favouring the best one. */
export const MIN_SENDS_BEFORE_LEARNING = 50;
/** Share of leads always split evenly, so a late winner can still show up. */
export const EXPLORATION_SHARE = 0.1;

/** FNV-1a 32-bit: stable across runs and processes. */
export function stableHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Deterministic pseudo-random generator seeded by a string (mulberry32). */
export function seededRandom(seed: string) {
  let state = stableHash(seed) || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gammaSample(shape: number, random: () => number): number {
  // Marsaglia-Tsang; shape >= 1 here (alpha/beta start at 1).
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      // Box-Muller normal
      const u1 = Math.max(random(), Number.EPSILON);
      const u2 = random();
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = random();
    if (u < 1 - 0.0331 * x ** 4) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function betaSample(alpha: number, beta: number, random: () => number) {
  const x = gammaSample(alpha, random);
  const y = gammaSample(beta, random);
  return x / (x + y);
}

/**
 * Picks the variant for a lead. Without stats (or before the minimum sample)
 * it is an even, stable split; after it, Thompson sampling seeded by the lead.
 */
export function assignVariant(input: {
  leadId: string;
  experiment: string;
  variants: readonly string[];
  stats?: readonly VariantStats[];
  learn?: boolean;
}): string | null {
  const variants = [...input.variants];
  if (!variants.length) return null;
  if (variants.length === 1) return variants[0];
  const seed = `${input.experiment}:${input.leadId}`;
  const random = seededRandom(seed);
  const even = () => variants[stableHash(seed) % variants.length];

  const byVariant = new Map((input.stats ?? []).map((row) => [row.variant, row]));
  const ready = input.learn !== false && variants.every((variant) => (byVariant.get(variant)?.sent ?? 0) >= MIN_SENDS_BEFORE_LEARNING);
  if (!ready || random() < EXPLORATION_SHARE) return even();

  let best = variants[0];
  let bestDraw = -1;
  for (const variant of variants) {
    const row = byVariant.get(variant);
    const replied = Math.min(row?.replied ?? 0, row?.sent ?? 0);
    const draw = betaSample(1 + replied, 1 + (row?.sent ?? 0) - replied, random);
    if (draw > bestDraw) {
      bestDraw = draw;
      best = variant;
    }
  }
  return best;
}

/** Reply rate with a 95% Wilson interval, for the director's comparison. */
export function replyRate(sent: number, replied: number) {
  if (!sent) return { rate: 0, low: 0, high: 0 };
  const z = 1.96;
  const p = replied / sent;
  const denominator = 1 + (z * z) / sent;
  const center = (p + (z * z) / (2 * sent)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p)) / sent + (z * z) / (4 * sent * sent))) / denominator;
  return { rate: p, low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}
