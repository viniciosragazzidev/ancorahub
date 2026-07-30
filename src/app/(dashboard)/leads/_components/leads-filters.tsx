"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, SlidersHorizontal } from "@/components/huge-icons";

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

  const [search, setSearch] = useState(initialSearch ?? "");
  const [status, setStatus] = useState(initialStatus ?? "");
  const [branch, setBranch] = useState(initialBranch ?? "");
  const [tipo, setTipo] = useState(initialTipo ?? "");
  const [origem, setOrigem] = useState(initialOrigem ?? "");
  const [qualification, setQualification] = useState(initialQualification ?? "");
  const [corretor, setCorretor] = useState(initialCorretor ?? "");
  const [pageSize, setPageSize] = useState(initialPageSize ?? "20");

  const hasActiveFilters = Boolean(
    search || status || branch || tipo || origem || qualification || corretor || (pageSize && pageSize !== "20")
  );

  function submitCurrent() {
    const params = new URLSearchParams(searchParams.toString());
    
    // Reset page to 1 on filter change
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
  }

  return (
    <div className="grid gap-2">
      <form
        className="flex w-full flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submitCurrent();
        }}
      >
        <div className="relative flex-1 min-w-[200px]">
          <Input
            aria-label="Buscar leads"
            className="h-8 w-full bg-muted text-xs placeholder:text-muted-foreground"
            name="search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome ou telefone..."
            value={search}
          />
        </div>

        <select
          aria-label="Status"
          className="h-8 rounded-lg border border-input bg-muted px-2.5 text-xs text-foreground font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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

        <select
          aria-label="Tipo"
          className="h-8 rounded-lg border border-input bg-muted px-2.5 text-xs text-foreground font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          name="tipo"
          onChange={(event) => setTipo(event.target.value)}
          value={tipo}
        >
          <option value="">Todos os tipos</option>
          <option value="PF">PF (Pessoa Física)</option>
          <option value="PME">PME (Jurídica)</option>
        </select>

        <select
          aria-label="Origem"
          className="h-8 rounded-lg border border-input bg-muted px-2.5 text-xs text-foreground font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          name="origem"
          onChange={(event) => setOrigem(event.target.value)}
          value={origem}
        >
          <option value="">Todas as origens</option>
          <option value="manual">Manual</option>
          <option value="webhook">Webhook / Meta / LP</option>
        </select>

        <select
          aria-label="Qualificação"
          className="h-8 rounded-lg border border-input bg-muted px-2.5 text-xs text-foreground font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          name="qualification"
          onChange={(event) => setQualification(event.target.value)}
          value={qualification}
        >
          <option value="">Todas as qualificações</option>
          <option value="unqualified">Sem Qualificação</option>
          <option value="warm">Morna</option>
          <option value="hot">Quente</option>
          <option value="disqualified">Desqualificado</option>
        </select>

        {branches.length > 0 && (
          <select
            aria-label="Filial"
            className="h-8 rounded-lg border border-input bg-muted px-2.5 text-xs text-foreground font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
        )}

        {brokers.length > 0 && (
          <select
            aria-label="Corretor"
            className="h-8 rounded-lg border border-input bg-muted px-2.5 text-xs text-foreground font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
        )}

        <select
          aria-label="Itens por página"
          className="h-8 rounded-lg border border-input bg-muted px-2.5 text-xs text-foreground font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          name="pageSize"
          onChange={(event) => setPageSize(event.target.value)}
          value={pageSize}
        >
          <option value="10">10 / pág</option>
          <option value="20">20 / pág</option>
          <option value="50">50 / pág</option>
          <option value="100">100 / pág</option>
        </select>

        <Button size="sm" type="submit" variant="default" className="h-8 gap-1.5 px-3 text-xs">
          <SlidersHorizontal className="size-3.5" />
          Filtrar
        </Button>

        {hasActiveFilters && (
          <Button size="sm" type="button" variant="ghost" onClick={handleReset} className="h-8 gap-1 px-2.5 text-xs text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
            Limpar
          </Button>
        )}
      </form>
    </div>
  );
}

