"use client";

import { usePathname } from "next/navigation";

import { useInterfaceMotionEnabled } from "@/components/motion/interface-motion-provider";

export function AnimatedPageTitle({
  breadcrumb,
  title,
  compact = false,
}: {
  breadcrumb: string;
  title: string;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const motionEnabled = useInterfaceMotionEnabled();

  return (
    <div
      className={motionEnabled ? "ct-page-title-enter" : undefined}
      key={`${pathname}:${title}`}
    >
      <p className={compact ? "text-xs text-muted-foreground" : "truncate text-[11px] text-muted-foreground max-[559px]:hidden"}>
        {breadcrumb}
      </p>
      <p className="truncate text-sm font-semibold">{title}</p>
    </div>
  );
}
