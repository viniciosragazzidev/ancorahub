"use client";

import { Button } from "@/components/ui/button";
import ActionButton from "@/components/arc/action-button/action-button";
import { StatefulButton } from "@/components/ui/stateful-button";
import { useArcScopeEnabled } from "@/components/arc/arc-scope-context";
import { useDirectorLitePage } from "@/components/arc/use-director-lite-page";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppSelect } from "@/components/ui/select";
import { X, SlidersHorizontal } from "@/components/huge-icons";
import { FilterBar } from "@/components/foundations/filter-bar";
import { ActiveFilterChips } from "@/components/foundations/active-filter-chips";
import { cn } from "@/lib/utils";

import { LeadsLiteFilters } from "./leads-lite-filters";
import { useLeadFilters, type LeadsFiltersProps } from "./use-lead-filters";

/** Filtros de /leads: a versão Lite com a chave do diretor ligada; a tela atual, sem mudança, nos demais casos. */
export function LeadsFilters(props: LeadsFiltersProps) {
  const litePage = useDirectorLitePage();
  if (litePage) return <LeadsLiteFilters {...props} />;
  return <LeadsFiltersClassic {...props} />;
}

function LeadsFiltersClassic({ trailing: _trailing, ...props }: LeadsFiltersProps) {
  // Mesmo comportamento de antes: com o provider ligado numa rota em opt-out, o botão de aplicar é o do Arc.
  const directorLite = useArcScopeEnabled();
  const { hideOriginFilters = false, branches, brokers, tags = [] } = props;
  const {
    open, setOpen,
    search, setSearch,
    status, setStatus,
    optimisticStatus, setOptimisticStatus,
    tipo, setTipo,
    origem, setOrigem,
    qualification, setQualification,
    branch, setBranch,
    corretor, setCorretor,
    tag, setTag,
    pageSize, setPageSize,
    eligibleCampaigns, setEligibleCampaigns,
    currentPreferences,
    activeCount,
    hasAnyFilter,
    applyFilters,
    handleReset,
    chips,
    handleRemoveChip,
  } = useLeadFilters(props);

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
              className="h-10 gap-1.5 px-3 text-xs font-medium"
            >
              Buscar
            </Button>
          </form>
        }
        advancedFiltersTrigger={{
          activeCount,
        }}
        isAdvancedFiltersOpen={open}
        onAdvancedFiltersOpenChange={setOpen}
        advancedFiltersContent={
          <>
            <div className="flex items-center justify-between border-b border-border/70 p-3.5">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-[var(--radius-card)] border border-border/60 bg-muted/40">
                  <SlidersHorizontal className="size-3.5 text-foreground" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-foreground">Filtros da Fila</h3>
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
                  <div className="grid grid-cols-3 rounded-[var(--radius-card)] bg-muted/50 p-0.5 border border-border/40">
                    {[
                      { label: "Todos", val: "" },
                      { label: "PF", val: "PF" },
                      { label: "PJ", val: "PJ" },
                    ].map((opt) => (
                      <Button
                        key={opt.label}
                        size="sm"
                        type="button"
                        variant="ghost"
                        onClick={() => setTipo(opt.val)}
                        className={`h-7 rounded-full border-0 text-xs font-medium ${
                          tipo === opt.val
                            ? "bg-background text-foreground shadow-none font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Origem */}
                {hideOriginFilters ? null : <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Origem da Oportunidade
                  </label>
                  <div className="grid grid-cols-3 rounded-[var(--radius-card)] bg-muted/50 p-0.5 border border-border/40">
                    {[
                      { label: "Todas", val: "" },
                      { label: "Manual", val: "manual" },
                      { label: "Webhook", val: "webhook" },
                    ].map((opt) => (
                      <Button
                        key={opt.label}
                        size="sm"
                        type="button"
                        variant="ghost"
                        onClick={() => setOrigem(opt.val)}
                        className={`h-7 rounded-full border-0 text-xs font-medium ${
                          origem === opt.val
                            ? "bg-background text-foreground shadow-none font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>}

                {/* Tag */}
                {tags.length ? (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      Tag
                    </label>
                    <AppSelect
                      aria-label="Tag"
                      className="h-8.5"
                      triggerClassName="h-11 rounded-full border-border/60 bg-muted/30 px-3 text-xs font-medium hover:bg-muted/50"
                      onValueChange={(value) => setTag(value ?? "")}
                      options={[{ value: "", label: "Todas as tags" }, ...tags.map((item) => ({ value: item.id, label: item.name }))]}
                      value={tag}
                    />
                  </div>
                ) : null}

                {/* Campanhas Meta */}
                {hideOriginFilters ? null : <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Campanhas Meta
                  </label>
                  <AppSelect
                    aria-label="Campanhas Meta"
                    className="h-8.5"
                    triggerClassName="h-11 rounded-full border-border/60 bg-muted/30 px-3 text-xs font-medium hover:bg-muted/50"
                    onValueChange={(value) => setEligibleCampaigns(value === "1")}
                    options={[
                      { value: "", label: "Todas as campanhas" },
                      { value: "1", label: "Somente elegíveis agora" },
                    ]}
                    value={eligibleCampaigns ? "1" : ""}
                  />
                </div>}

                {/* Status / Etapa */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Etapa / Status
                  </label>
                  <AppSelect
                    aria-label="Status"
                    className="h-8.5"
                    triggerClassName="h-11 rounded-full border-border/60 bg-muted/30 px-3 text-xs font-medium hover:bg-muted/50"
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
                    triggerClassName="h-11 rounded-full border-border/60 bg-muted/30 px-3 text-xs font-medium hover:bg-muted/50"
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
                      triggerClassName="h-11 rounded-full border-border/60 bg-muted/30 px-3 text-xs font-medium hover:bg-muted/50"
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
                      triggerClassName="h-11 rounded-full border-border/60 bg-muted/30 px-3 text-xs font-medium hover:bg-muted/50"
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
                  <div className="grid grid-cols-4 rounded-[var(--radius-card)] bg-muted/50 p-0.5 border border-border/40">
                    {["10", "20", "50", "100"].map((size) => (
                      <Button
                        key={size}
                        size="sm"
                        type="button"
                        variant="ghost"
                        onClick={() => setPageSize(size)}
                        className={`h-7 rounded-full border-0 text-xs font-medium ${
                          pageSize === size
                            ? "bg-background text-foreground shadow-none font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {size}
                      </Button>
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
                className="h-10 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
                Limpar
              </Button>

              {directorLite ? (
                <ActionButton
                  label="Aplicar filtros"
                  pendingLabel="Aplicando"
                  successLabel="Filtros aplicados"
                  onAction={async () => { await applyFilters(); }}
                  className="min-h-11 gap-1.5 px-3.5 text-xs font-semibold"
                />
              ) : (
                <StatefulButton
                  state="idle"
                  onClick={() => applyFilters()}
                  size="sm"
                  className="h-8 gap-1.5 px-3.5 text-xs font-semibold"
                  icon={<SlidersHorizontal className="size-3.5" />}
                >
                  Aplicar
                </StatefulButton>
              )}
            </div>
          </>
        }
        hasActiveFilters={hasAnyFilter}
        onClearFilters={handleReset}
      />

      {/* Quick Filter Status Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        {[
          { id: "", label: "Todos os leads" },
          { id: "new", label: "Novos", dot: "bg-info" },
          { id: "in_contact", label: "Em Atendimento", dot: "bg-warning" },
          { id: "quote_sent", label: "Cotação Enviada", dot: "bg-primary" },
          { id: "negotiation", label: "Em Negociação", dot: "bg-warning" },
          { id: "converted", label: "Convertidos", dot: "bg-success" },
          { id: "lost", label: "Perdidos", dot: "bg-destructive" },
        ].map((pill) => {
          const isSelected = (optimisticStatus ?? status) === pill.id;
          return (
            <Button
              key={pill.id}
              size="sm"
              type="button"
              variant="ghost"
              aria-pressed={isSelected}
              onClick={() => {
                setOptimisticStatus(pill.id);
                setStatus(pill.id);
                applyFilters({ ...currentPreferences(), status: pill.id });
              }}
              className={cn(
                "h-10 shrink-0 gap-1.5 rounded-full px-3 text-xs font-medium",
                isSelected
                  ? "bg-primary text-primary-foreground font-semibold shadow-none"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50"
              )}
            >
              {pill.dot && <span className={cn("size-1.5 rounded-full shrink-0", pill.dot)} />}
              <span>{pill.label}</span>
            </Button>
          );
        })}
      </div>

      {chips.length > 0 && (
        <ActiveFilterChips
          chips={chips}
          onRemoveChip={handleRemoveChip}
          onClearAll={handleReset}
        />
      )}
    </div>
  );
}

