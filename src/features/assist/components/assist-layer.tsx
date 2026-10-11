"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { AssistCapability } from "../catalog";
import { AssistSearch } from "./assist-search";
import { HelpButton, HelpSheet } from "./help-sheet";

type AssistApi = { openSearch: () => void; openHelp: () => void; capabilities: Partial<Record<AssistCapability, boolean>> };
const AssistContext = createContext<AssistApi | null>(null);

/** Open the search or the help from anywhere inside the broker Lite (null outside it). */
export function useAssist() {
  return useContext(AssistContext);
}

function isTyping(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return Boolean(element && (element.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName)));
}

/**
 * Broker assistance for the whole Lite: the "Onde fica?" search and the "?"
 * help of the current screen. Shortcuts on computers: "/" or Ctrl+K (Cmd+K)
 * open the search, "?" opens the help; never while typing in a field.
 */
export function AssistLayer({ pathname, capabilities, children }: { pathname: string; capabilities: Partial<Record<AssistCapability, boolean>>; children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const openSearch = useCallback(() => { setHelpOpen(false); setSearchOpen(true); }, []);
  const openHelp = useCallback(() => { setSearchOpen(false); setHelpOpen(true); }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTyping(event.target)) return;
      if ((event.key === "k" || event.key === "K") && (event.ctrlKey || event.metaKey)) { event.preventDefault(); openSearch(); return; }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "/") { event.preventDefault(); openSearch(); }
      else if (event.key === "?") { event.preventDefault(); openHelp(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openSearch, openHelp]);

  const api = useMemo(() => ({ openSearch, openHelp, capabilities }), [openSearch, openHelp, capabilities]);
  return (
    <AssistContext.Provider value={api}>
      {children}
      <AssistSearch open={searchOpen} onOpenChange={setSearchOpen} capabilities={capabilities} />
      <HelpSheet pathname={pathname} open={helpOpen} onOpenChange={setHelpOpen} onSearch={openSearch} />
    </AssistContext.Provider>
  );
}

/** The header "?" wired to the layer (renders nothing outside it). */
export function AssistHelpButton() {
  const assist = useAssist();
  return assist ? <HelpButton onClick={assist.openHelp} /> : null;
}
