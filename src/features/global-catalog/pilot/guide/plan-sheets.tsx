"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import BottomSheet from "@/components/arc/bottom-sheet/bottom-sheet";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";

import type { PlanDetail, QuoteResult, SourceDetail } from "../contracts";
import { activeAt, fold } from "../engine";
import { coverageLabel, money } from "./plan-cards";
import styles from "./quote-guide.module.css";

/** Ações de servidor da cotação, injetadas (a página real usa as do piloto; o /dev usa exemplos). */
export type NetworkPage = { units: Array<{ id: string; nome?: string; cidade?: string; bairro?: string; tipo?: string; endereco?: string; cep?: string; telefone?: string }>; total: number; overall: number; page: number; pages: number; cities: string[]; types: string[] };
export type QuoteGuideServices = {
  simulate: (input: unknown) => Promise<{ data?: import("../contracts").QuoteResponse; error?: string }>;
  plan: (id: string) => Promise<{ data?: PlanDetail; error?: string }>;
  network: (input: { id: string; query?: string; city?: string; type?: string; specialty?: string; page?: number }) => Promise<{ data?: NetworkPage; error?: string }>;
  exportPdf: (input: { planId: string; profile: unknown }) => Promise<{ data?: { base64: string; filename: string }; error?: string; reasons?: string[] }>;
};

const TITLES: Record<string, string> = { observacoes: "Observações comerciais", informacoes_adicionais: "Informações adicionais", subtipo_contrato: "Categoria tarifária", entidades: "Entidades", area_atendimento: "Área de atendimento", area_comercializacao: "Área de comercialização", regras_idade_especiais: "Regras especiais de idade", formacao_grupo: "Formação do grupo", ultima_atualizacao: "Última atualização da tabela" };
const humanize = (key: string) => key.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
const display = (value: unknown): string => value === null || value === undefined || value === "" ? "Não informado" : typeof value === "boolean" ? (value ? "Sim" : "Não") : typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);

function SourceText({ text }: { text: string }) {
  return <>{text.split(/(https?:\/\/[^\s<>"'\])]+)/g).map((part, index) => /^https?:\/\//.test(part) ? <a key={index} href={part} target="_blank" rel="noopener noreferrer">{part}</a> : part)}</>;
}

function Chevron() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3.5 4.5 4.5L6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function SearchIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>;
}

/** Uma linha que abre: título e, ao tocar, o texto completo. */
function Row({ title, children, index }: { title: string; children: React.ReactNode; index: number }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  return (
    <motion.div className={styles.row} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: Math.min(index, 8) * 0.035 }}>
      <button type="button" className={styles.rowHead} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span>{title}</span>
        <Chevron />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }} transition={{ duration: 0.22 }} style={{ overflow: "hidden" }}>
            <div className={styles.rowBody}>{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

function Skeletons() {
  return <div className={styles.rows} aria-hidden="true">{[0, 1, 2, 3].map((index) => <div key={index} className={styles.skeleton} />)}</div>;
}

/** Condições e rede de um plano, num painel que sobe de baixo (Lite: denso fica no painel, não na conversa). */
export function PlanSheet({ plan, initialTab, services, onClose }: { plan: QuoteResult; initialTab: "conditions" | "network"; services: QuoteGuideServices; onClose: () => void }) {
  const [tab, setTab] = useState(initialTab);
  return (
    <BottomSheet open onOpenChange={(open) => { if (!open) onClose(); }} title={plan.name} description={[plan.operator, plan.administrator || "Contratação direta"].join(" · ")} detents={[0.92]} closeLabel="Fechar" className="arc-venancor">
      <div className={styles.sheet}>
        <div className={styles.sheetIntro}>
          <span className={styles.sheetPrice}>{money(plan.totalCents)} <span className={styles.priceUnit}>/mês</span></span>
          <p className={styles.muted}>{[plan.accommodation, plan.coparticipation, coverageLabel(plan.coverage)].filter(Boolean).join(" · ")}</p>
        </div>
        <SegmentedControl label="O que ver" value={tab} onValueChange={(value) => setTab(value as typeof tab)} options={[{ value: "conditions", label: "Condições" }, { value: "network", label: `Rede${plan.networkCount ? ` (${plan.networkCount.toLocaleString("pt-BR")})` : ""}` }]} />
        {tab === "conditions" ? <Conditions plan={plan} services={services} /> : <Network plan={plan} services={services} />}
      </div>
    </BottomSheet>
  );
}

function Conditions({ plan, services }: { plan: QuoteResult; services: QuoteGuideServices }) {
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [history, setHistory] = useState(false);
  const [pending, start] = useTransition();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    start(async () => {
      const result = await services.plan(plan.id);
      if (!alive) return;
      setDetail(result.data ?? null);
      setError(result.error ?? "");
    });
    return () => { alive = false; };
  }, [attempt, plan.id, services]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const shown = useMemo<SourceDetail[]>(() => detail?.details.filter((item) => (history || (item.ativo !== false && activeAt(item.vigencia_inicio || null, item.vigencia_fim || null, today)))
    && (!search || fold([item.titulo, item.tipo_detalhe, item.resumo, item.conteudo, item.descricao].join(" ")).includes(fold(search)))) ?? [], [detail, history, search, today]);
  return (
    <>
      {plan.reasons.length ? (
        <div className={styles.notice}>
          <p className={styles.noticeTitle}>Antes de formalizar</p>
          <ul className={styles.reasonList}>{plan.reasons.map((reason) => <li key={reason}><span className={styles.reasonDot} aria-hidden="true" />{reason}</li>)}</ul>
        </div>
      ) : null}
      {error ? (
        <div role="alert" className={styles.notice}>
          <p className={styles.noticeTitle}>{error}</p>
          <div><button type="button" className={styles.action} onClick={() => setAttempt((value) => value + 1)}>Tentar de novo</button></div>
        </div>
      ) : null}
      {!detail ? (pending ? <Skeletons /> : null) : (
        <>
          <label className={styles.field}><SearchIcon /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar: carência, reembolso, documentos" aria-label="Buscar nas condições" /></label>
          <label className={styles.toggle}><input type="checkbox" checked={history} onChange={(event) => setHistory(event.target.checked)} />Mostrar também condições fora da vigência</label>
          <p className={styles.muted} role="status">{shown.length} de {detail.details.length} condições</p>
          <div className={styles.rows}>
            {Object.keys(detail.plan).some((key) => key in TITLES) ? (
              <Row title="Resumo e regras do produto" index={0}>
                {Object.entries(detail.plan).filter(([key]) => key in TITLES).map(([key, value]) => (
                  <div key={key}><p className={styles.muted}>{TITLES[key]}</p><p className={styles.rowText}><SourceText text={display(value)} /></p></div>
                ))}
              </Row>
            ) : null}
            {shown.map((item, index) => (
              <Row key={item.id} title={`${item.titulo || humanize(item.tipo_detalhe || "Condição")}${item.ativo === false ? " (inativa)" : ""}`} index={index + 1}>
                <p className={styles.muted}>{[item.fonte || "Fonte não informada", item.vigencia_inicio ? `início ${item.vigencia_inicio}` : null, item.vigencia_fim ? `fim ${item.vigencia_fim}` : null].filter(Boolean).join(" · ")}</p>
                <p className={styles.rowText}><SourceText text={item.conteudo || item.descricao || item.resumo || "Sem texto complementar."} /></p>
              </Row>
            ))}
          </div>
          {!shown.length ? <p className={styles.muted}>Nenhuma condição com essa busca. Tente outra palavra.</p> : null}
        </>
      )}
    </>
  );
}

function Network({ plan, services }: { plan: QuoteResult; services: QuoteGuideServices }) {
  const [data, setData] = useState<NetworkPage | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [pending, start] = useTransition();
  const request = useRef(0);
  useEffect(() => {
    const token = ++request.current;
    const timer = window.setTimeout(() => start(async () => {
      const result = await services.network({ id: plan.id, query, city, type, page });
      if (token !== request.current) return;
      setData(result.data ?? null);
      setError(result.error ?? "");
    }), query ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [city, page, plan.id, query, services, type]);
  return (
    <>
      <label className={styles.field}><SearchIcon /><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Hospital, clínica, bairro ou endereço" aria-label="Buscar na rede" /></label>
      {data?.cities.length ? (
        <div className={styles.chipRow} role="group" aria-label="Município da unidade">
          <button type="button" className={styles.chipButton} aria-pressed={!city} onClick={() => { setCity(""); setPage(1); }}>Todos</button>
          {data.cities.map((value) => <button key={value} type="button" className={styles.chipButton} aria-pressed={city === value} onClick={() => { setCity(city === value ? "" : value); setPage(1); }}>{value}</button>)}
        </div>
      ) : null}
      {data?.types.length ? (
        <div className={styles.chipRow} role="group" aria-label="Tipo de unidade">
          <button type="button" className={styles.chipButton} aria-pressed={!type} onClick={() => { setType(""); setPage(1); }}>Todos os tipos</button>
          {data.types.map((value) => <button key={value} type="button" className={styles.chipButton} aria-pressed={type === value} onClick={() => { setType(type === value ? "" : value); setPage(1); }}>{value}</button>)}
        </div>
      ) : null}
      {error ? <div role="alert" className={styles.notice}><p className={styles.noticeTitle}>{error}</p></div> : null}
      {!data ? (pending ? <Skeletons /> : null) : (
        <>
          <p className={styles.muted} role="status">{data.total.toLocaleString("pt-BR")} {data.total === 1 ? "unidade" : "unidades"} · {data.overall.toLocaleString("pt-BR")} no plano. Confira os serviços da unidade antes de orientar o cliente.</p>
          <div className={styles.rows} aria-busy={pending}>
            {data.units.map((unit, index) => (
              <motion.article key={unit.id} className={styles.unit} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: Math.min(index, 8) * 0.03 }}>
                <p className={styles.unitName}>{unit.nome || "Unidade sem nome"}</p>
                <p className={styles.unitMeta}>{[unit.tipo, unit.bairro, unit.cidade].filter(Boolean).join(" · ")}</p>
                {unit.endereco ? <p className={styles.unitMeta}>{unit.endereco}{unit.cep ? `, CEP ${unit.cep}` : ""}</p> : null}
                {unit.telefone ? <p className={styles.unitMeta}>Telefone {unit.telefone}</p> : null}
              </motion.article>
            ))}
          </div>
          {!data.total ? <p className={styles.muted}>Nenhuma unidade com esse filtro. Tente outro município ou termo.</p> : null}
          {data.pages > 1 ? (
            <div className={styles.pager}>
              <button type="button" className={styles.action} disabled={pending || data.page <= 1} onClick={() => setPage(data.page - 1)}>Anterior</button>
              <span>{data.page} de {data.pages}</span>
              <button type="button" className={styles.action} disabled={pending || data.page >= data.pages} onClick={() => setPage(data.page + 1)}>Próxima</button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}

/** Lado a lado (até 3). O mais barato fica destacado; o que muda entre eles fica em azul. */
export function CompareSheet({ plans, onClose, onOpen, onRemove }: { plans: QuoteResult[]; onClose: () => void; onOpen: (plan: QuoteResult) => void; onRemove: (plan: QuoteResult) => void }) {
  const cheapest = Math.min(...plans.map((plan) => plan.totalCents));
  const rows: Array<[string, (plan: QuoteResult) => string]> = [
    ["Por mês", (plan) => money(plan.totalCents)],
    ["Acomodação", (plan) => plan.accommodation || "Não informado"],
    ["Coparticipação", (plan) => plan.coparticipation || "Não informado"],
    ["Abrangência", (plan) => coverageLabel(plan.coverage) || "Não informado"],
    ["Entidade", (plan) => plan.entity || "Não se aplica"],
    ["Odonto", (plan) => plan.dental === null ? "Sem confirmação" : plan.dental ? "Incluso" : "Não incluso"],
    ["Rede", (plan) => `${plan.networkCount.toLocaleString("pt-BR")} unidades`],
    ["Para conferir", (plan) => plan.reasons.length ? `${plan.reasons.length} pontos` : "Nada"],
  ];
  return (
    <BottomSheet open onOpenChange={(open) => { if (!open) onClose(); }} title="Comparar planos" description="Alternativas independentes: os valores não se somam." detents={[0.92]} closeLabel="Fechar" className="arc-venancor">
      <div className={styles.sheet}>
        <div className={styles.compare}>
          {plans.map((plan) => (
            <section key={plan.id} className={styles.compareCol} data-best={plan.totalCents === cheapest}>
              <div>
                <p className={styles.who}>{plan.operator}</p>
                <h3 className={styles.name}>{plan.name}</h3>
              </div>
              <dl className={styles.compareList}>
                {rows.map(([label, value]) => {
                  const text = value(plan);
                  const differs = new Set(plans.map(value)).size > 1;
                  return <div key={label}><dt>{label}</dt><dd className={differs ? styles.diff : undefined}>{text}</dd></div>;
                })}
              </dl>
              <div className={styles.actions}>
                <button type="button" className={styles.action} onClick={() => onOpen(plan)}>Condições</button>
                <button type="button" className={styles.action} onClick={() => onRemove(plan)}>Tirar</button>
              </div>
            </section>
          ))}
        </div>
      </div>
    </BottomSheet>
  );
}
