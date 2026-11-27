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
    let savedSnap = "";
    let savedBehavior = "";

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
        // Encaixe (scroll-snap) e rolagem suave brigam com o arraste: puxavam de volta para o item mais perto a cada
        // movimento. Ficam desligados enquanto se puxa e voltam ao soltar.
        savedSnap = target.style.scrollSnapType;
        savedBehavior = target.style.scrollBehavior;
        target.style.scrollSnapType = "none";
        target.style.scrollBehavior = "auto";
        window.getSelection()?.removeAllRanges();
      }
      target.scrollLeft = startScroll - delta;
      window.getSelection()?.removeAllRanges();
      event.preventDefault();
    };

    const end = () => {
      if (!target) return;
      const was = dragging;
      delete target.dataset.dragScrolling;
      if (was) {
        target.style.scrollSnapType = savedSnap;
        target.style.scrollBehavior = savedBehavior;
      }
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

    // Começando em cima de um link, imagem ou texto, o navegador iniciava o "arrastar link" ou a seleção de texto, que
    // cancelam os eventos do ponteiro: a área não rolava. Sobre uma área que rola de lado, os dois ficam desligados.
    const onDragStart = (event: DragEvent) => {
      if (target) event.preventDefault();
    };
    const onSelectStart = (event: Event) => {
      if (target && dragging) event.preventDefault();
    };
    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const origin = event.target as Element | null;
      if (!origin || origin.closest(SKIP) || !scrollableX(origin)) return;
      // Sem isso o navegador começa a selecionar texto já no primeiro pixel; o clique e o foco seguem normais.
      if (origin.closest("a, img")) event.preventDefault();
    };

    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("dragstart", onDragStart, true);
    document.addEventListener("selectstart", onSelectStart, true);
    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("pointermove", onMove, { capture: true, passive: false });
    document.addEventListener("pointerup", end, true);
    document.addEventListener("pointercancel", end, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("dragstart", onDragStart, true);
      document.removeEventListener("selectstart", onSelectStart, true);
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", end, true);
      document.removeEventListener("pointercancel", end, true);
    };
  }, []);
  return null;
}
