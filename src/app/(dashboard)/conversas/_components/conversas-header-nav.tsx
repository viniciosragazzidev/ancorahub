"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ConversasHeaderNavProps {
  currentTab: "leads" | "corretores";
  leadsCount?: number;
}

export function ConversasHeaderNav({
  currentTab,
  leadsCount,
}: ConversasHeaderNavProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticTab, setOptimisticTab] = useState<"leads" | "corretores">(currentTab);

  useEffect(() => {
    setOptimisticTab(currentTab);
  }, [currentTab]);

  useEffect(() => {
    router.prefetch("/conversas");
    router.prefetch("/conversas?tab=corretores");
  }, [router]);

  const handleSelect = (tab: "leads" | "corretores") => {
    if (tab === currentTab) return;
    setOptimisticTab(tab);
    startTransition(() => {
      const target = tab === "corretores" ? "/conversas?tab=corretores" : "/conversas";
      router.push(target, { scroll: false });
    });
  };

  const isLeadsActive = optimisticTab === "leads";
  const isBrokersActive = optimisticTab === "corretores";

  return (
    <div className="flex items-center rounded-lg border border-border/80 bg-muted/50 p-1 backdrop-blur-sm shadow-xs">
      <button
        type="button"
        onClick={() => handleSelect("leads")}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 active:scale-98",
          isLeadsActive
            ? "bg-background text-foreground shadow-xs font-semibold"
            : "text-muted-foreground hover:text-foreground hover:bg-background/40",
        )}
      >
        {isPending && isLeadsActive && currentTab !== "leads" && (
          <CircleNotch className="size-3.5 animate-spin text-primary" />
        )}
        <span>Leads</span>
        {typeof leadsCount === "number" && (
          <Badge variant="outline" className="ml-0.5 text-[10px] px-1.5 py-0">
            {leadsCount}
          </Badge>
        )}
      </button>

      <button
        type="button"
        onClick={() => handleSelect("corretores")}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 active:scale-98",
          isBrokersActive
            ? "bg-background text-foreground shadow-xs font-semibold"
            : "text-muted-foreground hover:text-foreground hover:bg-background/40",
        )}
      >
        {isPending && isBrokersActive && currentTab !== "corretores" && (
          <CircleNotch className="size-3.5 animate-spin text-primary" />
        )}
        <span>Número oficial <span className="hidden lg:inline">· corretores</span></span>
      </button>
    </div>
  );
}
