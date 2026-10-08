"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import {
  DEFAULT_PERIOD,
  PERIOD_OPTIONS,
  type PeriodValue,
} from "@/shared/period";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Seletor de período 7/14/30/90 persistido em `?period=N`.
 *
 * Espelha o comportamento do LeadsFilters: preserva os demais query params e
 * apenas sobrescreve `period`, fazendo `router.replace`. Requer estar num Client
 * Component sob `<Suspense>` (uso de `useSearchParams`), conforme o padrão das
 * páginas / leia o guia de linking/navigating.
 */
export function PeriodSelect({
  value,
  includeAll = false,
  includeToday = false,
  includeThreeDays = false,
  label = "Período",
  triggerClassName,
}: {
  value: PeriodValue | 3 | "all" | "today";
  includeAll?: boolean;
  /** "Hoje" option (`?period=today`) — the lead quality center's 18h-to-18h day. */
  includeToday?: boolean;
  /** Add the lead quality center's three-day window (`?period=3`). */
  includeThreeDays?: boolean;
  label?: string;
  /** Additive visual override — leave unset for the existing default look. */
  triggerClassName?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function select(period: PeriodValue | 3 | "all" | "today") {
    const params = new URLSearchParams(searchParams.toString());
    if (period === "all" || period === DEFAULT_PERIOD) {
      params.delete("period");
    } else {
      params.set("period", String(period));
    }
    if (pathname) startTransition(() => router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false }));
  }

  return (
    <Select
      value={String(value)}
      onValueChange={(val) => {
        if (!val) return;
        if (includeAll && val === "all") {
          select("all");
          return;
        }
        if (includeToday && val === "today") {
          select("today");
          return;
        }
        const num = Number.parseInt(val, 10);
        if (includeThreeDays && val === "3") {
          select(3);
          return;
        }
        if ((PERIOD_OPTIONS as readonly number[]).includes(num)) {
          select(num as PeriodValue);
        }
      }}
    >
      <SelectTrigger
        className={triggerClassName ?? "w-32 bg-card text-xs max-[559px]:h-(--mobile-touch-target)"}
        aria-label={label}
        disabled={isPending}
      >
        <SelectValue placeholder="Selecione o período" />
      </SelectTrigger>
      <SelectContent>
        {includeAll ? <SelectItem value="all">Geral</SelectItem> : null}
        {includeToday ? <SelectItem value="today">Hoje</SelectItem> : null}
        {includeThreeDays ? <SelectItem value="3">3 dias</SelectItem> : null}
        {PERIOD_OPTIONS.map((p) => (
          <SelectItem key={p} value={String(p)}>
            {p} dias
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
