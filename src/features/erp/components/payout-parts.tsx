"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { PAYOUT_STATUS_LABELS, type PayoutStatus } from "../shared";

/** AAAA-MM-DD → DD/MM/AAAA; missing dates stay visible as a dash, never as a made-up value. */
export function formatDay(value: string | null) {
  return value ? value.split("-").reverse().join("/") : "—";
}

export function payoutStatusLabel(status: string) {
  return PAYOUT_STATUS_LABELS[status as PayoutStatus] ?? status;
}

export function PayoutStatusBadge({ status }: { status: string }) {
  const variant = status === "settled" ? "success" : status === "cancelled" ? "outline" : "secondary";
  return <Badge variant={variant}>{payoutStatusLabel(status)}</Badge>;
}

/** Label/value pairs of a record summary (drawer or section). */
export function PayoutFacts({ items }: { items: { label: string; value: ReactNode }[] }) {
  return <dl className="grid gap-3 sm:grid-cols-2">
    {items.map((item) => <div key={item.label} className="min-w-0">
      <dt className="text-xs text-muted-foreground">{item.label}</dt>
      <dd className="text-sm font-medium tabular-nums">{item.value}</dd>
    </div>)}
  </dl>;
}

/** Keeps clicks on cell controls (row menu, links) from also opening the row drawer; React events bubble through portals. */
export function StopRowOpen({ children }: { children: ReactNode }) {
  return <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>{children}</div>;
}

/** Drawer state kept in the URL (`?param=value`), so the server loads the record and the link can be shared. */
export function useUrlPanel(param: string) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const set = useCallback((value: string | null) => {
    const query = new URLSearchParams(params.toString());
    if (value === null) query.delete(param);
    else query.set(param, value);
    const search = query.toString();
    router.push(`${pathname}${search ? `?${search}` : ""}`, { scroll: false });
  }, [param, params, pathname, router]);
  return { value: params.get(param), open: (value: string) => set(value), close: () => set(null) };
}
