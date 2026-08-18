"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkle, SlidersHorizontal, Check } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { setExperienceModeAction, type ExperienceMode } from "@/features/broker-workspace/experience-mode";
import { cn } from "@/lib/utils";

type ExperienceModeToggleProps = {
  initialMode?: ExperienceMode;
  variant?: "switch" | "badge" | "menu-item" | "pill";
  className?: string;
};

export function ExperienceModeToggle({
  initialMode = "LIGHT",
  variant = "switch",
  className,
}: ExperienceModeToggleProps) {
  const [mode, setMode] = useState<ExperienceMode>(initialMode);
  const [pending, startTransition] = useTransition();

  function handleToggle(targetMode?: ExperienceMode) {
    if (pending) return;
    const nextMode: ExperienceMode = targetMode ?? (mode === "LIGHT" ? "NORMAL" : "LIGHT");

    startTransition(async () => {
      const res = await setExperienceModeAction(nextMode);
      if (res.success) {
        setMode(nextMode);
        if (nextMode === "LIGHT") {
          toast.success("Modo Light ativado", {
            description: "Interface simplificada para seus atendimentos.",
          });
        } else {
          toast.info("Modo Normal ativado", {
            description: "Você agora tem acesso à navegação completa disponível para seu perfil.",
          });
        }
        window.location.reload();
      } else {
        toast.error(res.error ?? "Não foi possível alterar o modo de uso.");
      }
    });
  }

  if (variant === "pill") {
    const isLight = mode === "LIGHT";
    return (
      <button
        type="button"
        onClick={() => handleToggle()}
        disabled={pending}
        aria-label={`Alternar modo de uso (atual: ${isLight ? "Light" : "Normal"})`}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all shadow-xs border",
          isLight
            ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
            : "border-border/80 bg-muted/60 text-muted-foreground hover:bg-muted",
          pending && "opacity-60 cursor-not-allowed",
          className
        )}
      >
        <Sparkle className={cn("size-3.5", isLight && "animate-pulse")} />
        <span>Modo Light</span>
        <span
          className={cn(
            "ml-1 inline-block size-2 rounded-full",
            isLight ? "bg-primary" : "bg-muted-foreground/40"
          )}
        />
      </button>
    );
  }

  if (variant === "badge") {
    const isLight = mode === "LIGHT";
    return (
      <Badge
        variant={isLight ? "outline" : "secondary"}
        className={cn(
          "cursor-pointer select-none gap-1.5 transition-colors text-xs font-semibold px-2.5 py-1",
          isLight
            ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
            : "border-border/60 bg-muted text-muted-foreground hover:bg-muted/80",
          className
        )}
        onClick={() => handleToggle()}
      >
        <Sparkle className="size-3.5" />
        <span>{isLight ? "Modo Light" : "Modo Normal"}</span>
      </Badge>
    );
  }

  if (variant === "menu-item") {
    const isLight = mode === "LIGHT";
    return (
      <button
        type="button"
        onClick={() => handleToggle()}
        disabled={pending}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/60",
          pending && "opacity-60 cursor-not-allowed",
          className
        )}
      >
        <div className="flex items-center gap-2">
          <Sparkle className={cn("size-4", isLight ? "text-primary" : "text-muted-foreground")} />
          <span>Modo de uso</span>
        </div>
        <Badge
          variant={isLight ? "outline" : "secondary"}
          className={cn(
            "text-[10px] font-semibold px-1.5 py-0.5",
            isLight ? "border-primary/30 bg-primary/10 text-primary" : "text-muted-foreground"
          )}
        >
          {isLight ? "Light" : "Normal"}
        </Badge>
      </button>
    );
  }

  // Default: switch button
  const isLight = mode === "LIGHT";
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => handleToggle()}
      disabled={pending}
      className={cn(
        "h-8 gap-1.5 text-xs font-semibold transition-colors",
        isLight && "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10",
        className
      )}
    >
      <Sparkle className="size-3.5 text-primary" />
      <span>Modo Light</span>
      <span
        className={cn(
          "ml-1 flex h-4 w-7 items-center rounded-full p-0.5 transition-colors",
          isLight ? "bg-primary justify-end" : "bg-muted-foreground/30 justify-start"
        )}
      >
        <span className="size-3 rounded-full bg-background shadow-xs" />
      </span>
    </Button>
  );
}
