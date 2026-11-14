// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TipoMascara } from "./mascara";
import { useCampoMascarado } from "./use-campo-mascarado";

afterEach(cleanup);

function Campo({ tipo, aoMudar }: { tipo: TipoMascara; aoMudar?: (valor: string) => void }) {
  const [valor, setValor] = useState("");
  const props = useCampoMascarado(tipo, valor, (novo) => { setValor(novo); aoMudar?.(novo); });
  return <input aria-label="campo" {...props} />;
}

describe("useCampoMascarado", () => {
  it("colar telefone bagunçado mostra formatado e entrega o formatado", () => {
    const aoMudar = vi.fn();
    render(<Campo tipo="telefone" aoMudar={aoMudar} />);
    const campo = screen.getByLabelText("campo") as HTMLInputElement;
    fireEvent.change(campo, { target: { value: "+55 21 99999-1234" } });
    expect(campo.value).toBe("+55 (21) 99999-1234");
    expect(aoMudar).toHaveBeenLastCalledWith("+55 (21) 99999-1234");
  });

  it("põe o teclado certo no celular", () => {
    render(<Campo tipo="valor" />);
    expect(screen.getByLabelText("campo").getAttribute("inputmode")).toBe("decimal");
  });

  it("mantém o cursor no lugar ao editar no meio (campo em foco)", () => {
    render(<Campo tipo="cpf" />);
    const campo = screen.getByLabelText("campo") as HTMLInputElement;
    campo.focus();
    fireEvent.change(campo, { target: { value: "529982247" } });
    expect(campo.value).toBe("529.982.247");
    // Digita "1" depois do "9" do segundo bloco.
    // Setter nativo: simula o navegador (o React só percebe a mudança no evento).
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(campo, "529.9182.247");
    campo.setSelectionRange(6, 6);
    fireEvent.change(campo);
    expect(campo.value).toBe("529.918.224-7");
    expect(campo.selectionStart).toBe(6);
  });
});
