"use client";

import { useCallback, useLayoutEffect, useRef, type ChangeEvent } from "react";

import { aplicarMascara, MODO_TECLADO, type TipoMascara } from "./mascara";

/**
 * Props prontas para um `<input>` controlado com máscara. Espalhe no campo:
 *
 * ```tsx
 * const telefone = useCampoMascarado("telefone", draft.telefone, (valor) => update("telefone", valor));
 * <Input label="Telefone" type="tel" {...telefone} />
 * ```
 *
 * O valor entregue é o formatado (ex.: "(21) 99999-9999"); quem salva continua normalizando no servidor como antes.
 */
export function useCampoMascarado(tipo: TipoMascara, value: string, onValueChange: (valor: string) => void) {
  const ref = useRef<HTMLInputElement>(null);
  const cursorPendente = useRef<number | null>(null);

  // Depois do render, se o React reescreveu o campo, devolve o cursor ao lugar calculado.
  useLayoutEffect(() => {
    const campo = ref.current;
    const cursor = cursorPendente.current;
    cursorPendente.current = null;
    if (!campo || cursor === null || campo.ownerDocument.activeElement !== campo) return;
    if (campo.selectionStart !== cursor) campo.setSelectionRange(cursor, cursor);
  });

  const onChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const campo = event.currentTarget;
    const tipoEntrada = (event.nativeEvent as InputEvent | undefined)?.inputType;
    const resultado = aplicarMascara(tipo, {
      valor: campo.value,
      cursor: campo.selectionStart ?? campo.value.length,
      anterior: value,
      tipoEntrada,
    });
    // Escreve já no DOM: se o valor formatado for igual ao anterior (tecla recusada), o React não re-renderiza
    // e o cursor ainda assim fica no lugar.
    if (campo.value !== resultado.valor) campo.value = resultado.valor;
    if (campo.ownerDocument.activeElement === campo) {
      try { campo.setSelectionRange(resultado.cursor, resultado.cursor); } catch { /* tipo de campo sem seleção */ }
    }
    cursorPendente.current = resultado.cursor;
    onValueChange(resultado.valor);
  }, [onValueChange, tipo, value]);

  return { ref, value, onChange, inputMode: MODO_TECLADO[tipo] };
}
