import { describe, expect, it } from "vitest";
import { buttonVariants, type ButtonVariants } from "./button-variants";

const classesOf = (size: ButtonVariants["size"]) => buttonVariants({ size }).split(/\s+/);

describe("buttonVariants: área de toque em telas de toque", () => {
  it.each(["icon", "icon-sm", "icon-xs", "xs", "sm"] as const)(
    "o tamanho %s carrega a classe ct-touch",
    (size) => {
      expect(classesOf(size)).toContain("ct-touch");
    },
  );

  it.each(["default", "lg", "icon-lg"] as const)(
    "o tamanho %s não carrega a classe ct-touch (fica como antes)",
    (size) => {
      expect(classesOf(size)).not.toContain("ct-touch");
    },
  );
});
