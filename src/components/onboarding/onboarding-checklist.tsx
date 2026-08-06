"use client";

import { useState } from "react";
import { useNextStep } from "nextstepjs";
import { useRouter, usePathname } from "next/navigation";
import { CheckCircle2, Circle, Sparkles, X, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ChecklistItem = {
  id: string;
  label: string;
  tourKey?: string;
  targetRoute?: string;
  completed: boolean;
};

export function OnboardingChecklist() {
  const { startNextStep } = useNextStep();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const [items, setItems] = useState<ChecklistItem[]>([
    { id: "1", label: "Complete seu perfil", completed: true },
    { id: "2", label: "Conheça sua fila de leads", tourKey: "broker-welcome", targetRoute: "/dashboard", completed: false },
    { id: "3", label: "Abra seu primeiro atendimento", tourKey: "broker-lead-profile", targetRoute: "/leads", completed: false },
    { id: "4", label: "Conheça sua agenda do dia", tourKey: "broker-welcome", targetRoute: "/dashboard", completed: false },
  ]);

  if (dismissed) return null;

  const completedCount = items.filter((i) => i.completed).length;
  const progressPercent = Math.round((completedCount / items.length) * 100);

  if (progressPercent === 100) return null;

  const toggleItem = (id: string, tourKey?: string, targetRoute?: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item)),
    );
    if (tourKey) {
      if (targetRoute && pathname !== targetRoute && !pathname.startsWith(targetRoute)) {
        router.push(targetRoute);
      } else {
        startNextStep(tourKey);
      }
    }
  };

  return (
    <Card variant="subtle" className="relative h-full overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <CardTitle className="text-sm font-semibold tracking-tight">Comece por aqui</CardTitle>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="size-7 rounded-md text-muted-foreground hover:text-foreground"
          >
            {collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDismissed(true)}
            className="size-7 rounded-md text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>
            {completedCount} de {items.length} concluídos
          </span>
          <span className="text-primary font-semibold">{progressPercent}%</span>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {!collapsed && (
          <div className="mt-3 space-y-1.5 pt-1">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleItem(item.id, item.tourKey, item.targetRoute)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors duration-150",
                  item.completed
                    ? "text-muted-foreground/70 line-through hover:bg-muted/30"
                    : "text-foreground font-medium hover:bg-muted/50",
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {item.completed ? (
                    <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                  ) : (
                    <Circle className="size-3.5 shrink-0 text-muted-foreground/60" />
                  )}
                  <span className="truncate">{item.label}</span>
                </div>
                {item.tourKey && !item.completed && (
                  <span className="shrink-0 text-[10px] text-primary hover:underline font-mono">
                    Ver tour →
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
