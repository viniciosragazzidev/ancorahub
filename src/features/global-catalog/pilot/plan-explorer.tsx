"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { AppSelect } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { getCatalogNetworkAction, getCatalogPlanAction } from "./actions";
import { activeAt, fold } from "./engine";
import type { PlanDetail, QuoteResult } from "./contracts";

const display = (value: unknown): string => value === null || value === undefined || value === "" ? "Não informado" : typeof value === "boolean" ? value ? "Sim" : "Não" : typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
const name = (key: string) => key.replaceAll("_", " ").replace(/^./, c => c.toUpperCase());
const titles: Record<string, string> = { observacoes: "Observações comerciais", informacoes_adicionais: "Informações adicionais", subtipo_contrato: "Categoria tarifária / grupo", entidades: "Entidades", area_atendimento: "Área de atendimento", area_comercializacao: "Área de comercialização", regras_idade_especiais: "Regras especiais de idade", formacao_grupo: "Formação do grupo", regra_idade_fonte: "Fonte das regras de idade", regra_elegibilidade_fonte: "Fonte de elegibilidade", perfis_cnpj_fonte: "Fonte dos perfis de empresa", ultima_atualizacao: "Última atualização da tabela", periodo_odontologico_promocional: "Período promocional do odontológico", valor_odontologico: "Valor odontológico" };

function SourceText({ text }: { text: string }) {
  return <>{text.split(/(https?:\/\/[^\s<>"'\]\)]+)/g).map((part, i) => /^https?:\/\//.test(part) ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-4">{part}</a> : part)}</>;
}

function Fields({ value }: { value: Record<string, unknown> }) {
  return <dl className="grid gap-4">{Object.entries(value).map(([key, val]) => <div key={key}><dt className="text-xs font-medium text-muted-foreground">{titles[key] || name(key)}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm"><SourceText text={display(val)} /></dd></div>)}</dl>;
}

export function PlanExplorer({ plan, initialTab, onClose }: { plan: QuoteResult; initialTab: "conditions" | "network"; onClose: () => void }) {
  const [tab, setTab] = useState(initialTab);
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [network, setNetwork] = useState<Awaited<ReturnType<typeof getCatalogNetworkAction>>["data"]>();
  const [filters, setFilters] = useState({ query: "", city: "", type: "", specialty: "" });
  const [search, setSearch] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const request = useRef(0);
  function loadNetwork(page = 1) {
    const token = ++request.current; setError("");
    start(async () => { const result = await getCatalogNetworkAction({ id: plan.id, ...filters, page }); if (token !== request.current) return; setNetwork(result.data); setError(result.error || ""); });
  }
  useEffect(() => {
    let current = true;
    start(async () => { const result = await getCatalogPlanAction(plan.id); if (!current) return; setDetail(result.data || null); setError(result.error || ""); });
    return () => { current = false; request.current++; };
  }, [plan.id]);
  useEffect(() => {
    if (tab !== "network") return;
    let current = true;
    start(async () => { const result = await getCatalogNetworkAction({ id: plan.id, page: 1 }); if (!current) return; setNetwork(result.data); setError(result.error || ""); });
    return () => { current = false; request.current++; };
  }, [plan.id, tab]);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const shown = detail?.details.filter(d => (showHistory || (d.ativo !== false && activeAt(d.vigencia_inicio || null, d.vigencia_fim || null, date))) && (!search || fold([d.titulo, d.tipo_detalhe, d.resumo, d.conteudo, d.descricao].join(" ")).includes(fold(search)))) || [];
  return <Sheet open onOpenChange={open => { if (!open) onClose(); }}><SheetContent className="sm:data-[side=right]:w-[min(95vw,48rem)]"><SheetHeader><SheetTitle>{plan.name}</SheetTitle><SheetDescription>{plan.operator} · {plan.administrator || "Contratação direta"}</SheetDescription></SheetHeader>
    <div className="flex shrink-0 gap-2 border-b border-border p-4"><Button variant={tab === "conditions" ? "primary" : "ghost"} onClick={() => setTab("conditions")} aria-pressed={tab === "conditions"}>Condições</Button><Button variant={tab === "network" ? "primary" : "ghost"} onClick={() => setTab("network")} aria-pressed={tab === "network"}>Rede credenciada</Button></div>
    <div className="grid content-start gap-5 overflow-y-auto p-5" aria-busy={pending}>
      {error ? <div role="alert" className="grid gap-3 text-sm"><p>{error}</p><Button variant="secondary" onClick={() => tab === "network" ? loadNetwork() : start(async () => { const result = await getCatalogPlanAction(plan.id); setDetail(result.data || null); setError(result.error || ""); })}>Tentar novamente</Button></div> : null}
      {tab === "conditions" ? <>
        {plan.reasons.length ? <section className="grid gap-2 border-b border-border pb-5"><h3 className="font-medium">Antes de formalizar</h3><ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">{plan.reasons.map(r => <li key={r}>{r}</li>)}</ul></section> : null}
        {!detail ? <p role="status" className="text-sm text-muted-foreground">{pending ? "Carregando condições e documentos…" : "As condições não puderam ser carregadas."}</p> : <>
          <details><summary className="cursor-pointer text-sm font-medium">Resumo e regras do produto</summary><div className="pt-4"><Fields value={Object.fromEntries(Object.entries(detail.plan).filter(([key]) => key in titles))} /></div></details>
          <Input label="Buscar nas condições" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Ex.: carência, reembolso, documentação" />
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={showHistory} onChange={e => setShowHistory(e.target.checked)} />Incluir condições inativas ou fora da vigência</label>
          <p role="status" className="text-xs text-muted-foreground">{shown.length} de {detail.details.length} condições · fonte consultada em 11/11/2026</p>
          {shown.map(d => <details key={d.id} className="border-b border-border pb-4"><summary className="cursor-pointer text-sm font-medium">{d.titulo || name(d.tipo_detalhe || "Condição")}{d.ativo === false ? " · inativa" : ""}</summary><div className="grid gap-3 pt-4"><p className="text-xs text-muted-foreground">{d.fonte || "Fonte não informada"}{d.vigencia_inicio ? ` · início ${d.vigencia_inicio}` : ""}{d.vigencia_fim ? ` · fim ${d.vigencia_fim}` : ""}</p><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{d.conteudo || d.descricao || d.resumo || "Sem texto complementar."}</p>{d.conteudo_estruturado ? <details><summary className="cursor-pointer text-xs text-muted-foreground">Informações estruturadas da condição</summary><div className="pt-3">{typeof d.conteudo_estruturado === "object" && !Array.isArray(d.conteudo_estruturado) ? <Fields value={d.conteudo_estruturado as Record<string, unknown>} /> : <p className="whitespace-pre-wrap break-words text-xs">{display(d.conteudo_estruturado)}</p>}</div></details> : null}</div></details>)}
          {!shown.length ? <p className="text-sm text-muted-foreground">Nenhuma condição corresponde à busca e à vigência escolhidas.</p> : null}
          <details><summary className="cursor-pointer text-xs text-muted-foreground">Todos os atributos e tabelas de preço da fonte</summary><div className="pt-4"><Fields value={detail.plan} /></div></details>
        </>}
      </> : <>
        <p className="text-sm text-muted-foreground">A rede reflete a consulta da fonte. Confira a competência, os serviços e as observações da unidade antes de orientar o cliente.</p>
        <form onSubmit={e => { e.preventDefault(); loadNetwork(); }} className="grid gap-4 sm:grid-cols-2"><Input label="Hospital, clínica, bairro ou endereço" value={filters.query} onChange={e => setFilters(v => ({ ...v, query: e.target.value }))} /><Input label="Especialidade ou serviço" value={filters.specialty} onChange={e => setFilters(v => ({ ...v, specialty: e.target.value }))} />{(["city", "type"] as const).map(key => <div key={key} className="grid gap-2"><label htmlFor={`network-${key}`} className="text-sm font-medium">{key === "city" ? "Município da unidade" : "Tipo de unidade"}</label><AppSelect id={`network-${key}`} value={filters[key] || "__all"} onValueChange={value => setFilters(v => ({ ...v, [key]: value === "__all" ? "" : value }))} options={[{ value: "__all", label: "Todos" }, ...(key === "city" ? network?.cities || [] : network?.types || []).map(value => ({ value, label: value }))]} /></div>)}<div className="sm:col-span-2"><Button type="submit" variant="secondary" loading={pending}>Filtrar rede</Button></div></form>
        {!network ? <p role="status" className="text-sm text-muted-foreground">{pending ? "Carregando a rede deste plano…" : "Nenhuma rede carregada."}</p> : <>
          <p role="status" className="text-sm text-muted-foreground">{network.total} unidades encontradas · {network.overall} no plano</p>
          {network.units.map(unit => <article key={unit.id} className="grid gap-2 border-b border-border pb-4"><h3 className="font-medium">{unit.nome || "Unidade sem nome"}</h3><p className="text-sm text-muted-foreground">{[unit.tipo, unit.cidade, unit.bairro].filter(Boolean).join(" · ")}</p>{unit.endereco ? <p className="text-sm">{unit.endereco}{unit.cep ? ` · CEP ${unit.cep}` : ""}</p> : null}{unit.telefone ? <p className="text-sm">Telefone: {unit.telefone}</p> : null}<details><summary className="cursor-pointer text-sm">Serviços, contatos, fonte e observações</summary><div className="pt-4"><Fields value={unit} /></div></details></article>)}
          {!network.total ? <p className="text-sm text-muted-foreground">Nenhuma unidade neste filtro. Tente outro município, termo ou serviço.</p> : null}
          <div className="flex items-center justify-between gap-3"><Button variant="ghost" disabled={pending || network.page <= 1} onClick={() => loadNetwork(network.page - 1)}>Anterior</Button><span className="text-sm">{network.page} de {network.pages}</span><Button variant="ghost" disabled={pending || network.page >= network.pages} onClick={() => loadNetwork(network.page + 1)}>Próxima</Button></div>
        </>}
      </>}
    </div>
  </SheetContent></Sheet>;
}
