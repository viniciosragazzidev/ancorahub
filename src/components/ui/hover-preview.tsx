"use client";

import * as React from "react";
import { PreviewCard } from "@base-ui/react/preview-card";

import { cn } from "@/lib/utils";
import { useArcScopeProps } from "@/components/arc/arc-scope-context";
import { useMediaQuery } from "@/hooks/use-media-query";

/**
 * Hover preview — prévia flutuante ao passar o mouse (skill `interface-enxuta`).
 *
 * - Só existe em dispositivo com mouse fino (`(hover: hover) and (pointer: fine)`).
 *   No toque, o gatilho é devolvido sem mudança e mantém o comportamento antigo.
 * - Abre no hover (após `delay`) e no foco do teclado; `Esc` fecha.
 * - Superfície: popover branco, 1px Ash, raio de card (12px), `--shadow-ds-md`.
 * - Movimento: fade + 4px em 160ms; com `prefers-reduced-motion`, só fade de 120ms.
 */

export const HOVER_PREVIEW_QUERY = "(hover: hover) and (pointer: fine)";

/** `true` quando o dispositivo tem mouse (hover real). No servidor, `false`. */
export function useCanHover(): boolean {
  return useMediaQuery(HOVER_PREVIEW_QUERY);
}

export const HOVER_PREVIEW_DELAY_MS = 350;
export const HOVER_PREVIEW_CLOSE_DELAY_MS = 150;

export interface HoverPreviewProps {
  /** Elemento que dispara a prévia (normalmente o nome da entidade). Deve aceitar foco. */
  trigger: React.ReactElement;
  /** Conteúdo da prévia. Só é montado quando ela abre. */
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  delay?: number;
  closeDelay?: number;
  sideOffset?: number;
  className?: string;
  /** Força o modo sem prévia (ex.: telas Lite). */
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function HoverPreview({
  trigger,
  children,
  side = "bottom",
  align = "start",
  delay = HOVER_PREVIEW_DELAY_MS,
  closeDelay = HOVER_PREVIEW_CLOSE_DELAY_MS,
  sideOffset = 8,
  className,
  disabled = false,
  onOpenChange,
}: HoverPreviewProps) {
  const canHover = useCanHover();
  const arcScope = useArcScopeProps();

  if (disabled || !canHover) return trigger;

  return (
    <PreviewCard.Root onOpenChange={(open) => onOpenChange?.(open)}>
      <PreviewCard.Trigger
        data-slot="hover-preview-trigger"
        render={trigger}
        delay={delay}
        closeDelay={closeDelay}
      />
      <PreviewCard.Portal>
        <PreviewCard.Positioner
          side={side}
          align={align}
          sideOffset={sideOffset}
          collisionPadding={8}
          data-skin={arcScope["data-skin"]}
          className={cn("isolate z-50 outline-none", arcScope.className)}
        >
          <PreviewCard.Popup
            data-slot="hover-preview"
            className={cn(
              "w-80 max-w-[calc(100vw-1rem)] origin-(--transform-origin) overflow-hidden rounded-ds-cards border border-ds-ash bg-ds-canvas-white font-ds-inter text-ds-body text-ds-charcoal shadow-ds-md outline-none",
              "transition-[opacity,translate] duration-[160ms] ease-out data-starting-style:translate-y-1 data-starting-style:opacity-0 data-ending-style:opacity-0",
              "motion-reduce:duration-[120ms] motion-reduce:data-starting-style:translate-y-0",
              arcScope.className,
              className,
            )}
          >
            {children}
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  );
}
