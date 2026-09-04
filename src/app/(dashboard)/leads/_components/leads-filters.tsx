"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { StatefulButton } from "@/components/ui/stateful-button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppSelect } from "@/components/ui/select";
import { X, SlidersHorizontal } from "@/components/huge-icons";
import { FilterBar } from "@/components/foundations/filter-bar";
import { ActiveFilterChips, type FilterChipItem } from "@/components/foundations/active-filter-chips";
import {
  hasLeadFilterQuery,
  parseLeadFilterPreferences,
  type LeadFilterPreferences,
} from "@/features/leads/lead-filter-preferences";

type Branch = { id: string; name: string };
type Broker = { id: string; name: string };

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
  storageKey,
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
  storageKey: string;
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
  const [eligibleCampaigns, setEligibleCampaigns] = useState(initialEligibleCampaigns === "1");
  const [restored, setRestored] = useState(false);

  const currentPreferences = (): LeadFilterPreferences => ({
    search, status, branch, tipo, origem, qualification, corretor, pageSize, eligibleCampaigns,
  });

  function buildUrl(preferences: LeadFilterPreferences) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");

    if (preferences.search) params.set("search", preferences.search); else params.delete("search");
    if (preferences.status) params.set("status", preferences.status); else params.delete("status");
    if (preferences.branch) params.set("branch", preferences.branch); else params.delete("branch");
    if (preferences.tipo) params.set("tipo", preferences.tipo); else params.delete("tipo");
    if (preferences.origem) params.set("origem", preferences.origem); else params.delete("origem");
    if (preferences.qualification) params.set("qualification", preferences.qualification); else params.delete("qualification");
    if (preferences.corretor) params.set("corretor", preferences.corretor); else params.delete("corretor");
    if (preferences.eligibleCampaigns) params.set("eligibleCampaigns", "1"); else params.delete("eligibleCampaigns");
    if (preferences.pageSize !== "20") params.set("pageSize", preferences.pageSize); else params.delete("pageSize");

    const queryStr = params.toString();
    return `/leads${queryStr ? `?${queryStr}` : ""}`;
  }

  useEffect(() => {
    if (restored || hasLeadFilterQuery(searchParams)) return;
    setRestored(true);
    const stored = parseLeadFilterPreferences(window.localStorage.getItem(storageKey));
    if (!stored) return;
    const target = buildUrl(stored);
    if (`${window.location.pathname}${window.location.search}` !== target) {
      window.location.replace(target);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored, searchParams, storageKey]);

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

  function applyFilters(overridePrefs?: LeadFilterPreferences) {
    const preferences = overridePrefs ?? currentPreferences();
    window.localStorage.setItem(storageKey, JSON.stringify(preferences));
    setOpen(false);
    router.push(buildUrl(preferences));
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

    window.localStorage.removeItem(storageKey);
    router.push("/leads");
  }

  // Active filter chips
  const chips: FilterChipItem[] = [];
  if (search) chips.push({ id: "search", label: "Busca", value: `"${search}"` });
  if (status) chips.push({ id: "status", label: "Status", value: statusLabels[status] ?? status });
  if (tipo) chips.push({ id: "tipo", label: "Tipo", value: tipo === "PME" ? "PJ" : tipo });
  if (origem) chips.push({ id: "origem", label: "Origem", value: origem === "manual" ? "Manual" : "Webhook" });
  if (eligibleCampaigns) chips.push({ id: "eligibleCampaigns", label: "Meta", value: "Elegíveis agora" });
  if (qualification) chips.push({ id: "qualification", label: "Qualificação", value: qualificationLabels[qualification] ?? qualification });
  if (branch) chips.push({ id: "branch", label: "Filial", value: branches.find((b) => b.id === branch)?.name ?? "Filial" });
  if (corretor) chips.push({ id: "corretor", label: "Corretor", value: brokers.find((b) => b.id === corretor)?.name ?? "Corretor" });
  if (pageSize !== "20") chips.push({ id: "pageSize", label: "Por página", value: `${pageSize}/pág.` });

  function handleRemoveChip(chipId: string) {
    const updated = { ...currentPreferences() };
    if (chipId === "search") { setSearch(""); updated.search = ""; }
    if (chipId === "status") { setStatus(""); updated.status = ""; }
    if (chipId === "tipo") { setTipo(""); updated.tipo = ""; }
    if (chipId === "origem") { setOrigem(""); updated.origem = ""; }
    if (chipId === "eligibleCampaigns") { setEligibleCampaigns(false); updated.eligibleCampaigns = false; }
    if (chipId === "qualification") { setQualification(""); updated.qualification = ""; }
    if (chipId === "branch") { setBranch(""); updated.branch = ""; }
    if (chipId === "corretor") { setCorretor(""); updated.corretor = ""; }
    if (chipId === "pageSize") { setPageSize("20"); updated.pageSize = "20"; }

    window.localStorage.setItem(storageKey, JSON.stringify(updated));
    router.push(buildUrl(updated));
  }

  return (
    <div className="flex flex-col gap-2.5">
      <FilterBar
        searchValue={search}
        onSearchChange={(val) => setSearch(val)}
        searchPlaceholder="Buscar por nome ou telefone..."
        quickFilters={
          <form
            onSubmit={(e) => {
              e.preventDefault();
              applyFilters();
            }}
            className="flex items-center gap-2"
          >
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              className="h-8 gap-1.5 px-3 text-xs font-medium"
            >
              Buscar
            </Button>
          </form>
        }
        advancedFiltersTrigger={{
          activeCount,
          onClick: () => setOpen(true),
        }}
        hasActiveFilters={hasAnyFilter}
        onClearFilters={handleReset}
      />

      {/* Advanced Filters Popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<span className="hidden" />} />
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={8}
          className="w-84 rounded-xl border border-border bg-popover p-0 shadow-lg sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-border/70 p-3.5">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg border border-border/60 bg-muted/40">
                <SlidersHorizontal className="size-3.5 text-foreground" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-foreground">Filtros da Fila</h3>
                <p className="text-[11px] text-muted-foreground">Refine os resultados do Kanban e da lista</p>
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
              {/* Tipo (PF / PJ) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Tipo de Lead
                </label>
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
                      className={`h-7 rounded-md text-xs font-medium transition-[background-color,color,box-shadow] duration-150 ${
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

              {/* Origem */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Origem da Oportunidade
                </label>
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
                      className={`h-7 rounded-md text-xs font-medium transition-[background-color,color,box-shadow] duration-150 ${
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

              {/* Campanhas Meta */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Campanhas Meta
                </label>
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
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Etapa / Status
                </label>
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
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Status de Qualificação
                </label>
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
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Filial / Unidade
                  </label>
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
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Corretor Responsável
                  </label>
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

              {/* Itens por página */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Itens por Página
                </label>
                <div className="grid grid-cols-4 rounded-lg bg-muted/50 p-0.5 border border-border/40">
                  {["10", "20", "50", "100"].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setPageSize(size)}
                      className={`h-7 rounded-md text-xs font-medium transition-[background-color,color,box-shadow] duration-150 ${
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

            <StatefulButton
              state="idle"
              onClick={() => applyFilters()}
              size="sm"
              className="h-8 gap-1.5 px-3.5 text-xs font-semibold"
              icon={<SlidersHorizontal className="size-3.5" />}
            >
              Aplicar
            </StatefulButton>
          </div>
        </PopoverContent>
      </Popover>

      {/* Canonical Active Filter Chips */}
      <ActiveFilterChips
        chips={chips}
        onRemoveChip={handleRemoveChip}
        onClearAll={handleReset}
      />
    </div>
  );
}

