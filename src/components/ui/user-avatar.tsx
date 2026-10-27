"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Avatar as ArcAvatar } from "@/components/arc/avatar/avatar";
import { useArcScopeEnabled } from "@/components/arc/arc-scope-context";

export type DiceBearStyle =
  | "lorelei"
  | "initials"
  | "bottts"
  | "thumbs"
  | "avataaars"
  | "shapes";

export interface UserAvatarProps {
  seed: string;
  name?: string;
  style?: DiceBearStyle;
  size?: "sm" | "default" | "lg";
  pixelSize?: number;
  className?: string;
  fallbackClassName?: string;
  /** A real photo (e.g. the contact's WhatsApp picture); the illustration stays when it does not load. */
  photoUrl?: string | null;
  /**
   * Asks for the photo only once the avatar is near the screen. A long list
   * would otherwise ask for every photo at once (the image loads in script,
   * so the browser's lazy loading does not apply).
   */
  photoWhenVisible?: boolean;
}

export function UserAvatar({
  seed,
  name,
  style = "lorelei",
  size = "default",
  pixelSize = 128,
  className,
  fallbackClassName,
  photoUrl: requestedPhoto,
  photoWhenVisible = false,
}: UserAvatarProps) {
  const directorLite = useArcScopeEnabled();
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const [nearScreen, setNearScreen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const waitsForScreen = photoWhenVisible && Boolean(requestedPhoto) && !nearScreen;
  useEffect(() => {
    const node = rootRef.current;
    if (!waitsForScreen || !node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setNearScreen(true);
      observer.disconnect();
    }, { rootMargin: "200px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [waitsForScreen]);
  const photoUrl = waitsForScreen ? null : requestedPhoto;
  const avatarUrl = useMemo(() => {
    const cleanSeed = encodeURIComponent(seed || name || "CorreTop");
    return `https://api.dicebear.com/9.x/${style}/svg?seed=${cleanSeed}&size=${pixelSize}`;
  }, [seed, name, style, pixelSize]);

  const initials = useMemo(() => {
    const sourceName = name || seed || "CT";
    return sourceName
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [name, seed]);

  if (directorLite) {
    const arcSize = size === "sm" ? "sm" : size === "lg" ? "lg" : "md";
    return (
      <ArcAvatar
        name={name || seed || "Cliente"}
        // A real <img loading="lazy">: the browser already waits for it to near the screen.
        src={requestedPhoto ?? undefined}
        size={arcSize}
        className={className}
      />
    );
  }

  return (
    <Avatar ref={rootRef} size={size} className={cn("overflow-hidden border border-border/40 shadow-xs", className)}>
      <AvatarImage
        key={photoUrl && failedPhoto !== photoUrl ? photoUrl : avatarUrl}
        src={photoUrl && failedPhoto !== photoUrl ? photoUrl : avatarUrl}
        onLoadingStatusChange={(status) => {
          if (status === "error" && photoUrl && failedPhoto !== photoUrl) setFailedPhoto(photoUrl);
        }}
        alt={name || seed || "Avatar"}
        loading="lazy"
        className="size-full object-cover"
      />
      <AvatarFallback
        className={cn(
          "flex size-full items-center justify-center bg-primary/10 text-xs font-semibold text-primary",
          fallbackClassName
        )}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
