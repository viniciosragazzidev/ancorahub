"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
 * apenas sobrescreve `period`, fazendo `router.push`. Requer estar num Client
 * Component sob `<Suspense>` (uso de `useSearchParams`), conforme o padrão das
 * páginas / leia o guia de linking/navigating.
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
    <Select
      value={String(value)}
      onValueChange={(val) => {
        if (!val) return;
        if (includeAll && val === "all") {
          select("all");
          return;
        }
        const num = Number.parseInt(val, 10);
        if ((PERIOD_OPTIONS as readonly number[]).includes(num)) {
          select(num as PeriodValue);
        }
      }}
    >
      <SelectTrigger className="w-32 text-xs bg-card" aria-label={label}>
        <SelectValue placeholder="Selecione o período" />
      </SelectTrigger>
      <SelectContent>
        {includeAll ? <SelectItem value="all">Geral</SelectItem> : null}
        {PERIOD_OPTIONS.map((p) => (
          <SelectItem key={p} value={String(p)}>
            {p} dias
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
