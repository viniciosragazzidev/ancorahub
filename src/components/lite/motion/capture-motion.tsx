import { createElement, forwardRef, type ElementType, type ReactNode } from "react";

/**
 * Só para testes: troca `motion.*` por elementos comuns que guardam as props de movimento em
 * `data-*`, para o teste conferir o que o componente pede ao motion (deslocamento, escala, duração).
 * Importado dentro de `vi.mock("motion/react")` nos arquivos *.test.tsx.
 */

type CapturedProps = Record<string, unknown> & { children?: ReactNode };

const serialize = (value: unknown) => (value === undefined ? undefined : JSON.stringify(value));

function sanitizeStyle(style: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(style).map(([key, value]) => [key, typeof value === "object" && value !== null && "get" in value ? "motion-value" : value]),
  );
}

export function captureMotion() {
  return new Proxy({} as Record<string, ElementType>, {
    get(_target, tag) {
      if (typeof tag !== "string") return undefined;
      return forwardRef<HTMLElement, CapturedProps>(function CapturedMotion(props, ref) {
        // Estas props são tiradas de propósito: o DOM não as aceita.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { initial, animate, exit, transition, whileTap, whileInView, viewport, layout, layoutId, variants, style, ...rest } = props;
        return createElement(tag, {
          ...rest,
          ref,
          style: style ? sanitizeStyle(style as Record<string, unknown>) : undefined,
          "data-initial": serialize(initial),
          "data-animate": serialize(animate),
          "data-exit": serialize(exit),
          "data-transition": serialize(transition),
          "data-while-tap": serialize(whileTap),
          "data-while-in-view": serialize(whileInView),
        });
      });
    },
  });
}

/** Lê as props capturadas de um elemento renderizado com `captureMotion`. */
export function readMotion(element: Element) {
  const read = (name: string) => {
    const raw = (element as HTMLElement).dataset[name];
    return raw === undefined ? undefined : (JSON.parse(raw) as Record<string, unknown>);
  };
  return {
    initial: read("initial"),
    animate: read("animate"),
    exit: read("exit"),
    transition: read("transition"),
    whileTap: read("whileTap"),
    whileInView: read("whileInView"),
  };
}

/** Propriedades de deslocamento e escala que o movimento reduzido não pode ter. */
export const MOVEMENT_KEYS = ["x", "y", "scale", "translateX", "translateY", "rotate"] as const;

/** Deslocamentos presentes num conjunto de props: nada de y, x, escala ou rotação diferentes do repouso. */
export function displacementOf(props: Record<string, unknown> | undefined) {
  return Object.entries(props ?? {}).filter(([key, value]) => {
    if (!(MOVEMENT_KEYS as readonly string[]).includes(key)) return false;
    if (key === "scale") return value !== 1;
    return value !== 0;
  });
}
