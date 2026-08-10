import type { ComponentProps } from "react";

type AncoraLogoProps = Omit<ComponentProps<"img">, "alt" | "src"> & {
  alt?: string;
  src?: string | null;
};

export function AncoraLogo({ className, alt = "AncoraHub — Âncora Saúde", src, ...props }: AncoraLogoProps) {
  return (
    <img
      src={src ?? "/logo.webp"}
      alt={alt}
      className={[
        className,
        "dark:[filter:brightness(0)_invert(1)]",
        "transition-[filter] duration-[var(--duration-quick)]",
      ].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
