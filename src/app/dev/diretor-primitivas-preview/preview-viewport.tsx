"use client";

import { useEffect, type ReactNode } from "react";

function restoreStyle(element: HTMLElement, previous: string | null) {
  if (previous === null) element.removeAttribute("style");
  else element.setAttribute("style", previous);
}

export function DirectorPrimitivesPreviewViewport({ children }: { children: ReactNode }) {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlStyle = html.getAttribute("style");
    const previousBodyStyle = body.getAttribute("style");

    html.style.setProperty("overflow-x", "hidden", "important");
    html.style.setProperty("overflow-y", "auto", "important");
    body.style.setProperty("height", "auto", "important");
    body.style.setProperty("min-height", "100dvh");
    body.style.setProperty("overflow-x", "hidden", "important");
    body.style.setProperty("overflow-y", "auto", "important");

    return () => {
      restoreStyle(html, previousHtmlStyle);
      restoreStyle(body, previousBodyStyle);
    };
  }, []);

  return <div className="min-h-dvh" data-director-primitives-preview>{children}</div>;
}
