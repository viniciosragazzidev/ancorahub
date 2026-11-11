"use client";

import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { Badge } from "@/components/arc/badge/badge";
import { AppSelect } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { simulateCatalogAction } from "./actions";
import { exportCatalogProposalAction } from "./proposal-action";
import { PlanExplorer } from "./plan-explorer";
import { modalities, type CatalogOptions, type QuoteInput, type QuoteResponse, type QuoteResult } from "./contracts";

export const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const labels: Record<string, string> = { ADESAO: "Saúde por adesão", PME_EMPRESARIAL: "Saúde empresarial / PME", PESSOA_FISICA: "Saúde pessoa física", ADESAO_ODONTO: "Odonto por adesão", PME_EMPRESARIAL_ODONTO: "Odonto empresarial / PME", PESSOA_FISICA_ODONTO: "Odonto pessoa física" };
const initial = { city: "", operator: "", administrator: "", profession: "", entity: "", businessProfile: "", businessMonths: "", accommodation: "", coparticipation: "", coverage: "", dental: "", query: "", budget: "" };

function Choice({ label, value, options, onChange, optional = true }: { label: string; value: string; options: (string | { value: string; label: string })[]; onChange: (v: string) => void; optional?: boolean }) {
  const id = useId();
  return <div className="grid content-start gap-2"><label htmlFor={id} className="text-sm font-medium">{label}</label><AppSelect id={id} value={value || (optional ? "__all" : "")} onValueChange={v => onChange(v === "__all" ? "" : v)} options={[...(optional ? [{ value: "__all", label: "Todos" }] : []), ...options.filter(v => typeof v === "string" ? Boolean(v) : Boolean(v.value)).map(v => typeof v === "string" ? { value: v, label: v.replaceAll("_", " ") } : v)]} /></div>;
}

export function CatalogWorkspace({ options, counts, sourceDate }: { options: CatalogOptions; counts: { plans: number; prices: number }; sourceDate: string }) {
  const [modality, setModality] = useState<QuoteInput["modality"]>("PESSOA_FISICA");
  const [fields, setFields] = useState(initial);
  const [lives, setLives] = useState([{ key: 1, age: "", holder: true, relationship: "Titular" }]);
  const [includeIncompatible, setIncludeIncompatible] = useState(false);
  const [response, setResponse] = useState<QuoteResponse | null>(null);
  const [submitted, setSubmitted] = useState<QuoteInput | null>(null);
  const [selected, setSelected] = useState<QuoteResult[]>([]);
  const [compare, setCompare] = useState(false);
  const [exploring, setExploring] = useState<{ plan: QuoteResult; tab: "conditions" | "network" } | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const request = useRef(0), nextLife = useRef(2), resultsRef = useRef<HTMLElement>(null);
  const cityList = useId();
  function invalidate() { request.current++; setResponse(null); setSelected([]); setSubmitted(null); setError(""); }
  function field(key: keyof typeof initial, value: string) { invalidate(); setFields(previous => ({ ...previous, [key]: value })); }
  function run(input: QuoteInput) {
    const token = ++request.current; setError("");
    start(async () => {
      const result = await simulateCatalogAction(input);
      if (token !== request.current) return;
      if (result.error || !result.data) { setError(result.error || "Não foi possível consultar os planos."); return; }
      setResponse(result.data); setSubmitted(input);
      resultsRef.current?.focus({ preventScroll: true });
    });
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (lives.some(l => l.age.trim() === "")) { setError("Preencha a idade de cada vida para calcular os valores."); return; }
    const rawBudget = fields.budget.trim();
    if (rawBudget && !/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(rawBudget)) { setError("Informe um orçamento positivo, por exemplo 1.500,00."); return; }
    const [whole, fraction = ""] = rawBudget.replaceAll(".", "").split(",");
    const budgetCents = rawBudget ? Number(whole) * 100 + Number(fraction.padEnd(2, "0")) : null;
    if (budgetCents !== null && (!Number.isSafeInteger(budgetCents) || budgetCents <= 0)) { setError("Informe um orçamento positivo, por exemplo 1.500,00."); return; }
    const input: QuoteInput = { ...fields, modality, lives: lives.map(({ age, holder, relationship }) => ({ age: Number(age), holder, relationship })), businessMonths: fields.businessMonths === "" ? null : Number(fields.businessMonths), budgetCents, dental: fields.dental as QuoteInput["dental"], includeIncompatible, page: 1 };
    setSelected([]); run(input);
  }
  function toggle(plan: QuoteResult) { setSelected(previous => previous.some(p => p.id === plan.id) ? previous.filter(p => p.id !== plan.id) : previous.length < 3 ? [...previous, plan] : previous); }
  function exportPlan(plan: QuoteResult) {
    if (!submitted) return;
    start(async () => {
      const result = await exportCatalogProposalAction({ planId: plan.id, profile: submitted });
      if (result.error || !result.data) { setError([result.error, ...(result.reasons || [])].filter(Boolean).join(" ")); return; }
      const bytes = Uint8Array.from(atob(result.data.base64), c => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = result.data.filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
  }
  return <div className="arc-venancor mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-24 pt-4 sm:px-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div className="grid gap-2"><h1 className="text-3xl font-semibold tracking-tight">Encontre o plano certo.</h1><p className="max-w-xl text-sm text-muted-foreground">Informe o perfil, compare os valores por vida e confira as condições e a rede antes de avançar.</p></div><Badge tone="info">Vinicios Ragazzi</Badge></header>
    <Card><CardHeader><CardTitle>Quem vai entrar no plano?</CardTitle><CardDescription>{counts.plans.toLocaleString("pt-BR")} planos no catálogo · consulta comercial de {sourceDate.split("-").reverse().join("/")}</CardDescription></CardHeader><CardContent>
      <form onSubmit={submit} className="grid gap-6">
        <div className="grid items-start gap-4 sm:grid-cols-2"><Choice label="Modalidade" value={modality} optional={false} options={modalities.map(value => ({ value, label: labels[value] }))} onChange={v => { invalidate(); setModality(v as QuoteInput["modality"]); setFields(initial); }} /><Input label="Município de comercialização" list={cityList} placeholder="Ex.: Rio de Janeiro" required value={fields.city} onChange={e => field("city", e.target.value)} /><datalist id={cityList}>{options.cities.map(c => <option key={c} value={c} />)}</datalist></div>
        <fieldset className="grid gap-3"><legend className="mb-3 text-sm font-medium">Vidas e idades completas</legend>{lives.map((life, i) => <div key={life.key} className="grid items-end gap-3 border-b border-border pb-4 sm:grid-cols-[1fr_1fr_auto]">
          <Input label={life.holder ? "Idade do titular" : `Idade do dependente ${i}`} value={life.age} type="number" min={0} max={120} required onChange={e => { invalidate(); setLives(previous => previous.map(l => l.key === life.key ? { ...l, age: e.target.value } : l)); }} />
          {life.holder ? <p className="pb-3 text-sm text-muted-foreground">Um titular por cotação</p> : <Choice optional={false} label="Vínculo com o titular" value={life.relationship} options={["Cônjuge", "Filho(a)", "Enteado(a)", "Pai / mãe", "Outro dependente"]} onChange={relationship => { invalidate(); setLives(previous => previous.map(l => l.key === life.key ? { ...l, relationship } : l)); }} />}
          {!life.holder ? <Button type="button" variant="ghost" aria-label={`Remover dependente ${i}`} onClick={() => { invalidate(); setLives(previous => previous.filter(l => l.key !== life.key)); }}>Remover</Button> : <span />}
        </div>)}<div><Button type="button" variant="secondary" disabled={lives.length >= 100} onClick={() => { invalidate(); setLives(previous => [...previous, { key: nextLife.current++, age: "", holder: false, relationship: "Filho(a)" }]); }}>Adicionar dependente</Button></div></fieldset>
        {modality.startsWith("PME") ? <fieldset className="grid gap-4 sm:grid-cols-2"><legend className="mb-3 text-sm font-medium">Perfil da empresa</legend><Choice label="Tipo de empresa" value={fields.businessProfile} options={options.businessProfiles} onChange={v => field("businessProfile", v)} /><Input label="Tempo de empresa (meses)" type="number" min={0} max={2400} value={fields.businessMonths} onChange={e => field("businessMonths", e.target.value)} description="As exigências de tempo e vínculo aparecem nas condições de cada produto." /></fieldset> : null}
        {modality.startsWith("ADESAO") ? <fieldset className="grid gap-4 sm:grid-cols-2"><legend className="mb-3 text-sm font-medium">Adesão e elegibilidade</legend><Input label="Profissão / categoria profissional" value={fields.profession} onChange={e => field("profession", e.target.value)} description="Será necessário confirmar o vínculo e os documentos exigidos pela entidade." /><Choice label="Entidade" value={fields.entity} options={options.entities} onChange={v => field("entity", v)} /></fieldset> : null}
        <details><summary className="cursor-pointer py-3 text-sm font-medium">Refinar a busca e o orçamento</summary><div className="grid gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
          <Choice label="Operadora" value={fields.operator} options={options.operators} onChange={v => field("operator", v)} /><Choice label="Administradora" value={fields.administrator} options={options.administrators} onChange={v => field("administrator", v)} /><Choice label="Acomodação" value={fields.accommodation} options={options.accommodations} onChange={v => field("accommodation", v)} /><Choice label="Coparticipação" value={fields.coparticipation} options={options.coparticipations} onChange={v => field("coparticipation", v)} /><Choice label="Abrangência" value={fields.coverage} options={options.coverages} onChange={v => field("coverage", v)} /><Choice label="Odonto incluso" value={fields.dental} options={[{ value: "yes", label: "Sim" }, { value: "no", label: "Não" }, { value: "unknown", label: "Sem confirmação" }]} onChange={v => field("dental", v)} /><Input label="Plano ou código" value={fields.query} onChange={e => field("query", e.target.value)} /><Input label="Orçamento mensal total (R$)" inputMode="decimal" value={fields.budget} placeholder="Ex.: 1.500,00" onChange={e => field("budget", e.target.value)} /><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={includeIncompatible} onChange={e => { invalidate(); setIncludeIncompatible(e.target.checked); }} />Ver também perfis incompatíveis</label>
        </div></details>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-4"><p className="max-w-lg text-xs text-muted-foreground">Os valores vêm da tabela vigente da base consultada. Condições ainda pendentes exigem revisão comercial antes de uma proposta.</p><Button type="submit" loading={pending}>Buscar planos</Button></div>
      </form>
    </CardContent></Card>
    <section ref={resultsRef} tabIndex={-1} aria-label="Resultados da cotação" aria-busy={pending} className="grid gap-4 outline-none">
      {!response ? <p role="status" className="py-6 text-center text-sm text-muted-foreground">{pending ? "Conferindo preços e condições…" : "Preencha o perfil para consultar os planos disponíveis."}</p> : <>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">{response.total.toLocaleString("pt-BR")} planos encontrados</h2><p role="status" className="text-sm text-muted-foreground">Menor valor primeiro · {response.pending} com pendências · {response.incompatible} incompatíveis com o perfil</p></div><Button variant="secondary" disabled={selected.length < 2} onClick={() => setCompare(true)}>Comparar ({selected.length}/3)</Button></div>
        {response.total === 0 ? <Card><CardContent className="grid gap-2 py-8"><h3 className="font-medium">Nenhum plano para este perfil.</h3><p className="text-sm text-muted-foreground">Revise a modalidade, as idades, o município e os filtros. Planos sem preço vigente para todas as vidas não entram no resultado.</p></CardContent></Card> : <div className="grid gap-4 lg:grid-cols-2">{response.results.map(plan => <Card key={plan.id}><CardHeader><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-muted-foreground">{plan.operator}{plan.administrator ? ` · ${plan.administrator}` : ""}</p><CardTitle className="mt-2 break-words text-lg">{plan.name}</CardTitle></div><Badge tone={plan.state === "ready" ? "success" : plan.state === "pending" ? "warning" : "danger"}>{plan.state === "ready" ? "Revisado" : plan.state === "pending" ? "Revisão necessária" : "Incompatível"}</Badge></div><CardDescription>{[plan.accommodation, plan.coparticipation, plan.coverage].filter(Boolean).join(" · ")}</CardDescription></CardHeader><CardContent className="grid gap-4"><div><p className="text-2xl font-semibold tabular-nums">{money(plan.totalCents)}<span className="ml-1 text-sm font-normal text-muted-foreground">/ mês</span></p><p className="text-xs text-muted-foreground">Total de {plan.perLife.length} vida(s) · {plan.networkCount.toLocaleString("pt-BR")} unidades na rede consultada</p></div>
          <details><summary className="cursor-pointer text-sm">Valores por vida</summary><ul className="mt-3 grid gap-2 text-sm">{plan.perLife.map((l, i) => <li key={i} className="flex justify-between gap-4"><span>{l.holder ? "Titular" : `Dependente ${i}`} · {l.age} anos</span><span className="tabular-nums">{money(l.cents)}</span></li>)}</ul></details>
          {plan.reasons.length ? <details><summary className="cursor-pointer text-sm font-medium">Conferir {plan.reasons.length} pendência(s) e restrições</summary><ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">{plan.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></details> : null}
          <div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" onClick={() => setExploring({ plan, tab: "conditions" })}>Condições e documentos</Button><Button variant="ghost" size="sm" onClick={() => setExploring({ plan, tab: "network" })}>Ver rede</Button></div>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={selected.some(p => p.id === plan.id)} disabled={selected.length >= 3 && !selected.some(p => p.id === plan.id)} onChange={() => toggle(plan)} />Comparar este plano</label>
          {plan.state === "ready" ? <Button variant="secondary" loading={pending} onClick={() => exportPlan(plan)}>Gerar proposta em PDF</Button> : <p className="border-t border-border pt-3 text-xs text-muted-foreground">Proposta final, PDF e envio ao cliente bloqueados até a revisão das condições.</p>}
        </CardContent></Card>)}</div>}
        <div className="flex items-center justify-center gap-4"><Button variant="ghost" disabled={pending || response.page <= 1} onClick={() => submitted && run({ ...submitted, page: response.page - 1 })}>Anterior</Button><span className="text-sm">{response.page} de {response.pages}</span><Button variant="ghost" disabled={pending || response.page >= response.pages} onClick={() => submitted && run({ ...submitted, page: response.page + 1 })}>Próxima</Button></div>
      </>}
    </section>
    <Sheet open={compare} onOpenChange={setCompare}><SheetContent className="sm:data-[side=right]:w-[min(95vw,64rem)]"><SheetHeader><SheetTitle>Comparar planos</SheetTitle><SheetDescription>Alternativas independentes. Os valores não se somam entre planos.</SheetDescription></SheetHeader><div className="grid gap-6 overflow-y-auto p-5 sm:grid-cols-3">{selected.map(p => <section key={p.id} className="grid content-start gap-4"><p className="text-xs text-muted-foreground">{p.operator}</p><h3 className="font-semibold">{p.name}</h3><p className="text-xl font-semibold">{money(p.totalCents)}</p><dl className="grid gap-3 text-sm">{[["Acomodação", p.accommodation], ["Coparticipação", p.coparticipation], ["Abrangência", p.coverage], ["Entidade", p.entity], ["Odonto", p.dental === null ? "Sem confirmação" : p.dental ? "Incluso" : "Não incluso"], ["Rede consultada", `${p.networkCount} unidades`]].map(([key, value]) => <div key={key}><dt className="text-muted-foreground">{key}</dt><dd className="break-words">{value || "Não informado"}</dd></div>)}</dl><ul className="list-disc space-y-2 pl-4 text-xs text-muted-foreground">{p.reasons.map(r => <li key={r}>{r}</li>)}</ul><Button variant="secondary" onClick={() => { setCompare(false); setExploring({ plan: p, tab: "conditions" }); }}>Abrir condições</Button><Button variant="ghost" onClick={() => toggle(p)}>Retirar da comparação</Button></section>)}</div></SheetContent></Sheet>
    {exploring ? <PlanExplorer plan={exploring.plan} initialTab={exploring.tab} onClose={() => setExploring(null)} /> : null}
  </div>;
}
