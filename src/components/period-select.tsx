"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  DEFAULT_PERIOD,
  PERIOD_OPTIONS,
  type PeriodValue,
} from "@/shared/period";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/**
 * Seletor de período 7/14/30/90 persistido em `?period=N`.
 *
 * Espelha o comportamento do LeadsFilters: preserva os demais query params e
 * apenas sobrescreve `period`, fazendo `router.push`. Requer estar num Client
 * Component sob `<Suspense>` (uso de `useSearchParams`), conforme o padrão das
 * páginas / leia o guia de linking/navigating.
 *
 * O ToggleGroup do Base UI usa `value` como array mesmo em single-select.
 */
export function PeriodSelect({
  value,
  includeAll = false,
  label = "Período",
}: {
  value: PeriodValue | "all";
  includeAll?: boolean;
  label?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function select(period: PeriodValue | "all") {
    const params = new URLSearchParams(searchParams.toString());
    if (period === "all" || period === DEFAULT_PERIOD) {
      params.delete("period");
    } else {
      params.set("period", String(period));
    }
    if (pathname) router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <ToggleGroup
      size="sm"
      aria-label={label}
      value={[String(value)] as readonly string[]}
      onValueChange={(groupValue) => {
        const next = groupValue?.[0];
        if (!next) return;
        if (includeAll && next === "all") {
          select("all");
          return;
        }
        const num = Number.parseInt(next, 10);
        if ((PERIOD_OPTIONS as readonly number[]).includes(num)) {
          select(num as PeriodValue);
        }
      }}
    >
      {includeAll ? <ToggleGroupItem value="all">Geral</ToggleGroupItem> : null}
      {PERIOD_OPTIONS.map((p) => (
        <ToggleGroupItem key={p} value={String(p)}>
          {p}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
