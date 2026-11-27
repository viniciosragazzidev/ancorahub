"use client";

/**
 * Arrastar para rolar (27/11/2026): com o mouse, qualquer tabela ou faixa de abas que role de lado pode ser puxada com
 * o botão esquerdo, como no celular, nos dois sentidos: lista, tabela, conversa ou página.
 * O arraste só começa depois de 6px; quando acontece, o clique seguinte é cancelado (não abre a linha nem troca de
 * aba sem querer). Campos de texto e o toque ficam como estão; uma área pode recusar com `data-drag-scroll="off"`.
 */
import { useEffect } from "react";

const THRESHOLD = 6;
// Fora do arraste: campos, o que já se arrasta de propósito (cartão do Kanban, controles deslizantes, alças de gaveta)
// e quem recusar com data-drag-scroll="off".
const SKIP = "input, textarea, select, [contenteditable=''], [contenteditable='true'], [data-drag-scroll='off'], [draggable='true'], [aria-roledescription], [role='slider'], [data-vaul-drawer], [data-dnd-kit], [data-rbd-draggable-id]";

function scrollable(start: Element | null, axis: "x" | "y"): HTMLElement | null {
  let node: Element | null = start;
  while (node && node !== document.body && node !== document.documentElement) {
    if (node instanceof HTMLElement) {
      const overflows = axis === "x" ? node.scrollWidth > node.clientWidth + 1 : node.scrollHeight > node.clientHeight + 1;
      if (overflows) {
        const style = getComputedStyle(node);
        const overflow = axis === "x" ? style.overflowX : style.overflowY;
        if (overflow === "auto" || overflow === "scroll") return node;
      }
    }
    node = node.parentElement;
  }
  if (axis === "y") {
    const page = document.scrollingElement as HTMLElement | null;
    if (page && page.scrollHeight > page.clientHeight + 1) return page;
  }
  return null;
}

type Axis = { el: HTMLElement; start: number; snap: string; behavior: string };

export function DragScroll() {
  useEffect(() => {
    let x: Axis | null = null;
    let y: Axis | null = null;
    let startX = 0;
    let startY = 0;
    let dragging = false;
    let pointerId = -1;
    let marked: HTMLElement | null = null;

    const reset = () => {
      x = null;
      y = null;
      dragging = false;
      marked = null;
    };

    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      const origin = event.target as Element | null;
      if (!origin || origin.closest(SKIP)) return;
      // Qualquer área que role, nos dois sentidos (28/11/2026): as listas do visual novo não são <table> e cabem na
      // largura, então só a rolagem vertical tinha para onde ir.
      const sx = scrollable(origin, "x");
      const sy = scrollable(origin, "y");
      if (!sx && !sy) return;
      x = sx ? { el: sx, start: sx.scrollLeft, snap: "", behavior: "" } : null;
      y = sy ? { el: sy, start: sy.scrollTop, snap: "", behavior: "" } : null;
      startX = event.clientX;
      startY = event.clientY;
      dragging = false;
      pointerId = event.pointerId;
    };

    const freeze = (axis: Axis | null) => {
      if (!axis) return;
      // Encaixe (scroll-snap) e rolagem suave puxavam de volta a cada movimento: ficam desligados enquanto se puxa.
      axis.snap = axis.el.style.scrollSnapType;
      axis.behavior = axis.el.style.scrollBehavior;
      axis.el.style.scrollSnapType = "none";
      axis.el.style.scrollBehavior = "auto";
    };
    const thaw = (axis: Axis | null) => {
      if (!axis) return;
      axis.el.style.scrollSnapType = axis.snap;
      axis.el.style.scrollBehavior = axis.behavior;
    };

    const onMove = (event: PointerEvent) => {
      if ((!x && !y) || event.pointerId !== pointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (!dragging) {
        if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return;
        dragging = true;
        freeze(x);
        freeze(y);
        marked = (x ?? y)!.el;
        marked.dataset.dragScrolling = "true";
        document.documentElement.dataset.dragScrolling = "true";
      }
      if (x) x.el.scrollLeft = x.start - dx;
      if (y) y.el.scrollTop = y.start - dy;
      window.getSelection()?.removeAllRanges();
      event.preventDefault();
    };

    const end = () => {
      if (!x && !y) return;
      if (dragging) {
        thaw(x);
        thaw(y);
        if (marked) delete marked.dataset.dragScrolling;
        delete document.documentElement.dataset.dragScrolling;
        // O clique que o navegador dispara logo depois do arraste não abre nada.
        const block = (click: MouseEvent) => {
          click.stopPropagation();
          click.preventDefault();
        };
        window.addEventListener("click", block, { capture: true, once: true });
        window.setTimeout(() => window.removeEventListener("click", block, { capture: true }), 0);
      }
      reset();
    };

    // Começando num link, imagem ou texto, o navegador iniciava o "arrastar link" ou a seleção, que cancelam o ponteiro.
    const onDragStart = (event: DragEvent) => {
      if (x || y) event.preventDefault();
    };
    const onSelectStart = (event: Event) => {
      if ((x || y) && dragging) event.preventDefault();
    };
    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const origin = event.target as Element | null;
      if (!origin || origin.closest(SKIP)) return;
      if (!scrollable(origin, "x") && !scrollable(origin, "y")) return;
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
