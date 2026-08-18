"use client";

import { useEffect, useState } from "react";
import { ArrowsClockwise, Warning } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WARNING_MS = 8_000;
const CRITICAL_MS = 15_000;

type WatchdogState = "ok" | "warning" | "critical";

/**
 * Loading watchdog that prevents infinite loading states.
 *
 * Shows a warning after 8s and an error state after 15s.
 * Wraps children and only activates when `isLoading` is true.
 *
 * Usage:
 * <LoadingWatchdog isLoading={loading}>
 *   <YourContent />
 * </LoadingWatchdog>
 */
export function LoadingWatchdog({
  children,
  isLoading,
  className,
}: {
  children: React.ReactNode;
  isLoading: boolean;
  className?: string;
}) {
  const [state, setState] = useState<WatchdogState>("ok");

  useEffect(() => {
    if (!isLoading) {
      setState("ok");
      return;
    }

    const warningTimer = setTimeout(() => setState("warning"), WARNING_MS);
    const criticalTimer = setTimeout(() => setState("critical"), CRITICAL_MS);

    return () => {
      clearTimeout(warningTimer);
      clearTimeout(criticalTimer);
    };
  }, [isLoading]);

  if (state === "ok") {
    return <>{children}</>;
  }

  if (state === "warning") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-6 text-center",
          className,
        )}
      >
        <Warning className="size-8 text-amber-500" />
        <p className="text-sm font-medium text-amber-700">
          Esta página está demorando mais que o esperado.
        </p>
        <p className="text-xs text-amber-600">
          Aguarde alguns segundos ou tente novamente.
        </p>
      </div>
    );
  }

  // critical state
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center",
        className,
      )}
    >        <Warning className="size-8 text-destructive" />
      <p className="text-sm font-medium text-destructive">
        Não conseguimos carregar esta área.
      </p>
      <p className="text-xs text-muted-foreground">
        Verifique sua conexão e tente novamente.
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.location.reload()}
        className="mt-2 gap-2"
      >
        <ArrowsClockwise className="size-4" />
        Tentar novamente
      </Button>
    </div>
  );
}
