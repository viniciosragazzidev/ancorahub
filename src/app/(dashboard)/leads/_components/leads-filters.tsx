"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { StatefulButton } from "@/components/ui/stateful-button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppSelect } from "@/components/ui/select";
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
  initialEligibleCampaigns,
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
  initialEligibleCampaigns?: string;
  branches: Branch[];
  brokers: Broker[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

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
  const [eligibleCampaigns, setEligibleCampaigns] = useState(initialEligibleCampaigns === "1");

  const activeCount = [
    status,
    branch,
    tipo,
    origem,
    qualification,
    corretor,
    eligibleCampaigns ? "eligible-campaigns" : "",
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
    if (eligibleCampaigns) params.set("eligibleCampaigns", "1"); else params.delete("eligibleCampaigns");
    if (pageSize && pageSize !== "20") params.set("pageSize", pageSize); else params.delete("pageSize");

    const queryStr = params.toString();
    const newUrl = `/leads${queryStr ? `?${queryStr}` : ""}`;
    startTransition(() => router.push(newUrl));
  }

  function handleReset() {
    setSearch("");
    setStatus("");
    setBranch("");
    setTipo("");
    setOrigem("");
    setQualification("");
    setCorretor("");
    setEligibleCampaigns(false);
    setPageSize("20");

    startTransition(() => router.push("/leads"));
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
            className="h-9 w-full bg-background px-3 text-xs shadow-xs placeholder:text-muted-foreground focus-visible:ring-1"
            name="search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome ou telefone..."
            value={search}
          />
        </form>

        {/* Filter Popup Button */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger render={<Button size="sm" variant={activeCount > 0 ? "default" : "outline"} className="h-9 gap-2 px-3 text-xs font-medium shrink-0 shadow-xs sm:px-3.5" />}>
            <SlidersHorizontal className="size-4" />
            <span className="hidden sm:inline">Filtros Avançados</span>
            <span className="sm:hidden">Filtros</span>
            {activeCount > 0 && (
              <Badge variant="secondary" className="ml-0.5 rounded-full px-1.5 py-0 text-[10px] font-bold">
                {activeCount}
              </Badge>
            )}
          </PopoverTrigger>

          <PopoverContent aria-busy={isPending} align="end" side="bottom" sideOffset={8} className="w-84 rounded-xl border border-border bg-popover p-0 shadow-[0_18px_45px_rgb(15_23_42/0.14)] sm:w-96">
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
                  <span className="flex size-1.5 rounded-full bg-primary" />
                  Ajustar
                </span>
              )}
            </div>

            <ScrollArea className="h-[min(65dvh,32rem)]">
              <div className="space-y-4 p-4 pb-6">
                {/* Tipo (PF / PME) - Segmented Control */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Tipo de Lead</label>
                  <div className="grid grid-cols-3 rounded-lg bg-muted/50 p-0.5 border border-border/40">
                    {[
                      { label: "Todos", val: "" },
                      { label: "PF", val: "PF" },
                      { label: "PJ", val: "PJ" },
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setTipo(opt.val)}
                        className={`h-7 rounded-md text-xs font-medium transition-[background-color,color,box-shadow] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] ${
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
                        className={`h-7 rounded-md text-xs font-medium transition-[background-color,color,box-shadow] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] ${
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

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Campanhas Meta</label>
                  <AppSelect
                    aria-label="Campanhas Meta"
                    className="h-8.5"
                    triggerClassName="h-8.5 rounded-lg border-border/60 bg-muted/30 px-3 text-xs font-medium hover:bg-muted/50"
                    onValueChange={(value) => setEligibleCampaigns(value === "1")}
                    options={[
                      { value: "", label: "Todas as campanhas" },
                      { value: "1", label: "Somente elegíveis agora" },
                    ]}
                    value={eligibleCampaigns ? "1" : ""}
                  />
                </div>

                {/* Status / Etapa */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Etapa / Status</label>
                  <AppSelect
                    aria-label="Status"
                    className="h-8.5"
                    triggerClassName="h-8.5 rounded-lg border-border/60 bg-muted/30 px-3 text-xs font-medium hover:bg-muted/50"
                    onValueChange={setStatus}
                    options={[
                      { value: "", label: "Todos os status" },
                      { value: "new", label: "Novos" },
                      { value: "distributed", label: "Distribuídos" },
                      { value: "in_contact", label: "Em atendimento" },
                      { value: "quote_sent", label: "Cotação enviada" },
                      { value: "negotiation", label: "Negociação" },
                      { value: "documentation_pending", label: "Documento pendente" },
                      { value: "under_analysis", label: "Em análise" },
                      { value: "converted", label: "Convertidos" },
                      { value: "lost", label: "Perdidos" },
                    ]}
                    value={status}
                  />
                </div>

                {/* Qualificação */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Status de Qualificação</label>
                  <AppSelect
                    aria-label="Qualificação"
                    className="h-8.5"
                    triggerClassName="h-8.5 rounded-lg border-border/60 bg-muted/30 px-3 text-xs font-medium hover:bg-muted/50"
                    onValueChange={setQualification}
                    options={[
                      { value: "", label: "Todas as qualificações" },
                      { value: "unqualified", label: "Sem qualificação" },
                      { value: "warm", label: "Morna (em qualificação)" },
                      { value: "hot", label: "Quente (alta prioridade)" },
                      { value: "disqualified", label: "Desqualificado" },
                    ]}
                    value={qualification}
                  />
                </div>

                {/* Filial */}
                {branches.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Filial / Unidade</label>
                    <AppSelect
                      aria-label="Filial"
                      className="h-8.5"
                      triggerClassName="h-8.5 rounded-lg border-border/60 bg-muted/30 px-3 text-xs font-medium hover:bg-muted/50"
                      onValueChange={setBranch}
                      options={[
                        { value: "", label: "Todas as filiais" },
                        ...branches.map((item) => ({ value: item.id, label: item.name })),
                      ]}
                      value={branch}
                    />
                  </div>
                )}

                {/* Corretor */}
                {brokers.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Corretor Responsável</label>
                    <AppSelect
                      aria-label="Corretor"
                      className="h-8.5"
                      triggerClassName="h-8.5 rounded-lg border-border/60 bg-muted/30 px-3 text-xs font-medium hover:bg-muted/50"
                      onValueChange={setCorretor}
                      options={[
                        { value: "", label: "Todos os corretores" },
                        ...brokers.map((item) => ({ value: item.id, label: item.name })),
                      ]}
                      value={corretor}
                    />
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
                        className={`h-7 rounded-md text-xs font-medium transition-[background-color,color,box-shadow] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] ${
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
                disabled={isPending}
                onClick={handleReset}
                className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
                Limpar
              </Button>

              <StatefulButton
                state={isPending ? "loading" : "idle"}
                loadingText="Aplicando..."
                onClick={applyFilters}
                size="sm"
                className="h-8 gap-1.5 px-3.5 text-xs font-semibold"
                icon={<SlidersHorizontal className="size-3.5" />}
              >
                Aplicar
              </StatefulButton>
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
              Tipo: {tipo === "PME" ? "PJ" : tipo}
            </Badge>
          )}
          {origem && (
            <Badge variant="secondary" className="gap-1 text-[11px] font-normal">
              Origem: {origem === "manual" ? "Manual" : "Webhook"}
            </Badge>
          )}
          {eligibleCampaigns && (
            <Badge variant="secondary" className="gap-1 text-[11px] font-normal">
              Meta: campanhas elegíveis
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

