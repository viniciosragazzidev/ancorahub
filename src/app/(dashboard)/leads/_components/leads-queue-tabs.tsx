"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { DragScrollArea } from "@/components/ui/drag-scroll-table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { QueueTab } from "@/features/leads/queue-tabs";

/**
 * Queue tabs of /leads, in the same area and style as the view tabs
 * ("Todos os Leads", "Kanban"…). The choice lives in the URL (?fila=), so
 * the link can be shared.
 */
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
    <Tabs value={current || "__all__"} onValueChange={(value) => select(value === "__all__" ? "" : String(value))} className={pending ? "opacity-70 transition-opacity" : undefined}>
      {/* Many queues: drag sideways with the mouse, as in the tables. */}
      <DragScrollArea>
      <TabsList aria-label="Filtrar por fila" className="w-max justify-start">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value || "__all__"} value={tab.value || "__all__"} className="shrink-0 text-xs gap-1.5">
            <span>{tab.value ? tab.label : "Todas as filas"}</span>
            {tab.count > 0 ? (
              <Badge variant="secondary" className="ml-1 rounded-full px-1.5 py-0 text-[10px]">{tab.count}</Badge>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
      </DragScrollArea>
    </Tabs>
  );
}
