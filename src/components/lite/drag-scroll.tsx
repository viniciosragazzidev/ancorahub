"use client";

/**
 * Arrastar para rolar (27/11/2026): com o mouse, qualquer tabela ou faixa de abas que role de lado pode ser puxada com
 * o botão esquerdo, como no celular. Vale para toda área com rolagem horizontal real (overflow-x auto ou scroll e
 * conteúdo maior que a caixa). O arraste só começa depois de 6px de movimento; quando acontece, o clique que viria a
 * seguir é cancelado, para não abrir a linha ou trocar de aba sem querer. Campos de texto, seleção de texto e o toque
 * ficam como estão (o toque já rola nativamente). Uma área pode recusar com `data-drag-scroll="off"`.
 */
import { useEffect } from "react";

const THRESHOLD = 6;
const SKIP = "input, textarea, select, [contenteditable=''], [contenteditable='true'], [data-drag-scroll='off']";

function scrollableX(start: Element | null): HTMLElement | null {
  let node: Element | null = start;
  while (node && node !== document.body) {
    if (node instanceof HTMLElement && node.scrollWidth > node.clientWidth + 1) {
      const overflowX = getComputedStyle(node).overflowX;
      if (overflowX === "auto" || overflowX === "scroll") return node;
    }
    node = node.parentElement;
  }
  return null;
}

export function DragScroll() {
  useEffect(() => {
    let target: HTMLElement | null = null;
    let startX = 0;
    let startScroll = 0;
    let dragging = false;
    let pointerId = -1;

    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      const origin = event.target as Element | null;
      if (!origin || origin.closest(SKIP)) return;
      const scroller = scrollableX(origin);
      if (!scroller) return;
      target = scroller;
      startX = event.clientX;
      startScroll = scroller.scrollLeft;
      dragging = false;
      pointerId = event.pointerId;
    };

    const onMove = (event: PointerEvent) => {
      if (!target || event.pointerId !== pointerId) return;
      const delta = event.clientX - startX;
      if (!dragging) {
        if (Math.abs(delta) < THRESHOLD) return;
        dragging = true;
        target.dataset.dragScrolling = "true";
        window.getSelection()?.removeAllRanges();
      }
      target.scrollLeft = startScroll - delta;
      event.preventDefault();
    };

    const end = () => {
      if (!target) return;
      const was = dragging;
      delete target.dataset.dragScrolling;
      target = null;
      dragging = false;
      if (was) {
        // O clique que o navegador dispara logo depois do arraste não abre nada.
        const block = (click: MouseEvent) => {
          click.stopPropagation();
          click.preventDefault();
        };
        window.addEventListener("click", block, { capture: true, once: true });
        window.setTimeout(() => window.removeEventListener("click", block, { capture: true }), 0);
      }
    };

    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointermove", onMove, { capture: true, passive: false });
    document.addEventListener("pointerup", end, true);
    document.addEventListener("pointercancel", end, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", end, true);
      document.removeEventListener("pointercancel", end, true);
    };
  }, []);
  return null;
}
