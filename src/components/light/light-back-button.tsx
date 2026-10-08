"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

import { canGoBackInApp } from "./light-navigation";

/**
 * Goes back in history when the previous entry is inside the app, otherwise to
 * the parent route. A deep link (push notification, shared URL) therefore never
 * "goes back" out of the app.
 */
export function LightBackButton({ fallbackHref, alwaysParent = false, className }: { fallbackHref: string; alwaysParent?: boolean; className?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      aria-label="Voltar"
      onClick={() => {
        if (!alwaysParent && canGoBackInApp()) router.back();
        else router.push(fallbackHref);
      }}
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-full bg-(--surface) text-(--foreground) shadow-(--shadow-resting) transition-transform active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100",
        className,
      )}
    >
      <ArrowLeft className="size-5" aria-hidden="true" />
    </button>
  );
}
