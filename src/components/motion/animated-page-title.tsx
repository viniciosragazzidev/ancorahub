"use client";

import { usePathname } from "next/navigation";

import { useInterfaceMotionEnabled } from "@/components/motion/interface-motion-provider";

export function AnimatedPageTitle({
  breadcrumb,
  title,
  compact = false,
  tone = "default",
}: {
  breadcrumb: string;
  title: string;
  compact?: boolean;
  tone?: "default" | "inverse";
}) {
  const pathname = usePathname();
  const motionEnabled = useInterfaceMotionEnabled();

  return (
    <div
      className={motionEnabled ? "ct-page-title-enter" : undefined}
      key={`${pathname}:${title}`}
    >
      <p className={compact ? `text-xs ${tone === "inverse" ? "text-sidebar-foreground/50" : "text-muted-foreground"}` : `truncate text-xs ${tone === "inverse" ? "text-sidebar-foreground/50" : "text-muted-foreground"} max-[559px]:hidden`}>
        {breadcrumb}
      </p>
      <p className={`truncate text-sm font-medium tracking-tight ${tone === "inverse" ? "text-sidebar-foreground" : "text-foreground"}`}>{title}</p>
    </div>
  );
}
