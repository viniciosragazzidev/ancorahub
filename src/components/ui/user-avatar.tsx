"use client";

import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

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
}

export function UserAvatar({
  seed,
  name,
  style = "lorelei",
  size = "default",
  pixelSize = 128,
  className,
  fallbackClassName,
  photoUrl,
}: UserAvatarProps) {
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
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

  return (
    <Avatar size={size} className={cn("overflow-hidden border border-border/40 shadow-xs", className)}>
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
