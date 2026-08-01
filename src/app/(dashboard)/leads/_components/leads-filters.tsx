"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, SlidersHorizontal, ListChecks } from "@/components/huge-icons";

type Branch = { id: string; name: string };
type Broker = { id: string; name: string };

export function LeadsFilters({
  initialSearch,
  initialStatus,
  initialBranch,
  initialTipo,
  initialOrigem,
  initialQualification,
  initialCorretor,
  initialPageSize,
  branches,
  brokers,
}: {
  initialSearch?: string;
  initialStatus?: string;
  initialBranch?: string;
  initialTipo?: string;
  initialOrigem?: string;
  initialQualification?: string;
  initialCorretor?: string;
  initialPageSize?: string;
  branches: Branch[];
  brokers: Broker[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);

  // States
  const [search, setSearch] = useState(initialSearch ?? "");
  const [status, setStatus] = useState(initialStatus ?? "");
  const [branch, setBranch] = useState(initialBranch ?? "");
  const [tipo, setTipo] = useState(initialTipo ?? "");
  const [origem, setOrigem] = useState(initialOrigem ?? "");
  const [qualification, setQualification] = useState(initialQualification ?? "");
  const [corretor, setCorretor] = useState(initialCorretor ?? "");
  const [pageSize, setPageSize] = useState(initialPageSize ?? "20");

  const activeCount = [
    status,
    branch,
    tipo,
    origem,
    qualification,
    corretor,
    pageSize !== "20" ? pageSize : "",
  ].filter(Boolean).length;

  const hasAnyFilter = Boolean(search || activeCount > 0);

  function applyFilters() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");

    if (search) params.set("search", search); else params.delete("search");
    if (status) params.set("status", status); else params.delete("status");
    if (branch) params.set("branch", branch); else params.delete("branch");
    if (tipo) params.set("tipo", tipo); else params.delete("tipo");
    if (origem) params.set("origem", origem); else params.delete("origem");
    if (qualification) params.set("qualification", qualification); else params.delete("qualification");
    if (corretor) params.set("corretor", corretor); else params.delete("corretor");
    if (pageSize && pageSize !== "20") params.set("pageSize", pageSize); else params.delete("pageSize");

    router.push(`/leads${params.toString() ? `?${params.toString()}` : ""}`);
    setOpen(false);
  }

  function handleReset() {
    setSearch("");
    setStatus("");
    setBranch("");
    setTipo("");
    setOrigem("");
    setQualification("");
    setCorretor("");
    setPageSize("20");

    const params = new URLSearchParams(searchParams.toString());
    params.delete("search");
    params.delete("status");
    params.delete("branch");
    params.delete("tipo");
    params.delete("origem");
    params.delete("qualification");
    params.delete("corretor");
    params.delete("pageSize");
    params.delete("page");

    router.push(`/leads${params.toString() ? `?${params.toString()}` : ""}`);
    setOpen(false);
  }

  const statusLabels: Record<string, string> = {
    new: "Novos",
    distributed: "Distribuídos",
    in_contact: "Em Atendimento",
    quote_sent: "Cotação Enviada",
    negotiation: "Negociação",
    documentation_pending: "Doc Pendente",
    under_analysis: "Em Análise",
    converted: "Convertidos",
    lost: "Perdidos",
  };

  const qualificationLabels: Record<string, string> = {
    unqualified: "Sem Qualificação",
    warm: "Morna",
    hot: "Quente",
    disqualified: "Desqualificado",
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Top Search Bar + Filter Trigger */}
      <div className="flex w-full items-center gap-2">
        <form
          className="relative flex-1 max-w-[300px]"
          onSubmit={(e) => {
            e.preventDefault();
            applyFilters();
          }}
        >
          <Input
            aria-label="Buscar leads"
            className="h-9 w-full bg-card px-3 text-xs shadow-xs placeholder:text-muted-foreground focus-visible:ring-1"
            name="search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome ou telefone..."
            value={search}
          />
        </form>

        {/* Filter Popup Button */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger render={<Button size="sm" variant={activeCount > 0 ? "default" : "outline"} className="h-9 gap-2 px-3.5 text-xs font-medium shrink-0 shadow-xs" />}>
            <SlidersHorizontal className="size-4" />
            Filtros Avançados
            {activeCount > 0 && (
              <Badge variant="secondary" className="ml-0.5 rounded-full px-1.5 py-0 text-[10px] font-bold">
                {activeCount}
              </Badge>
            )}
          </PopoverTrigger>

          <PopoverContent align="end" side="bottom" sideOffset={8} className="w-84 sm:w-96 p-0 rounded-2xl border border-border/80 bg-popover shadow-2xl backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-border/70 p-3.5">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg border border-border/60 bg-muted/40">
                  <SlidersHorizontal className="size-3.5 text-foreground" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-foreground">Filtros da Fila</h3>
                  <p className="text-[11px] text-muted-foreground">Refine os resultados do Kanban e da tabela</p>
                </div>
              </div>
              {activeCount > 0 ? (
                <Badge variant="secondary" className="text-[10px] font-mono">
                  {activeCount} ativo(s)
                </Badge>
              ) : (
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-primary">
                  <span className="flex size-1.5 rounded-full bg-primary animate-pulse" />
                  Ajustar
                </span>
              )}
            </div>

            <ScrollArea className="max-h-[380px] p-4">
              <div className="space-y-4">
                {/* Tipo (PF / PME) - Segmented Control */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Tipo de Lead</label>
                  <div className="grid grid-cols-3 rounded-lg bg-muted/50 p-0.5 border border-border/40">
                    {[
                      { label: "Todos", val: "" },
                      { label: "PF", val: "PF" },
                      { label: "PME", val: "PME" },
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setTipo(opt.val)}
                        className={`h-7 rounded-md text-xs font-medium transition-all duration-150 ${
                          tipo === opt.val
                            ? "bg-background text-foreground shadow-xs font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Origem - Segmented Control */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Origem da Oportunidade</label>
                  <div className="grid grid-cols-3 rounded-lg bg-muted/50 p-0.5 border border-border/40">
                    {[
                      { label: "Todas", val: "" },
                      { label: "Manual", val: "manual" },
                      { label: "Webhook", val: "webhook" },
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setOrigem(opt.val)}
                        className={`h-7 rounded-md text-xs font-medium transition-all duration-150 ${
                          origem === opt.val
                            ? "bg-background text-foreground shadow-xs font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status / Etapa */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Etapa / Status</label>
                  <div className="relative">
                    <select
                      aria-label="Status"
                      className="h-8.5 w-full appearance-none rounded-lg border border-border/60 bg-muted/30 px-3 text-xs text-foreground font-medium shadow-xs transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                      name="status"
                      onChange={(event) => setStatus(event.target.value)}
                      value={status}
                    >
                      <option value="">Todos os status</option>
                      <option value="new">Novos</option>
                      <option value="distributed">Distribuídos</option>
                      <option value="in_contact">Em atendimento</option>
                      <option value="quote_sent">Cotação Enviada</option>
                      <option value="negotiation">Negociação</option>
                      <option value="documentation_pending">Doc Pendente</option>
                      <option value="under_analysis">Em Análise</option>
                      <option value="converted">Convertidos</option>
                      <option value="lost">Perdidos</option>
                    </select>
                    <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Qualificação */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Status de Qualificação</label>
                  <div className="relative">
                    <select
                      aria-label="Qualificação"
                      className="h-8.5 w-full appearance-none rounded-lg border border-border/60 bg-muted/30 px-3 text-xs text-foreground font-medium shadow-xs transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                      name="qualification"
                      onChange={(event) => setQualification(event.target.value)}
                      value={qualification}
                    >
                      <option value="">Todas as qualificações</option>
                      <option value="unqualified">Sem Qualificação</option>
                      <option value="warm">Morna (Em Qualificação)</option>
                      <option value="hot">Quente (Alta Prioridade)</option>
                      <option value="disqualified">Desqualificado</option>
                    </select>
                    <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Filial */}
                {branches.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Filial / Unidade</label>
                    <div className="relative">
                      <select
                        aria-label="Filial"
                        className="h-8.5 w-full appearance-none rounded-lg border border-border/60 bg-muted/30 px-3 text-xs text-foreground font-medium shadow-xs transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                        name="branch"
                        onChange={(event) => setBranch(event.target.value)}
                        value={branch}
                      >
                        <option value="">Todas as filiais</option>
                        {branches.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}

                {/* Corretor */}
                {brokers.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Corretor Responsável</label>
                    <div className="relative">
                      <select
                        aria-label="Corretor"
                        className="h-8.5 w-full appearance-none rounded-lg border border-border/60 bg-muted/30 px-3 text-xs text-foreground font-medium shadow-xs transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                        name="corretor"
                        onChange={(event) => setCorretor(event.target.value)}
                        value={corretor}
                      >
                        <option value="">Todos os corretores</option>
                        {brokers.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}

                {/* Itens por página - Segmented Control */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Itens por Página</label>
                  <div className="grid grid-cols-4 rounded-lg bg-muted/50 p-0.5 border border-border/40">
                    {["10", "20", "50", "100"].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setPageSize(size)}
                        className={`h-7 rounded-md text-xs font-medium transition-all duration-150 ${
                          pageSize === size
                            ? "bg-background text-foreground shadow-xs font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>

            <div className="flex items-center justify-between border-t border-border/70 bg-muted/20 p-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
                Limpar
              </Button>

              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={applyFilters}
                className="h-8 gap-1.5 px-3.5 text-xs font-semibold"
              >
                <SlidersHorizontal className="size-3.5" />
                Aplicar
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {hasAnyFilter && (
          <Button
            size="sm"
            type="button"
            variant="ghost"
            onClick={handleReset}
            className="h-9 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
            title="Limpar todos os filtros"
          >
            <X className="size-3.5" />
            Limpar
          </Button>
        )}
      </div>

      {/* Active Filter Chips */}
      {hasAnyFilter && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground mr-1">Filtros ativos:</span>
          {search && (
            <Badge variant="secondary" className="gap-1 text-[11px] font-normal">
              Busca: &quot;{search}&quot;
            </Badge>
          )}
          {status && (
            <Badge variant="secondary" className="gap-1 text-[11px] font-normal">
              Status: {statusLabels[status] ?? status}
            </Badge>
          )}
          {tipo && (
            <Badge variant="secondary" className="gap-1 text-[11px] font-normal">
              Tipo: {tipo}
            </Badge>
          )}
          {origem && (
            <Badge variant="secondary" className="gap-1 text-[11px] font-normal">
              Origem: {origem === "manual" ? "Manual" : "Webhook"}
            </Badge>
          )}
          {qualification && (
            <Badge variant="secondary" className="gap-1 text-[11px] font-normal">
              Qualificação: {qualificationLabels[qualification] ?? qualification}
            </Badge>
          )}
          {branch && (
            <Badge variant="secondary" className="gap-1 text-[11px] font-normal">
              Filial: {branches.find((b) => b.id === branch)?.name ?? "Filial"}
            </Badge>
          )}
          {corretor && (
            <Badge variant="secondary" className="gap-1 text-[11px] font-normal">
              Corretor: {brokers.find((b) => b.id === corretor)?.name ?? "Corretor"}
            </Badge>
          )}
          {pageSize !== "20" && (
            <Badge variant="secondary" className="gap-1 text-[11px] font-normal">
              {pageSize} por pág.
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}


