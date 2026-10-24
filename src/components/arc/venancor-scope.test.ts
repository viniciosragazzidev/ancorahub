// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { getArcScopeProps } from "./arc-scope-context";

describe("escopo Arc com a chave do diretor desligada", () => {
  it("não acrescenta a classe Arc nem atributos na árvore do CRM", () => {
    const scope = getArcScopeProps(false);
    const crm = document.createElement("main");
    crm.className = ["crm-page", "className" in scope ? scope.className : undefined].filter(Boolean).join(" ");

    expect(crm.className).toBe("crm-page");
    expect(scope).toEqual({});
  });
});
