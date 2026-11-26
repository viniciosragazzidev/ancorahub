"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, ShieldCheck } from "lucide-react";
import { Dialog, DialogPopup, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getUserDisplayInfo, type UserDisplayInfo } from "@/shared/auth/actions";
import { useArcScopeEnabled } from "@/components/arc/arc-scope-context";
import { useNavFlags } from "@/components/navigation/nav-access";
import { browseNavPages, searchNavPages } from "@/shared/navigation/nav-search";

type SearchItem = { id: string; title: string; subtitle: string | null; href: string };
type SearchGroup = { type: string; label: string; items: SearchItem[] };

/**
 * Busca Ctrl+K (26/11/2026, docs/research/deskcomm-interface-conversao.md, lote 2): as páginas vêm só do cadastro do
 * menu (nav-registry), o mesmo para todos os papéis; leads, clientes, tarefas e pessoas vêm de /api/search.
 */
export function CommandPalette() {
  const router = useRouter();
  const directorLite = useArcScopeEnabled();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [user, setUser] = useState<UserDisplayInfo | null>(null);
  const [searchGroups, setSearchGroups] = useState<SearchGroup[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getUserDisplayInfo().then(setUser);

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    const handleCustomOpen = () => setOpen(true);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-command-palette", handleCustomOpen);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-command-palette", handleCustomOpen);
    };
  }, []);

  useEffect(() => {
    if (!open || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Falha na busca");
        const result = await response.json() as { groups?: SearchGroup[] };
        setSearchGroups(result.groups ?? []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setSearchGroups([]);
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, query]);

  const navFlags = useNavFlags();
  const navUser = user ? { ...user, negotiationsEnabled: navFlags.negotiationsEnabled, postSaleAuditEnabled: navFlags.postSaleAuditEnabled, autoSaleEnabled: navFlags.autoSaleEnabled, erpPaths: navFlags.erpPaths } : null;
  const searching = query.trim().length >= 2;

  // Seções na ordem da tela. Sem busca: o menu inteiro por área. Com busca: páginas do menu, depois o que veio do CRM.
  const sections: { key: string; label: string; items: SearchItem[] }[] = searching
    ? [
        { key: "pages", label: "Páginas", items: searchNavPages(query, navUser) },
        ...searchGroups.map((group) => ({ key: group.type, label: group.label, items: group.items })),
      ].filter((section) => section.items.length > 0)
    : browseNavPages(navUser).map((group) => ({ key: `area-${group.area}`, label: group.area, items: group.pages }));
  const flatItems = sections.flatMap((section) => section.items.map((item) => ({ section: section.key, item })));
  const safeActive = flatItems.length === 0 ? -1 : Math.min(activeIndex, flatItems.length - 1);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView?.({ block: "nearest" });
  }, [safeActive]);

  const reset = () => {
    setQuery("");
    setSearchGroups([]);
    setSearchLoading(false);
    setActiveIndex(0);
  };

  const handleSelect = (url: string) => {
    setOpen(false);
    reset();
    router.push(url);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) reset();
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setSearchGroups([]);
    setActiveIndex(0);
    setSearchLoading(value.trim().length >= 2);
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (flatItems.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((safeActive + 1) % flatItems.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((safeActive - 1 + flatItems.length) % flatItems.length);
    } else if (event.key === "Enter" && safeActive >= 0) {
      event.preventDefault();
      handleSelect(flatItems[safeActive].item.href);
    }
  };

  const resultClass = directorLite
    ? "director-command-result"
    : "flex w-full items-center gap-3 rounded-lg p-2.5 text-left text-sm transition-colors hover:bg-accent focus:outline-none focus:bg-accent data-[active=true]:bg-accent";
  let position = -1;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPopup className={`max-w-2xl gap-0 p-0 overflow-hidden rounded-xl border-border/80 shadow-2xl${directorLite ? " director-command-palette" : ""}`}>
        <DialogHeader className="p-4 border-b border-border/60">
          <DialogTitle className="sr-only">Buscar no AncoraHub</DialogTitle>
          <div className="flex items-center gap-3 px-1">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Buscar páginas, leads, clientes e pessoas..."
              aria-controls="command-palette-results"
              aria-activedescendant={safeActive >= 0 ? `command-item-${safeActive}` : undefined}
              className="border-0 bg-transparent text-sm focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-9"
              autoFocus
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-border bg-muted/50 px-2 py-0.5 text-xs font-mono text-muted-foreground">
              Esc
            </kbd>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[min(70vh,520px)] p-2">
          <div id="command-palette-results" ref={listRef} role="listbox" aria-label="Resultados da busca" className="space-y-3 p-1">
            {sections.map((section) => (
              <div key={section.key} className="space-y-1">
                <p className="px-3 py-1 text-xs font-medium text-muted-foreground">{section.label}</p>
                {section.items.map((item) => {
                  position += 1;
                  const index = position;
                  return (
                    <button
                      key={`${section.key}-${item.id}`}
                      id={`command-item-${index}`}
                      type="button"
                      role="option"
                      aria-selected={index === safeActive}
                      data-active={index === safeActive}
                      onMouseMove={() => index !== safeActive && setActiveIndex(index)}
                      onClick={() => handleSelect(item.href)}
                      className={resultClass}
                    >
                      <span className="min-w-0 flex-1"><span className="block truncate">{item.title}</span>{item.subtitle ? <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span> : null}</span>
                      <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            ))}
            {searching && searchLoading ? <p role="status" className="px-3 py-2 text-sm text-muted-foreground">Buscando no CRM…</p> : null}
            {!searchLoading && flatItems.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">{searching ? "Nada encontrado. Tente outro nome, telefone ou página." : "Nenhuma página disponível para o seu acesso."}</p>
            ) : null}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            <span>Só aparece o que o seu acesso permite</span>
          </div>
          <div className="hidden items-center gap-1 sm:flex">
            <kbd className="rounded border px-1 bg-background font-mono">↑</kbd> <kbd className="rounded border px-1 bg-background font-mono">↓</kbd> para escolher, <kbd className="rounded border px-1 bg-background font-mono">Enter</kbd> para abrir
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
