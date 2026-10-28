"use client";

import Image from "next/image";
import { createContext, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const IllustrationsEnabled = createContext(false);

export function ContextualIllustrationsProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return <IllustrationsEnabled.Provider value={enabled}>{children}</IllustrationsEnabled.Provider>;
}

const assets = {
  guidance: "/illustrations/ancora/guidance.webp",
  checklist: "/illustrations/ancora/checklist.webp",
  calendar: "/illustrations/ancora/calendar.webp",
  conversation: "/illustrations/ancora/conversation.webp",
  connections: "/illustrations/ancora/connections.webp",
  documents: "/illustrations/ancora/documents.webp",
  comparison: "/illustrations/ancora/comparison.webp",
} as const;

export type ContextualIllustrationName = keyof typeof assets;
const sizes = { sm: "size-12", md: "size-16", lg: "size-20" } as const;

/** Decorative support: the adjacent text remains the source of meaning and state. */
export function ContextualIllustration({ name, size = "md", fallback = null, className }: {
  name: ContextualIllustrationName;
  size?: keyof typeof sizes;
  fallback?: ReactNode;
  className?: string;
}) {
  const enabled = useContext(IllustrationsEnabled);
  const [failed, setFailed] = useState(false);
  if (!enabled || failed) return fallback;
  return (
    <Image
      src={assets[name]}
      alt=""
      aria-hidden="true"
      width={256}
      height={256}
      unoptimized
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn("pointer-events-none block shrink-0 select-none object-contain", sizes[size], className)}
    />
  );
}
