"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { ChatScreen, type CustomBlockApi } from "@/components/chat/chat-screen";
import type { ChatBlock, ChatChoice, ChatScript } from "@/components/chat/types";
import { ASSISTANTS } from "@/features/broker-workspace/chat/assistant-scripts";
import { useFeedback } from "@/lib/feedback/use-feedback";

import type { QuoteInput, QuoteResponse, QuoteResult } from "../contracts";
import {
  afterResultsBlocks,
  applyGuideChoice,
  applyGuideText,
  guideAwaiting,
  guideProgress,
  MODALITY_LABEL,
  modalityOf,
  moreBusinessBlocks,
  nextGuideBlocks,
  operatorBlocks,
  parseBudget,
  PLANS_PER_ROUND,
  profileLine,
  splitChoice,
  toQuoteInput,
  type GuideAnswers,
  type GuideFacets,
} from "./guide-flow";
import { CelebrateBlock, money, PlansBlock, QuoteGuideContext, type CelebrateBlockData, type PlansBlockData } from "./plan-cards";
import { CompareSheet, PlanSheet, type QuoteGuideServices } from "./plan-sheets";
import styles from "./quote-guide.module.css";

const count = (value: number) => value.toLocaleString("pt-BR");
const definition = ASSISTANTS.cotacao;
const mascot = { shape: definition.shape, hue: definition.hue ?? 268 };

/**
 * A Cotação do corretor (11/11): conversa guiada sobre o catálogo real do piloto. Uma pergunta
 * por vez com progresso, o mascote procura, os mais em conta chegam como cartões animados e o que
 * é denso (condições, rede, comparação) abre num painel. "Refazer" começa outra conversa.
 */
export function CatalogQuoteGuide(props: { facets: GuideFacets; services: QuoteGuideServices; canExport?: boolean }) {
  const [run, setRun] = useState(0);
  return <QuoteGuideConversation key={run} {...props} onRestart={() => setRun((value) => value + 1)} />;
}

function QuoteGuideConversation({ facets, services, canExport = true, onRestart }: { facets: GuideFacets; services: QuoteGuideServices; canExport?: boolean; onRestart: () => void }) {
  const [answers, setAnswers] = useState<GuideAnswers>({});
  const answersRef = useRef<GuideAnswers>({});
  const round = useRef(0);
  const budgetMode = useRef(false);
  const lastInput = useRef<QuoteInput | null>(null);
  const response = useRef<QuoteResponse | null>(null);
  const cursor = useRef(0);
  const known = useRef(new Map<string, QuoteResult>());
  const [picked, setPicked] = useState<QuoteResult[]>([]);
  const selected = useMemo(() => picked.map((plan) => plan.id), [picked]);
  const [exploring, setExploring] = useState<{ plan: QuoteResult; tab: "conditions" | "network" } | null>(null);
  const [comparing, setComparing] = useState(false);
  const [awaitingBudget, setAwaitingBudget] = useState(false);
  const fire = useFeedback();

  const script = useMemo<ChatScript>(() => ({
    status: { label: "Esperando você", tone: "waiting" },
    blocks: [
      { type: "assistant", id: "a-intro", text: "Vamos montar uma cotação? São poucas perguntas e no fim eu te mostro os planos mais em conta do catálogo." },
      { type: "system", id: "s-catalog", strong: `${count(facets.totalPlans)} planos`, text: `no catálogo de ${facets.sourceDate.split("-").reverse().join("/")}` },
      ...nextGuideBlocks({}, facets, 0),
    ],
  }), [facets]);

  const commit = useCallback((next: GuideAnswers) => {
    answersRef.current = next;
    setAnswers(next);
  }, []);

  const remember = (plans: QuoteResult[]) => { for (const plan of plans) known.current.set(plan.id, plan); };

  /** Busca com as respostas atuais e devolve o resultado como conversa. */
  const search = useCallback(async (current: GuideAnswers): Promise<ChatBlock[]> => {
    const input = toQuoteInput(current);
    const turn = ++round.current;
    if (!input) return nextGuideBlocks(current, facets, turn);
    const result = await services.simulate(input);
    if (result.error || !result.data) {
      return [
        { type: "assistant", id: `a-search-error-${turn}`, text: result.error || "Não consegui consultar os planos agora. Tente de novo em instantes." },
        { type: "question", id: `q-retry-${turn}`, prompt: "Como quer seguir?", choices: [{ id: "retry", label: "Tentar de novo", action: { kind: "local", value: "retry:1" } }, { id: "restart", label: "Refazer a cotação", action: { kind: "local", value: "restart:1" } }] },
      ];
    }
    const data = result.data;
    lastInput.current = input;
    response.current = data;
    const first = data.results.slice(0, PLANS_PER_ROUND);
    cursor.current = first.length;
    remember(first);
    const modality = modalityOf(current);
    const filtered = Boolean(current.operator || current.budgetCents);
    const ready = Math.max(0, data.compatible - data.pending);
    const plans: PlansBlockData = {
      offset: 0,
      plans: first,
      summary: {
        total: data.total, ready, pending: data.pending, catalog: facets.totalPlans,
        modalityPlans: modality ? facets.modalities[modality].plans : facets.totalPlans,
        modalityLabel: modality ? MODALITY_LABEL[modality] : "Planos",
        profile: profileLine(current),
        cheapestCents: first[0]?.totalCents ?? null,
      },
    };
    if (!data.total) {
      return [
        { type: "custom", id: `plans-${turn}`, kind: "plans", data: plans },
        { type: "assistant", id: `a-empty-${turn}`, text: filtered ? "Com esses filtros não sobrou nenhum. Tire os filtros ou mude o teto." : "Nenhum plano tem preço para todas essas idades nesse perfil. Tente outra acomodação ou coparticipação." },
        ...afterResultsBlocks(turn, { more: false, filtered }),
      ];
    }
    const line = data.total > PLANS_PER_ROUND ? `Aqui estão os ${PLANS_PER_ROUND} mais em conta. Marque até 3 em Comparar para ver lado a lado.` : "Aqui estão eles, do mais em conta para o mais caro.";
    return [
      { type: "custom", id: `plans-${turn}`, kind: "plans", data: plans },
      { type: "assistant", id: `a-results-${turn}`, text: line },
      ...afterResultsBlocks(turn, { more: data.total > first.length, filtered }),
    ];
  }, [facets, services]);

  /** Os próximos 3 do ranking (busca a próxima página quando acaba a atual). */
  const showMore = useCallback(async (): Promise<ChatBlock[]> => {
    const turn = ++round.current;
    let data = response.current;
    if (!data || !lastInput.current) return [];
    if (cursor.current >= data.results.length && data.page < data.pages) {
      const next = await services.simulate({ ...lastInput.current, page: data.page + 1 });
      if (!next.data) return [{ type: "assistant", id: `a-more-error-${turn}`, text: next.error || "Não consegui buscar mais agora. Tente de novo." }];
      const offset = (data.page) * 24;
      data = { ...next.data, results: next.data.results };
      response.current = data;
      cursor.current = 0;
      const plans = data.results.slice(0, PLANS_PER_ROUND);
      cursor.current = plans.length;
      remember(plans);
      return [
        { type: "custom", id: `plans-${turn}`, kind: "plans", data: { offset, plans } satisfies PlansBlockData },
        ...afterResultsBlocks(turn, { more: cursor.current < data.results.length || data.page < data.pages, filtered: Boolean(answersRef.current.operator || answersRef.current.budgetCents) }),
      ];
    }
    const offset = (data.page - 1) * 24 + cursor.current;
    const plans = data.results.slice(cursor.current, cursor.current + PLANS_PER_ROUND);
    cursor.current += plans.length;
    remember(plans);
    return [
      { type: "custom", id: `plans-${turn}`, kind: "plans", data: { offset, plans } satisfies PlansBlockData },
      ...afterResultsBlocks(turn, { more: cursor.current < data.results.length || data.page < data.pages, filtered: Boolean(answersRef.current.operator || answersRef.current.budgetCents) }),
    ];
  }, [services]);

  const exportPdf = useCallback(async (planId: string): Promise<ChatBlock[]> => {
    const turn = ++round.current;
    const plan = known.current.get(planId);
    if (!plan || !lastInput.current) return [{ type: "assistant", id: `a-pdf-missing-${turn}`, text: "Esse plano saiu da lista. Busque de novo e tente outra vez." }];
    const result = await services.exportPdf({ planId, profile: lastInput.current });
    if (result.error || !result.data) {
      fire("error");
      return [{ type: "assistant", id: `a-pdf-error-${turn}`, text: [result.error ?? "Não consegui gerar a proposta agora.", ...(result.reasons ?? [])].join(" ") }];
    }
    const bytes = Uint8Array.from(atob(result.data.base64), (char) => char.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.data.filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    // Gerar proposta é ação de dezenas por dia: nível 1 (FEEDBACK.md), vibração de confirmação, sem som nem festa.
    fire("confirm");
    const celebrate: CelebrateBlockData = { title: "Proposta pronta", text: `${plan.name}, ${money(plan.totalCents)} por mês. O PDF já baixou no seu aparelho.` };
    return [
      { type: "custom", id: `celebrate-${turn}`, kind: "celebrate", data: celebrate },
      ...afterResultsBlocks(turn, { more: false, filtered: Boolean(answersRef.current.operator || answersRef.current.budgetCents) }),
    ];
  }, [services, fire]);

  const onLocalChoice = useCallback(async (_choice: ChatChoice, value: string): Promise<ChatBlock[]> => {
    const current = answersRef.current;
    const [field, raw] = splitChoice(value);
    switch (field) {
      case "restart": onRestart(); return [];
      case "retry": return search(current);
      case "more": return showMore();
      case "pdf": return exportPdf(raw);
      case "businessMore": return moreBusinessBlocks(facets, ++round.current);
      case "pickOperator": return operatorBlocks(current, facets, ++round.current);
      case "budget":
        budgetMode.current = true;
        setAwaitingBudget(true);
        return [{ type: "assistant", id: `a-budget-${++round.current}`, text: "Qual o valor máximo por mês, somando todas as vidas? Ex.: 1.500" }];
      case "clear": {
        const next = { ...current, operator: null, budgetCents: null };
        commit(next);
        return search(next);
      }
      case "compare": {
        const turn = ++round.current;
        const ready = picked;
        if (ready.length >= 2) setComparing(true);
        return [
          { type: "assistant", id: `a-compare-${turn}`, text: ready.length >= 2 ? `Abri a comparação de ${ready.length} planos.` : "Marque pelo menos 2 planos em Comparar, nos cartões, e toque de novo." },
          ...afterResultsBlocks(turn, { more: Boolean(response.current && (cursor.current < response.current.results.length || response.current.page < response.current.pages)), filtered: Boolean(current.operator || current.budgetCents) }),
        ];
      }
    }
    // Só vale a resposta da pergunta em aberto (ou o refino de operadora depois do resultado).
    if (field !== "operator" && field !== guideAwaiting(current, facets)) return [];
    const next = applyGuideChoice(current, value, facets);
    if (!next) return [];
    commit(next);
    if (field === "operator" || guideAwaiting(next, facets) === "done") return search(next);
    return nextGuideBlocks(next, facets, ++round.current);
  }, [commit, exportPdf, facets, onRestart, picked, search, showMore]);

  const onFreeText = useCallback(async (text: string): Promise<ChatBlock[]> => {
    const current = answersRef.current;
    const turn = ++round.current;
    if (budgetMode.current) {
      const parsed = parseBudget(text);
      if ("error" in parsed) return [{ type: "assistant", id: `a-budget-error-${turn}`, text: parsed.error }];
      budgetMode.current = false;
      setAwaitingBudget(false);
      const next = { ...current, budgetCents: parsed.cents };
      commit(next);
      return search(next);
    }
    if (guideAwaiting(current, facets) === "done") {
      return [{ type: "assistant", id: `a-free-${turn}`, text: "Use as opções acima para seguir. Para outra cotação, toque em Refazer a cotação." }];
    }
    const outcome = applyGuideText(current, text, facets, turn);
    if ("blocks" in outcome) return outcome.blocks;
    commit(outcome.answers);
    if (guideAwaiting(outcome.answers, facets) === "done") return search(outcome.answers);
    return nextGuideBlocks(outcome.answers, facets, turn);
  }, [commit, facets, search]);

  /** O mascote trabalha (com uma frase) só no que demora: buscar planos e gerar o PDF. */
  const localWorkingLabel = useCallback((value: string) => {
    const [field] = splitChoice(value);
    if (field === "pdf") return "Gerando a proposta…";
    if (field === "more" || field === "operator" || field === "clear" || field === "retry") return "Buscando planos…";
    let next: GuideAnswers | null;
    if (field === "text") {
      if (budgetMode.current) return "Buscando planos…";
      const outcome = applyGuideText(answersRef.current, splitChoice(value)[1], facets, 0);
      next = "answers" in outcome ? outcome.answers : null;
    } else next = applyGuideChoice(answersRef.current, value, facets);
    if (next && guideAwaiting(next, facets) === "done") {
      const modality = modalityOf(next);
      return `Procurando entre ${count(modality ? facets.modalities[modality].plans : facets.totalPlans)} planos…`;
    }
    return null;
  }, [facets]);

  const renderCustom = useCallback((block: Extract<ChatBlock, { type: "custom" }>, api: CustomBlockApi) => {
    if (block.kind === "plans") return <PlansBlock data={block.data as PlansBlockData} api={api} mascot={mascot} />;
    if (block.kind === "celebrate") return <CelebrateBlock data={block.data as CelebrateBlockData} mascot={mascot} />;
    return null;
  }, []);

  const toggle = useCallback((plan: QuoteResult) => {
    known.current.set(plan.id, plan);
    setPicked((current) => current.some((item) => item.id === plan.id) ? current.filter((item) => item.id !== plan.id) : current.length < 3 ? [...current, plan] : current);
  }, []);
  const actions = useMemo(() => ({ selected, toggle, open: (plan: QuoteResult, tab: "conditions" | "network") => setExploring({ plan, tab }), canExport }), [canExport, selected, toggle]);

  const waiting = guideAwaiting(answers, facets);
  const flowDone = waiting === "done";
  const placeholder = awaitingBudget ? "Ex.: 1.500"
    : waiting === "ages" ? "Ex.: 35, 32, 8"
      : waiting === "city" ? "Ex.: Niterói"
        : waiting === "entity" ? "Ex.: OAB"
          : waiting === "businessMonths" ? "Ou escreva os meses. Ex.: 18"
            : flowDone ? "Escolha uma opção acima" : undefined;
  const composerInput = awaitingBudget ? { inputMode: "numeric" as const, label: "Valor máximo por mês" }
    : waiting === "ages" ? { inputMode: "numeric" as const, label: "Idades de quem vai entrar no plano, separadas por vírgula" }
      : waiting === "city" ? { label: "Município do cliente" }
        : waiting === "entity" ? { label: "Sigla ou nome da entidade de classe" }
          : waiting === "businessMonths" ? { inputMode: "numeric" as const, label: "Tempo de empresa em meses" } : undefined;
  const comparePlans = picked;

  return (
    <div className={`arc-venancor ${styles.root}`}>
      <QuoteGuideContext.Provider value={actions}>
        <ChatScreen
          identity={{ name: definition.name, shape: definition.shape, hue: definition.hue }}
          backHref="/dashboard"
          script={script}
          onLocalChoice={onLocalChoice}
          onFreeText={onFreeText}
          localWorkingLabel={localWorkingLabel}
          renderCustom={renderCustom}
          closePassedQuestions
          progress={flowDone ? null : guideProgress(answers, facets)}
          placeholder={placeholder}
          composerInput={composerInput}
          headerAction={(
            <AnimatePresence>
              {selected.length >= 2 ? (
                <motion.button key="compare" type="button" className={styles.comparePill} onClick={() => setComparing(true)} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ type: "spring", visualDuration: 0.3, bounce: 0.4 }}>
                  Comparar
                  <motion.span key={selected.length} className={styles.compareCount} initial={{ scale: 1.5 }} animate={{ scale: 1 }} transition={{ type: "spring", visualDuration: 0.25, bounce: 0.5 }}>{selected.length}</motion.span>
                </motion.button>
              ) : null}
            </AnimatePresence>
          )}
        />
      </QuoteGuideContext.Provider>
      {exploring ? <PlanSheet plan={exploring.plan} initialTab={exploring.tab} services={services} onClose={() => setExploring(null)} /> : null}
      {comparing && comparePlans.length ? (
        <CompareSheet
          plans={comparePlans}
          onClose={() => setComparing(false)}
          onOpen={(plan) => { setComparing(false); setExploring({ plan, tab: "conditions" }); }}
          onRemove={(plan) => { toggle(plan); if (comparePlans.length <= 2) setComparing(false); }}
        />
      ) : null}
    </div>
  );
}
