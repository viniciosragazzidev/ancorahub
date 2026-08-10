"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles, Command as CommandIcon, ArrowRight, ShieldCheck } from "lucide-react";
import { Dialog, DialogPopup, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { FEATURE_SEARCH_INDEX, type FeatureIndexItem } from "@/shared/feature-search-index";
import { getUserDisplayInfo, type UserDisplayInfo } from "@/shared/auth/actions";

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [user, setUser] = useState<UserDisplayInfo | null>(null);

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

  const userPermissions = user?.permissions ?? [];

  const allowedFeatures = FEATURE_SEARCH_INDEX.filter((item) =>
    userPermissions.includes(item.permission)
  );

  const filteredFeatures = allowedFeatures.filter((item) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase().trim();
    return (
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.domain.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.toLowerCase().includes(q))
    );
  });

  const groupedByDomain = filteredFeatures.reduce<Record<string, FeatureIndexItem[]>>((acc, item) => {
    if (!acc[item.domain]) acc[item.domain] = [];
    acc[item.domain].push(item);
    return acc;
  }, {});

  const handleSelect = (url: string) => {
    setOpen(false);
    setQuery("");
    router.push(url);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPopup className="max-w-2xl gap-0 p-0 overflow-hidden rounded-xl border-border/80 shadow-2xl">
        <DialogHeader className="p-4 border-b border-border/60">
          <DialogTitle className="sr-only">Busca Global e Atalhos do AncoraHub</DialogTitle>
          <div className="flex items-center gap-3 px-1">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digite para buscar páginas, funções ou comandos (ex: 'resetar memória', 'comissões', 'leads')..."
              className="border-0 bg-transparent text-sm focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-9"
              autoFocus
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
              ESC
            </kbd>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[380px] p-2">
          {Object.keys(groupedByDomain).length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Sparkles className="size-8 text-muted-foreground/50 mx-auto" />
              <p className="text-sm font-semibold text-foreground">Nenhuma funcionalidade encontrada</p>
              <p className="text-xs text-muted-foreground">Tente pesquisar por termos como "leads", "followup", "qualificação", "plantão" ou "comissões".</p>
            </div>
          ) : (
            <div className="space-y-4 p-1">
              {Object.entries(groupedByDomain).map(([domain, items]) => (
                <div key={domain} className="space-y-1">
                  <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    {domain}
                  </div>
                  <div className="space-y-1">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelect(item.url)}
                        className="w-full flex items-center justify-between gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-accent group focus:outline-none focus:bg-accent"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-border/80 bg-background text-primary group-hover:border-primary/40">
                            <CommandIcon className="size-3.5" />
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <div className="text-xs font-semibold text-foreground group-hover:text-primary flex items-center gap-2">
                              {item.title}
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                {item.domain}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-1">{item.description}</p>
                          </div>
                        </div>

                        <ArrowRight className="size-4 text-muted-foreground/40 group-hover:text-primary shrink-0 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-3.5 text-emerald-500" />
            <span>Resultados filtrados pelas suas permissões ativas</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Usar <kbd className="rounded border px-1 bg-background font-mono">↑</kbd> <kbd className="rounded border px-1 bg-background font-mono">↓</kbd> para navegar</span>
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
