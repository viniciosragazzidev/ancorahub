"use client";

/**
 * Compatibility component: operational metrics always show their actual value.
 * DEC-034 excludes data refreshes from interface motion; no interpolated totals.
 */
export function DsCountUp({ value, className }: { value: number; className?: string }) {
  return (
    <span className={className}>
      <span className="tabular-nums">{value}</span>
    </span>
  );
}
