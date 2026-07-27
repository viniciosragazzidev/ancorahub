"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ArrowRight, MagnifyingGlass } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SearchItem = { id: string; title: string; subtitle: string | null; href: string };
type SearchGroup = { type: string; label: string; items: SearchItem[] };

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        const payload = await response.json() as { enabled?: boolean; groups?: SearchGroup[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Não foi possível pesquisar agora.");
        setDisabled(payload.enabled === false);
        setGroups(payload.groups ?? []);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Não foi possível pesquisar agora.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, query]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  function goTo(href: string) {
    close();
    router.push(href);
  }

  return <>
    {open ? <div className="fixed inset-0 z-40 flex items-start justify-center bg-background/80 p-4 pt-[12vh] backdrop-blur-sm" onClick={close}>
      <section aria-label="Busca global" className="w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-card shadow-xl" onClick={(event) => event.stopPropagation()}>
        <form className="flex items-center gap-2 border-b border-border p-3" onSubmit={(event) => { event.preventDefault(); const first = groups[0]?.items[0]; if (first) goTo(first.href); }}>
          <MagnifyingGlass className="size-4 text-muted-foreground" />
          <Input autoFocus className="border-0 bg-transparent shadow-none focus-visible:ring-0" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar leads, clientes, equipe ou tarefas..." value={query} />
          <kbd className="hidden rounded border border-border px-1.5 text-[10px] text-muted-foreground sm:inline">Esc</kbd>
        </form>
        <div aria-live="polite" className="max-h-[min(60vh,32rem)] overflow-y-auto p-3">
          {disabled ? <p className="p-6 text-center text-sm text-muted-foreground">A busca global foi desativada pelo Super-admin.</p> : loading ? <p className="p-6 text-center text-sm text-muted-foreground">Pesquisando...</p> : error ? <p className="p-6 text-center text-sm text-destructive">{error}</p> : query.trim().length < 2 ? <p className="p-6 text-center text-sm text-muted-foreground">Digite pelo menos 2 caracteres para pesquisar.</p> : groups.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Nenhum resultado encontrado no seu escopo.</p> : groups.map((group) => <div className="mb-4 last:mb-0" key={group.type}><p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{group.label}</p><div className="grid gap-1">{group.items.map((item) => <button className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40" key={`${group.type}-${item.id}`} onClick={() => goTo(item.href)} type="button"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><MagnifyingGlass className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.title}</span><span className="block truncate text-xs text-muted-foreground">{item.subtitle ?? "Sem informação complementar"}</span></span><ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" /></button>)}</div></div>)}
        </div>
        <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">Resultados respeitam o tenant, a filial e o cargo do usuário.</p>
      </section>
    </div> : null}
    <Button aria-label="Busca global (Ctrl K)" className="hidden gap-2 text-muted-foreground md:flex" onClick={() => setOpen(true)} size="sm" variant="outline"><MagnifyingGlass /> Buscar <kbd className="rounded border border-border px-1.5 text-[10px]">Ctrl K</kbd></Button>
  </>;
}
