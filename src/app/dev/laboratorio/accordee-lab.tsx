"use client";

/**
 * Laboratório: estilo Accordee na moldura do diretor (21/11/2026). Abre a moldura real (`/dev/diretor-shell-real`,
 * mesma sidebar, topo e telas do app, com dados de exemplo) num quadro de computador, com a tela e o tema escolhidos
 * aqui. Referência e decisões: docs/design-system/referencias/accordee.md.
 */
import { useEffect, useRef, useState } from "react";

const SCREENS = [
  { id: "inicio", label: "Início", src: "/dev/diretor-shell-real" },
  { id: "conversas", label: "Conversas", src: "/dev/diretor-shell-real?view=conversas" },
] as const;

type ScreenId = (typeof SCREENS)[number]["id"];

export function AccordeeLab() {
  const [screen, setScreen] = useState<ScreenId>("inicio");
  const [dark, setDark] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const src = SCREENS.find((item) => item.id === screen)?.src ?? SCREENS[0].src;

  // O quadro é da mesma origem: o tema vai direto na classe `dark` do <html> dele, como o app faz.
  useEffect(() => {
    const apply = () => frame.current?.contentDocument?.documentElement.classList.toggle("dark", dark);
    apply();
    const node = frame.current;
    node?.addEventListener("load", apply);
    return () => node?.removeEventListener("load", apply);
  }, [dark, src]);

  return (
    <div style={{ display: "grid", gap: 12, padding: 16 }}>
      <div role="toolbar" aria-label="Estilo Accordee" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 13 }}>
        {SCREENS.map((item) => (
          <button key={item.id} type="button" aria-pressed={screen === item.id} onClick={() => setScreen(item.id)} style={{ minHeight: 28, padding: "0 10px", border: "1px solid #e5e5e5", borderRadius: 8, background: screen === item.id ? "#f5f5f5" : "#ffffff", fontWeight: screen === item.id ? 500 : 400, cursor: "pointer" }}>
            {item.label}
          </button>
        ))}
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
          <input type="checkbox" checked={dark} onChange={(event) => setDark(event.target.checked)} /> Modo escuro
        </label>
      </div>
      <iframe ref={frame} key={src} src={src} title={`Moldura do diretor: ${screen}`} style={{ width: "100%", height: "calc(100dvh - 96px)", minHeight: 640, border: "1px solid #e5e5e5", borderRadius: 12 }} />
    </div>
  );
}
