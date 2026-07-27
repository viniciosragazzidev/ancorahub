"use client";

import { useSyncExternalStore } from "react";

import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  function toggle(next: "light" | "dark") {
    setTheme(next);
  }

  if (!isClient) {
    return (
      <div
        className={cn(
          "flex size-9 items-center justify-center rounded-md border border-border/80 bg-background",
          className,
        )}
      />
    );
  }

  return (
    <AnimatedThemeToggler
      aria-label={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
      aria-pressed={theme === "dark"}
      className={cn(
        "flex size-9 cursor-pointer items-center justify-center rounded-md border border-border/80 bg-background text-foreground shadow-none transition-colors hover:bg-muted",
        className,
      )}
      theme={theme}
      onThemeChange={toggle}
      variant="circle"
    />
  );
}
