"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
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
          className="relative flex-1"
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
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button size="sm" variant={activeCount > 0 ? "default" : "outline"} className="h-9 gap-2 px-3.5 text-xs font-medium shrink-0 shadow-xs" />}>
            <SlidersHorizontal className="size-4" />
            Filtros Avançados
            {activeCount > 0 && (
              <Badge variant="secondary" className="ml-0.5 rounded-full px-1.5 py-0 text-[10px] font-bold">
                {activeCount}
              </Badge>
            )}
          </SheetTrigger>

          <SheetContent side="right" className="w-[min(100vw-1rem,26rem)] sm:max-w-md">
            <SheetHeader>
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-accent/30">
                  <SlidersHorizontal className="size-4 text-foreground" />
                </div>
                <div>
                  <SheetTitle className="text-sm font-semibold">Filtros da Fila de Leads</SheetTitle>
                  <SheetDescription className="text-xs">
                    Refine os resultados exibidos na lista e no Kanban.
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <SheetBody className="space-y-4">
              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Etapa / Status</label>
                <select
                  aria-label="Status"
                  className="h-9 w-full rounded-lg border border-input bg-card px-3 text-xs text-foreground font-medium shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
              </div>

              {/* Tipo (PF / PME) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Tipo de Lead</label>
                <select
                  aria-label="Tipo"
                  className="h-9 w-full rounded-lg border border-input bg-card px-3 text-xs text-foreground font-medium shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  name="tipo"
                  onChange={(event) => setTipo(event.target.value)}
                  value={tipo}
                >
                  <option value="">Todos os tipos (PF & PME)</option>
                  <option value="PF">Pessoa Física (PF)</option>
                  <option value="PME">Pessoa Jurídica (PME)</option>
                </select>
              </div>

              {/* Origem */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Origem da Oportunidade</label>
                <select
                  aria-label="Origem"
                  className="h-9 w-full rounded-lg border border-input bg-card px-3 text-xs text-foreground font-medium shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  name="origem"
                  onChange={(event) => setOrigem(event.target.value)}
                  value={origem}
                >
                  <option value="">Todas as origens</option>
                  <option value="manual">Cadastro Manual</option>
                  <option value="webhook">Integrador / Meta Ads / Landing Page</option>
                </select>
              </div>

              {/* Qualificação */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Status de Qualificação</label>
                <select
                  aria-label="Qualificação"
                  className="h-9 w-full rounded-lg border border-input bg-card px-3 text-xs text-foreground font-medium shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
              </div>

              {/* Filial */}
              {branches.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Filial / Unidade</label>
                  <select
                    aria-label="Filial"
                    className="h-9 w-full rounded-lg border border-input bg-card px-3 text-xs text-foreground font-medium shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                </div>
              )}

              {/* Corretor */}
              {brokers.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Corretor Responsável</label>
                  <select
                    aria-label="Corretor"
                    className="h-9 w-full rounded-lg border border-input bg-card px-3 text-xs text-foreground font-medium shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                </div>
              )}

              {/* Itens por página */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Itens por Página</label>
                <select
                  aria-label="Itens por página"
                  className="h-9 w-full rounded-lg border border-input bg-card px-3 text-xs text-foreground font-medium shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  name="pageSize"
                  onChange={(event) => setPageSize(event.target.value)}
                  value={pageSize}
                >
                  <option value="10">10 resultados por página</option>
                  <option value="20">20 resultados por página (Padrão)</option>
                  <option value="50">50 resultados por página</option>
                  <option value="100">100 resultados por página</option>
                </select>
              </div>
            </SheetBody>

            <SheetFooter className="flex items-center justify-between border-t border-border/80 bg-card/80 p-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
                Limpar Filtros
              </Button>

              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={applyFilters}
                className="gap-1.5 px-4 text-xs font-semibold"
              >
                <SlidersHorizontal className="size-3.5" />
                Aplicar Filtros
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

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


