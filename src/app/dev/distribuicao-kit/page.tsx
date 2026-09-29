"use client";

import { useEffect, useRef, useState } from "react";
import { notFound } from "next/navigation";
import { ArrowUpRight, CalendarDays, Clock, Inbox, MoreHorizontal, Route, Sparkles, TriangleAlert, UserRoundCheck } from "lucide-react";

import { DsCallout } from "@/components/ui/ds-callout";
import { DsCheckbox } from "@/components/ui/ds-checkbox";
import { DsCountUp } from "@/components/ui/ds-count-up";
import { DsDashboardCard } from "@/components/ui/ds-dashboard-card";
import { DsDataList, DsDataRow, DsMetaChip } from "@/components/ui/ds-data-row";
import { DsEmptyState } from "@/components/ui/ds-empty-state";
import { DsFilledDarkCta } from "@/components/ui/ds-filled-dark-cta";
import { DsOutlinedActionButton } from "@/components/ui/ds-outlined-action-button";
import { DsPageHeader } from "@/components/ui/ds-page-header";
import { DsSectionHeader } from "@/components/ui/ds-section-header";
import { DsSegmentedControl } from "@/components/ui/ds-segmented-control";
import { DsSelectionBar } from "@/components/ui/ds-selection-bar";
import { DsDataRowSkeleton } from "@/components/ui/ds-skeleton";
import {
  DsSheet,
  DsSheetBody,
  DsSheetContent,
  DsSheetDescription,
  DsSheetFooter,
  DsSheetHeader,
  DsSheetSection,
  DsSheetTitle,
  DsSheetTrigger,
} from "@/components/ui/ds-sheet";
import { DsStatTile } from "@/components/ui/ds-stat-tile";
import { DsStatusBadge } from "@/components/ui/ds-status-badge";
import { DsSwitch } from "@/components/ui/ds-switch";
import { DsTabs, DsTabsList, DsTabsPanel, DsTabsTrigger } from "@/components/ui/ds-tabs";
import { engineHealthUi, leadDistributionStatusUi, queueStatusUi, slaStatusUi } from "@/features/lead-distribution/status-ui";

/**
 * Revisão visual do kit da Central de Distribuição (Lote 0) — só em desenvolvimento.
 * Dados fictícios; nenhuma action, consulta ou rota real. A composição de
 * exemplo é interativa: "Simular novo lead" e "Simular carregamento" mostram
 * as animações de entrada, o contador e o skeleton.
 */

type Lead = { id: string; name: string; source: string; unit: string; status: string; elapsed: number };

const AREAS = [
  { id: "operacao", label: "Operação" },
  { id: "plantoes", label: "Plantões" },
  { id: "regras", label: "Regras" },
  { id: "filas", label: "Filas" },
  { id: "acompanhamento", label: "Acompanhamento" },
] as const;

const INITIAL_LEADS: Lead[] = [
  { id: "1", name: "Marina Alves", source: "Meta · Verão", unit: "Centro", status: "queued", elapsed: 4 },
  { id: "2", name: "Carlos Mendes", source: "WhatsApp", unit: "Sem unidade", status: "unassigned", elapsed: 12 },
  { id: "3", name: "Fernanda Lima", source: "Site", unit: "Norte", status: "returned_to_queue", elapsed: 21 },
  { id: "4", name: "Rafael Souza", source: "Meta · Saúde", unit: "Centro", status: "distribution_failed", elapsed: 9 },
];

const NEW_NAMES = ["Beatriz Rocha", "Diego Martins", "Larissa Costa", "Pedro Nunes", "Camila Freitas"];

function Block({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-ds-12">
      <div>
        <h2 className="text-ds-body-lg font-semibold text-ds-charcoal">{title}</h2>
        {note ? <p className="mt-ds-4 text-ds-body text-ds-fog">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

function IconButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex size-ds-32 items-center justify-center rounded-ds-buttons text-ds-graphite outline-none transition-colors hover:bg-ds-paper-mist focus-visible:ring-2 focus-visible:ring-ds-electric-blue/40"
    >
      <MoreHorizontal size={16} aria-hidden="true" />
    </button>
  );
}

export default function DistribuicaoKitPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  const [area, setArea] = useState<string>("operacao");
  const [filter, setFilter] = useState<string>("all");
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [auto, setAuto] = useState(true);
  const nextId = useRef(5);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const engine = engineHealthUi({ available: true, failed: 0 });
  const atRisk = leads.filter((lead) => slaStatusUi(lead.elapsed, 15).tone !== "success").length;
  const visible = leads.filter((lead) =>
    filter === "all" ? true : filter === "returned" ? lead.status === "returned_to_queue" : lead.status === filter,
  );
  const filters = [
    { value: "all", label: "Todos", count: leads.length },
    { value: "unassigned", label: "Sem unidade", count: leads.filter((l) => l.status === "unassigned").length },
    { value: "queued", label: "Sem corretor", count: leads.filter((l) => l.status === "queued").length },
    { value: "returned", label: "Devolvidos", count: leads.filter((l) => l.status === "returned_to_queue").length },
  ];

  const toggle = (id: string) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  function addLead() {
    const id = String(nextId.current++);
    const name = NEW_NAMES[(nextId.current - 6) % NEW_NAMES.length];
    setLeads((cur) => [{ id, name, source: "Meta · Verão", unit: "Centro", status: "queued", elapsed: 0 }, ...cur]);
  }

  function simulateLoading() {
    setLoading(true);
    timer.current = window.setTimeout(() => setLoading(false), 1200);
  }

  return (
    <div className="min-h-screen bg-ds-canvas-white font-ds-inter text-ds-charcoal">
      <DsPageHeader
        title="Kit da Central de Distribuição"
        breadcrumb="Lote 0 · revisão visual"
        description="Peças reutilizáveis do novo padrão. Dados fictícios — nenhuma chamada real."
      />

      <main className="mx-auto max-w-5xl space-y-ds-48 px-ds-24 py-ds-32">
        <Block title="1. Composição de exemplo — área Operação" note="Interativa: simule um novo lead, o carregamento e a seleção em lote.">
          <div className="overflow-hidden rounded-ds-large-cards border border-ds-ash">
            <DsPageHeader
              title="Central de distribuição"
              breadcrumb="Operação comercial"
              context={<DsStatusBadge status={engine.tone} label={engine.label} />}
              actions={
                <div className="flex gap-ds-8">
                  <DsOutlinedActionButton onClick={addLead}>Simular novo lead</DsOutlinedActionButton>
                  <DsOutlinedActionButton onClick={simulateLoading}>Simular carregamento</DsOutlinedActionButton>
                </div>
              }
            />
            <div className="space-y-ds-24 p-ds-24">
              <DsTabs value={area} onValueChange={(value) => setArea(String(value))}>
                <DsTabsList>
                  {AREAS.map((item) => (
                    <DsTabsTrigger key={item.id} value={item.id} count={item.id === "operacao" ? leads.length : undefined}>
                      {item.label}
                    </DsTabsTrigger>
                  ))}
                </DsTabsList>

                <DsTabsPanel value="operacao" key="operacao">
                  <div className="space-y-ds-24 ds-fade">
                    {/* Três números que mudam uma decisão; cada um levaria à lista já filtrada. */}
                    <DsDashboardCard className="grid gap-ds-24 p-ds-16 sm:grid-cols-3">
                      <DsStatTile icon={<Inbox size={14} />} label="Aguardando atribuição" value={<DsCountUp value={leads.length} />} />
                      <DsStatTile icon={<UserRoundCheck size={14} />} label="Corretores disponíveis" value={<DsCountUp value={9} />} />
                      <DsStatTile icon={<TriangleAlert size={14} />} label="Prazo em risco" value={<DsCountUp value={atRisk} />} tone={atRisk > 0 ? "warning" : "default"} />
                    </DsDashboardCard>

                    <div className="space-y-ds-12">
                      <DsSectionHeader
                        title="Leads para atribuir"
                        description="Do mais antigo para o mais recente."
                        actions={<DsFilledDarkCta>Atribuir automaticamente</DsFilledDarkCta>}
                      />
                      <DsSegmentedControl aria-label="Filtrar por situação" options={filters} value={filter} onValueChange={setFilter} />

                      <DsSelectionBar count={selected.length}>
                        <DsOutlinedActionButton>Atribuir a corretor</DsOutlinedActionButton>
                        <DsOutlinedActionButton onClick={() => setSelected([])}>Limpar</DsOutlinedActionButton>
                      </DsSelectionBar>

                      {loading ? (
                        <DsDataList aria-busy="true" aria-label="Carregando leads">
                          {Array.from({ length: 4 }).map((_, index) => <DsDataRowSkeleton key={index} />)}
                        </DsDataList>
                      ) : visible.length === 0 ? (
                        <DsEmptyState icon={<Inbox size={20} />} title="Nada nesta situação" description="Mude o filtro ou aguarde novos leads." />
                      ) : (
                        <DsDataList key={filter}>
                          {visible.map((lead, index) => {
                            const status = leadDistributionStatusUi(lead.status);
                            const sla = slaStatusUi(lead.elapsed, 15);
                            return (
                              <DsDataRow
                                key={lead.id}
                                index={index}
                                interactive
                                leading={<DsCheckbox aria-label={`Selecionar ${lead.name}`} checked={selected.includes(lead.id)} onCheckedChange={() => toggle(lead.id)} />}
                                title={lead.name}
                                description={`${lead.source} · ${lead.unit}`}
                                actions={
                                  <>
                                    {/* Tempo em tinta neutra: a única cor da linha é a do badge de estado. O risco vai no texto (e em negrito). */}
                                    <span className={`hidden items-center gap-ds-4 text-ds-caption tabular-nums sm:inline-flex ${sla.tone === "success" ? "text-ds-fog" : "font-semibold text-ds-charcoal"}`}>
                                      <Clock size={12} aria-hidden="true" />
                                      {lead.elapsed} min{sla.tone !== "success" ? ` · ${sla.label.toLowerCase()}` : ""}
                                    </span>
                                    <DsStatusBadge status={status.tone} label={status.label} />
                                    <DsOutlinedActionButton>Atribuir <ArrowUpRight size={12} aria-hidden="true" /></DsOutlinedActionButton>
                                    <IconButton label={`Mais ações para ${lead.name}`} />
                                  </>
                                }
                              />
                            );
                          })}
                        </DsDataList>
                      )}
                    </div>
                  </div>
                </DsTabsPanel>

                {AREAS.filter((item) => item.id !== "operacao").map((item) => (
                  <DsTabsPanel key={item.id} value={item.id}>
                    <DsEmptyState icon={<CalendarDays size={20} />} title={`${item.label}: no lote correspondente`} description="Esta área será redesenhada com este mesmo padrão." />
                  </DsTabsPanel>
                ))}
              </DsTabs>
            </div>
          </div>
        </Block>

        <Block title="2. Drawer lateral" note="Editar fila, plantão ou regra sem sair da lista. Esc fecha; o foco fica preso no painel.">
          <DsSheet>
            <DsSheetTrigger render={<DsOutlinedActionButton type="button">Abrir exemplo de edição de fila</DsOutlinedActionButton>} />
            <DsSheetContent>
              <DsSheetHeader>
                <DsSheetTitle>Fila Verão — Centro</DsSheetTitle>
                <DsSheetDescription>Ajuste o destino e a elegibilidade desta fila.</DsSheetDescription>
              </DsSheetHeader>
              <DsSheetBody>
                <DsSheetSection title="Destino" description="Para onde os leads desta fila vão.">
                  <div className="flex items-center justify-between gap-ds-16 rounded-ds-cards border border-ds-ash p-ds-16">
                    <div>
                      <p className="text-ds-body font-semibold">Atribuição automática</p>
                      <p className="text-ds-caption text-ds-fog">Ligada: o motor escolhe o corretor. Desligada: o lead fica no inbox.</p>
                    </div>
                    <DsSwitch checked={auto} onCheckedChange={setAuto} aria-label="Atribuição automática" />
                  </div>
                </DsSheetSection>
                <DsSheetSection title="Elegibilidade">
                  <DsCallout tone="info" title="Só corretores disponíveis entram na rodada" icon={<Sparkles size={16} />}>
                    <p>Quem está em pausa ou offline é ignorado até voltar.</p>
                  </DsCallout>
                </DsSheetSection>
              </DsSheetBody>
              <DsSheetFooter>
                <DsOutlinedActionButton type="button">Cancelar</DsOutlinedActionButton>
                <DsFilledDarkCta type="button">Salvar alterações</DsFilledDarkCta>
              </DsSheetFooter>
            </DsSheetContent>
          </DsSheet>
        </Block>

        <Block title="3. Lista de filas — uma cor por linha" note="Um único badge de estado; atributos viram etiquetas neutras (antes: 3 badges coloridos no mesmo cabeçalho).">
          <DsDataList>
            {[
              { name: "Fila Verão — Centro", unit: "Unidade Centro", status: "active" },
              { name: "Fila Saúde — Norte", unit: "Unidade Norte", status: "active" },
              { name: "Fila Corporativo", unit: "Todas as unidades", status: "paused" },
            ].map((queue, index) => {
              const status = queueStatusUi(queue.status);
              return (
                <DsDataRow
                  key={queue.name}
                  index={index}
                  interactive
                  leading={<DsStatusBadge status={status.tone} label={status.label} />}
                  title={queue.name}
                  description={`${queue.unit} · Round robin`}
                  meta={
                    <>
                      <DsMetaChip icon={<CalendarDays size={12} />}>Plantão</DsMetaChip>
                      <DsMetaChip icon={<Sparkles size={12} />}>Bot IA</DsMetaChip>
                    </>
                  }
                  actions={<DsOutlinedActionButton>Editar</DsOutlinedActionButton>}
                />
              );
            })}
          </DsDataList>
        </Block>

        <Block title="4. Callouts e controles" note="Só ícone, borda e fundo carregam a cor; o texto é sempre Charcoal.">
          <div className="grid gap-ds-12 md:grid-cols-2">
            <DsCallout tone="info" title="Simulação" icon={<Sparkles size={16} />}><p>Teste uma regra sem afetar nenhum lead real.</p></DsCallout>
            <DsCallout tone="success" title="Regra salva" icon={<UserRoundCheck size={16} />}><p>Vale para os próximos leads.</p></DsCallout>
            <DsCallout tone="warning" title="3 leads com prazo vencendo" icon={<TriangleAlert size={16} />} action={<DsOutlinedActionButton>Ver leads</DsOutlinedActionButton>}><p>Atribua antes de o prazo expirar.</p></DsCallout>
            <DsCallout tone="destructive" title="Falha ao distribuir" icon={<Route size={16} />}><p>O motor não conseguiu escolher um corretor.</p></DsCallout>
          </div>
          <DsDashboardCard className="flex flex-wrap items-center gap-ds-24 p-ds-16">
            <div className="flex items-center gap-ds-12"><DsSwitch defaultChecked aria-label="Ligado" /><DsSwitch aria-label="Desligado" /><DsSwitch disabled aria-label="Desabilitado" /></div>
            <div className="flex items-center gap-ds-12"><DsCheckbox defaultChecked aria-label="Marcado" /><DsCheckbox aria-label="Desmarcado" /><DsCheckbox disabled aria-label="Desabilitado" /></div>
          </DsDashboardCard>
        </Block>
      </main>
    </div>
  );
}
