"use client";

import { useNextStep } from "nextstepjs";
import { useRouter, usePathname } from "next/navigation";
import { HelpCircle, Play, BookOpen, MessageSquare, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function OnboardingHelpButton() {
  const { startNextStep } = useNextStep();
  const router = useRouter();
  const pathname = usePathname();

  const handleStartTour = (tourKey: string, requiredRoute?: string) => {
    if (requiredRoute && pathname !== requiredRoute && !pathname.startsWith(requiredRoute)) {
      router.push(requiredRoute);
      return;
    }
    startNextStep(tourKey);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <HelpCircle className="size-3.5 text-primary" />
            <span className="hidden sm:inline font-medium">Ajuda & Tours</span>
          </Button>
        }
      />

      <DropdownMenuContent align="start" side="bottom" className="w-56 border-border/80 bg-card p-1.5 shadow-xl">
        <DropdownMenuLabel className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Central de Aprendizado
        </DropdownMenuLabel>

        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => handleStartTour("broker-welcome", "/dashboard")}
            className="flex items-center justify-between text-xs font-medium"
          >
            <div className="flex items-center gap-2">
              <Play className="size-3.5 text-primary" />
              <span>Tour da Fila & Dashboard</span>
            </div>
            <ChevronRight className="size-3 text-muted-foreground" />
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => handleStartTour("broker-lead-profile", "/leads")}
            className="flex items-center justify-between text-xs font-medium"
          >
            <div className="flex items-center gap-2">
              <BookOpen className="size-3.5 text-sky-500" />
              <span>Como atender um lead</span>
            </div>
            <ChevronRight className="size-3 text-muted-foreground" />
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => window.open("/guia", "_blank")}
            className="flex items-center gap-2 text-xs"
          >
            <BookOpen className="size-3.5 text-muted-foreground" />
            <span>Guia completo do CRM</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => window.open("https://wa.me/5511999999999", "_blank")}
            className="flex items-center gap-2 text-xs"
          >
            <MessageSquare className="size-3.5 text-emerald-500" />
            <span>Suporte no WhatsApp</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
