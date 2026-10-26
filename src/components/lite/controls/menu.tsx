"use client";

/**
 * Menu de ações Lite (F3): um botão de 44px com ícone que abre a lista de ações. Ações são botões ou links; Esc fecha
 * e devolve o foco ao disparador. Clicar numa ação fecha o menu.
 * A lista abre num portal com posição fixa, para não ficar presa em card ou tabela com overflow (2026-10-26):
 * abre para baixo alinhada à direita do botão e sobe quando falta espaço. Clique fora, rolagem ou resize fecham.
 */
import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

import { useArcPortalTarget, useArcScopeEnabled, useArcScopeProps } from "@/components/arc/arc-scope-context";

import styles from "./controls.module.css";

type LiteMenuTone = "default" | "success" | "danger";

export type LiteMenuItem =
  | { id: string; label: string; onSelect: () => void; href?: undefined; tone?: LiteMenuTone; disabled?: boolean }
  | { id: string; label: string; href: string; onSelect?: undefined; tone?: LiteMenuTone; disabled?: undefined };

const toneAttr = (tone?: LiteMenuTone) => (tone === "success" || tone === "danger" ? tone : undefined);

/** Distância entre o botão e a lista, e margem mínima até a borda da janela. */
const GAP = 6;
const EDGE = 8;

export function LiteMenu({ label, items }: { label: string; items: LiteMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const menuId = useId();
  const portalTarget = useArcPortalTarget();
  const scopeProps = useArcScopeProps();
  // Fora do Diretor o portal vai para o body: a lista leva o escopo Lite junto para manter os tokens.
  const scope = useArcScopeEnabled() ? scopeProps : { className: "arc-venancor" };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    // A lista é fixa na tela: se a página rolar ou mudar de tamanho, ela fecha em vez de descolar do botão.
    const close = (event: Event) => {
      if (event.type === "scroll" && listRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  // Mede depois de montar e antes de pintar: abre para baixo e sobe quando a lista não cabe embaixo do botão.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const list = listRef.current;
    if (!trigger || !list) return;
    const rect = trigger.getBoundingClientRect();
    const height = list.offsetHeight;
    const below = rect.bottom + GAP;
    const fitsBelow = below + height <= window.innerHeight - EDGE;
    const top = fitsBelow ? below : Math.max(EDGE, rect.top - GAP - height);
    setPosition({ top, right: Math.max(EDGE, window.innerWidth - rect.right) });
  }, [open]);

  const list = (
    <div {...scope} className={`${scope.className ?? ""} ${styles.menuLayer}`}>
      <ul
        ref={listRef}
        id={menuId}
        role="menu"
        aria-label={label}
        className={styles.menuList}
        // Até medir, fica invisível no topo para não piscar no lugar errado.
        style={position ?? { top: 0, right: 0, visibility: "hidden" }}
      >
        {items.map((item) => (
          <li key={item.id} role="none">
            {item.href ? (
              <Link role="menuitem" href={item.href} className={styles.menuItem} data-tone={toneAttr(item.tone)} onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ) : (
              <button
                type="button"
                role="menuitem"
                className={styles.menuItem}
                data-tone={toneAttr(item.tone)}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.();
                }}
              >
                {item.label}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    // O menu fica dentro de uma linha clicável: o clique e a tecla não podem abrir a linha junto (o portal repassa os eventos pela árvore do React).
    <div className={styles.menuWrap} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.menuTrigger}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal aria-hidden="true" size={18} />
      </button>
      {open ? (portalTarget ? createPortal(list, portalTarget) : list) : null}
    </div>
  );
}
