import type { ComponentProps } from "react";

type CorreTopLogoProps = Omit<ComponentProps<"img">, "alt" | "src"> & {
  alt?: string;
  src?: string | null;
};

export function CorreTopLogo({ className, alt = "CorreTop", src, ...props }: CorreTopLogoProps) {
  return (
    <img
      src={src ?? "/corretop_logo.svg"}
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
