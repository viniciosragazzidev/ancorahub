import type { ComponentPropsWithoutRef, ElementType } from "react";

import styles from "./brand-surface.module.css";

type BrandSurfaceProps<T extends ElementType> = {
  /** Elemento de raiz (padrão `section`). */
  as?: T;
  /** Sem o pontilhado, só o azul de marca. */
  flat?: boolean;
} & Omit<ComponentPropsWithoutRef<T>, "as">;

/**
 * Fundo de marca para landing, login e onboarding (docs/design-system.md, "Exceção: superfícies de marca").
 * Nunca em tela interna do produto. O conteúdo decide padding e layout; aqui só o fundo, a textura e o raio.
 */
export function BrandSurface<T extends ElementType = "section">({ as, flat = false, className, ...props }: BrandSurfaceProps<T>) {
  const Root = (as ?? "section") as ElementType;
  return <Root data-slot="brand-surface" className={[styles.surface, flat ? styles.flat : "", className].filter(Boolean).join(" ")} {...props} />;
}
