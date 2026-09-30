"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { DsSegmentedControl } from "@/components/ui/ds-segmented-control";
import type { QueueTab } from "@/features/leads/queue-tabs";

/** Tabs that filter /leads by queue; the choice lives in the URL (?fila=), so the link can be shared. */
export function LeadsQueueTabs({ tabs, current }: { tabs: QueueTab[]; current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  if (tabs.length <= 2) return null;
  const select = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("fila", value);
    else params.delete("fila");
    params.delete("page");
    startTransition(() => router.push(params.size ? `${pathname}?${params}` : pathname, { scroll: false }));
  };
  return (
    <div className={pending ? "opacity-70 transition-opacity" : undefined}>
      <DsSegmentedControl<string>
        aria-label="Filtrar por fila"
        value={current}
        onValueChange={select}
        options={tabs.map((tab) => ({ value: tab.value, label: `${tab.label} (${tab.count})` }))}
        className="max-w-full overflow-x-auto"
      />
    </div>
  );
}
