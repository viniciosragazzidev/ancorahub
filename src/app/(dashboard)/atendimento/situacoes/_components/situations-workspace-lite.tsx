"use client";

/**
 * Atendimento, Situações, no visual Lite. Mesmos dados, filtros, contagens e ações da tela atual: teste de frase,
 * ativação automática (só o papel que pode configurar altera, como hoje), as situações e as sugestões da IA. A linha
 * abre os mesmos painéis de detalhe (SituationDrawer e SuggestionDrawer).
 */
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";

import { LiteFilterChips } from "@/components/lite/controls";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LitePagination, useLitePages } from "@/components/lite/data/pagination";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import { formatLiteDate } from "@/components/lite/format/date";
import sections from "@/components/lite/page/lite-sections.module.css";
import { toast } from "@/components/ui/sonner";
import { testPhraseAction } from "@/features/attendance-situations/actions";
import { SITUATION_ACTION_LABEL, type SituationAction } from "@/features/attendance-situations/catalog";
import type { PhraseExplanation } from "@/features/attendance-situations/explain";
import type { SituationRow } from "@/features/attendance-situations/service";
import { setAutoActivateAction } from "@/features/situation-learning/actions";
import { AUTO_ACTIVATE_MIN_OCCURRENCES } from "@/features/situation-learning/learning";
import type { SuggestionRow } from "@/features/situation-learning/service";

import { SituationDrawer, type SituationTarget } from "./situation-drawer";
import { SuggestionDrawer } from "./suggestion-drawer";
import type { LearningOverview } from "./situations-workspace";

type KindFilter = "all" | SituationRow["kind"] | "suggestions";
type Row = SituationRow & { aiActivated?: boolean };

const KIND_LABEL: Record<SituationRow["kind"], string> = { builtin: "Do sistema", custom: "Da empresa", guided: "Orientação para a IA" };
const RESULT_TITLE: Record<PhraseExplanation["kind"], string> = { builtin: "Situação do sistema", custom: "Situação da empresa", ai: "Gerada pela IA", none: "Sem situação" };

function actionLabel(row: SituationRow) {
  return row.action === "guide" ? "IA responde com base no roteiro" : SITUATION_ACTION_LABEL[row.action as SituationAction];
}

function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function PhraseTesterLite() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<PhraseExplanation | null>(null);
  const [pending, startTransition] = useTransition();
  const run = () => startTransition(async () => {
    const response = await testPhraseAction(text);
    if (!response.success) { toast.error(response.error); return; }
    setResult(response.result);
  });
  return (
    <section className={sections.group} aria-labelledby="phrase-tester-title">
      <div className={sections.row}>
        <div className={sections.rowText}>
          <h2 id="phrase-tester-title" className={sections.rowTitle}>Teste uma frase</h2>
          <p className={sections.rowDescription}>Escreva o que um cliente diria no meio da qualificação e veja qual situação dispara, a resposta e o que acontece. Nada é enviado.</p>
        </div>
      </div>
      <div className={sections.formBody}>
        <div className={page.toolbar}>
          <input className={form.input} style={{ flex: "1 1 240px", width: "auto" }} aria-label="Frase do cliente" value={text} onChange={(event) => setText(event.target.value)} placeholder="Ex.: vocês atendem em Niterói?" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); run(); } }} />
          <button type="button" className={page.button} disabled={pending || !text.trim()} onClick={run}>{pending ? "Testando…" : "Testar frase"}</button>
        </div>
        {result ? (
          <div className={sections.notice} aria-live="polite">
            <div className={sections.badges} style={{ alignItems: "center" }}>
              <span className={page.badge} data-tone={result.kind === "none" ? undefined : "info"}>{RESULT_TITLE[result.kind]}</span>
              <span className={sections.rowTitle}>{result.label}</span>
            </div>
            {result.response ? <p className={sections.value} style={{ whiteSpace: "pre-wrap", fontWeight: 400 }}>{result.response}</p> : null}
            <p className={sections.note}>{result.action}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function SituationsWorkspaceLite({ situations, learning, autoActivatedKeys, initialView, canConfigure }: { situations: SituationRow[]; learning: LearningOverview; autoActivatedKeys: string[]; initialView?: string; canConfigure: boolean }) {
  const router = useRouter();
  const [filter, setFilter] = useState<KindFilter>(initialView === "sugestoes" ? "suggestions" : "all");
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<SituationTarget>(null);
  const [suggestionId, setSuggestionId] = useState<string | null>(null);
  const [savingAuto, startAuto] = useTransition();
  const rowsAll = useMemo<Row[]>(() => situations.map((row) => ({ ...row, aiActivated: autoActivatedKeys.includes(row.key) })), [situations, autoActivatedKeys]);
  const counts = useMemo(() => ({
    all: rowsAll.length,
    builtin: rowsAll.filter((row) => row.kind === "builtin").length,
    custom: rowsAll.filter((row) => row.kind === "custom").length,
    guided: rowsAll.filter((row) => row.kind === "guided").length,
  }), [rowsAll]);
  const needle = normalize(query.trim());
  const rows = (filter === "all" || filter === "suggestions" ? rowsAll : rowsAll.filter((row) => row.kind === filter)).filter((row) => !needle || normalize(row.title).includes(needle));
  const suggestions = learning.suggestions.filter((row) => !needle || normalize(row.title).includes(needle));
  const situationPages = useLitePages(rows, 15);
  const suggestionPages = useLitePages(suggestions, 15);
  const current = target?.mode === "view" ? rowsAll.find((row) => row.id === target.situation.id) : null;
  const drawerTarget: SituationTarget = target?.mode === "view" ? (current ? { mode: "view", situation: current } : null) : target;
  const suggestion = learning.suggestions.find((item) => item.id === suggestionId) ?? null;
  const toggleAuto = (enabled: boolean) => startAuto(async () => {
    const result = await setAutoActivateAction(enabled);
    if (!result.success) { toast.error(result.error); return; }
    toast.success(enabled ? "Ativação automática ligada." : "Ativação automática desligada: toda sugestão passa pela sua aprovação.");
    router.refresh();
  });
  const coverage = learning.coverage.percent === null ? "Sem perguntas nos últimos 30 dias" : `${learning.coverage.percent}% das perguntas cobertas (30 dias)`;

  const situationColumns: LiteColumn<Row>[] = [
    { id: "title", label: "Situação", primary: true, render: (row) => <span><span className={page.cellTitle}>{row.title}</span><span className={page.cellSub}>{row.response || "Sem resposta"}</span></span> },
    { id: "kind", label: "Tipo", render: (row) => <span className={sections.badges}><span className={page.badge} data-tone={row.kind === "custom" ? "info" : undefined}>{KIND_LABEL[row.kind]}</span>{row.aiActivated ? <span className={page.badge}>Ativada pela IA</span> : null}</span> },
    { id: "phrases", label: "Reconhece por", render: (row) => {
      const examples = [...row.phrases, ...row.recognizedBy];
      const taught = row.kind === "builtin" && row.phrases.length ? ` · +${row.phrases.length} ensinadas` : "";
      return <span className={page.muted}>{row.kind === "guided" ? "Quando nenhuma situação cobre a pergunta" : `${examples.slice(0, 2).join(", ")}${taught}`}</span>;
    } },
    { id: "action", label: "O que acontece", render: (row) => actionLabel(row) },
    { id: "enabled", label: "Status", nowrap: true, render: (row) => <span className={page.badge} data-tone={row.critical || row.enabled ? "success" : undefined}>{row.critical ? "Sempre ligada" : row.enabled ? "Ligada" : "Desligada"}</span> },
  ];
  const suggestionColumns: LiteColumn<SuggestionRow>[] = [
    { id: "title", label: "Dúvida dos clientes", primary: true, render: (row) => <span><span className={page.cellTitle}>{row.kind === "merge" ? `Parece "${row.targetTitle ?? row.title}"` : row.title}</span><span className={page.cellSub}>{row.examples.slice(0, 2).join(" · ")}</span></span> },
    { id: "kind", label: "Sugestão", render: (row) => <span className={page.badge} data-tone={row.kind === "merge" ? undefined : "info"}>{row.kind === "merge" ? "Ensinar frases" : "Situação nova"}</span> },
    { id: "occurrences", label: "Vezes", numeric: true, render: (row) => row.occurrences },
    { id: "last", label: "Última vez", nowrap: true, render: (row) => formatLiteDate(row.lastAskedAt, { dateStyle: "short", timeStyle: "short" }, "Sem registro") },
    { id: "source", label: "Resposta", render: (row) => (row.kind === "merge" ? "A da situação" : row.fromBroker ? "Do corretor + IA" : "Sugerida pela IA") },
  ];

  return (
    <>
      <PhraseTesterLite />
      <section className={sections.group} aria-labelledby="learning-title">
        <label className={sections.check}>
          <input type="checkbox" checked={learning.autoActivate} disabled={!canConfigure || savingAuto} onChange={(event) => toggleAuto(event.target.checked)} />
          <span className={sections.rowText}>
            <span id="learning-title" className={sections.rowTitle}>Ativar sugestões automaticamente</span>
            <span className={sections.rowDescription}>Só situações que respondem e seguem, perguntadas {AUTO_ACTIVATE_MIN_OCCURRENCES}+ vezes e com resposta segura.{canConfigure ? "" : " Só o Diretor altera."}</span>
          </span>
        </label>
      </section>
      <section className={page.group} aria-labelledby="situations-title">
        <header className={page.cardHead}>
          <h2 id="situations-title" className={page.cardTitle}>Situações ({situations.length})</h2>
          <p className={page.cardDescription}>O que acontece quando o cliente diz algo fora da pergunta: respostas prontas (do sistema e da empresa) e os roteiros que orientam a IA quando nenhuma situação cobre. {coverage}.</p>
        </header>
        <div className={page.toolbar}>
          <label className={page.search}>
            <Search aria-hidden="true" size={18} className={page.searchIcon} />
            <input className={page.searchInput} value={query} onChange={(event) => { setQuery(event.target.value); situationPages.reset(); suggestionPages.reset(); }} placeholder={filter === "suggestions" ? "Buscar sugestão" : "Buscar situação"} aria-label={filter === "suggestions" ? "Buscar sugestão" : "Buscar situação"} />
          </label>
          <button type="button" className={`${page.primaryButton} ${page.toolbarEnd}`} onClick={() => setTarget({ mode: "new" })}>
            <Plus aria-hidden="true" size={16} />
            Nova situação
          </button>
        </div>
        <LiteFilterChips
          scroll
          label="Filtrar por tipo"
          active={[filter]}
          onToggle={(id) => { setFilter(id as KindFilter); situationPages.reset(); }}
          chips={[
            { id: "all", label: "Todas", count: counts.all },
            { id: "builtin", label: "Do sistema", count: counts.builtin },
            { id: "custom", label: "Da empresa", count: counts.custom },
            { id: "guided", label: "Roteiros da IA", count: counts.guided },
            { id: "suggestions", label: "Sugestões da IA", count: learning.suggestions.length },
          ]}
        />
        {filter === "suggestions" ? (
          <>
            <p className={page.cardDescription}>Perguntas que nenhuma situação cobriu, agrupadas pela IA a cada 30 minutos. Nada entra em uso sem a sua aprovação{learning.autoActivate ? ", exceto o que a ativação automática permitir" : ""}.</p>
            <LiteResponsiveData caption="Sugestões da IA" columns={suggestionColumns} rows={suggestionPages.pageRows} rowKey={(row) => row.id} onRowOpen={(row) => setSuggestionId(row.id)} empty={<p className={page.emptyText}>Nenhuma sugestão agora.</p>} />
            <LitePagination {...suggestionPages.pagination} label="Páginas das sugestões" />
          </>
        ) : (
          <>
            <LiteResponsiveData caption="Situações do atendimento" columns={situationColumns} rows={situationPages.pageRows} rowKey={(row) => row.id} onRowOpen={(row) => setTarget({ mode: "view", situation: row })} empty={<p className={page.emptyText}>Nenhuma situação encontrada.</p>} />
            <LitePagination {...situationPages.pagination} label="Páginas das situações" />
          </>
        )}
      </section>
      <SituationDrawer target={drawerTarget} onClose={() => setTarget(null)} onDone={() => router.refresh()} />
      <SuggestionDrawer suggestion={suggestion} situations={situations} onClose={() => setSuggestionId(null)} onDone={() => router.refresh()} />
    </>
  );
}
