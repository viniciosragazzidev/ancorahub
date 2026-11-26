"use client";

/**
 * Laboratório: conversa do pós-venda (24/11). As regras reais (decidePostSaleTurn) leem as respostas pelas
 * palavras-chave, como no caminho sem IA. Casos reais de 24/11 (Toinha e Carmen) e a troca de corretor
 * ligada ou desligada. Nada é enviado e nenhum lead é mexido.
 */
import { useMemo, useState, type FormEvent } from "react";

import page from "@/components/lite/page/lite-page.module.css";
import { Button } from "@/components/ui/button";
import { DsInputField } from "@/components/ui/ds-input-field";
import { DsSegmentedControl } from "@/components/ui/ds-segmented-control";
import { autoRuleQuestionFocus, detectAutoRuleKeywords } from "@/features/post-sale-audit/auto-rule-scripts";
import { CONTACT_STATUS_LABELS } from "@/features/post-sale-audit/contact-status";
import { postSaleAlertMessage, postSaleAlertReasons } from "@/features/post-sale-audit/alert-rules";
import { detectPostSaleIntents } from "@/features/post-sale-audit/intents";
import { renderPostSaleOpeningMessage } from "@/features/post-sale-audit/rules";
import { POST_SALE_WAHA_OPENING_DEFAULT } from "@/features/post-sale-audit/template-contract";
import { decidePostSaleTurn, type PolicyKind, type PolicyTurn, type PostSaleAnswersWithIntents } from "@/features/post-sale-audit/turn-policy";

type Scenario = "toinha" | "carmen" | "carmenLonga" | "semContato" | "vaga" | "livre";
const SCENARIOS: Record<Scenario, { label: string; lead: string; broker: string; replies: string[] }> = {
  toinha: { label: "Toinha", lead: "Toinha", broker: "Cinthia", replies: ["Pode perguntar", "Sim, mandou mensagem mas não concluiu..."] },
  carmen: { label: "Carmen", lead: "Carmen", broker: "Viviani", replies: ["Pode perguntar", "Ela não deu continuidade ao atendimento"] },
  carmenLonga: { label: "Carmen (2 dias)", lead: "Carmen", broker: "Viviani", replies: ["Pode", "Ela começou a enviar mensagem, e não falou mais nada há 2 dias"] },
  semContato: { label: "Sem contato", lead: "Ana", broker: "Alan", replies: ["Pode", "Não, ninguém me ligou", "Sim, quero"] },
  vaga: { label: "Resposta vaga", lead: "Ana", broker: "Alan", replies: ["Pode perguntar", "Hmm", "Não sei dizer"] },
  livre: { label: "Escrever", lead: "Ana", broker: "Alan", replies: ["Pode perguntar"] },
};

type Line = { from: "ia" | "cliente" | "sistema"; text: string };

const POLICY_LABELS: Record<PolicyKind, string> = {
  script: "Roteiro",
  hold_question: "Acolheu a dúvida e voltou à pergunta",
  wrong_person: "Número errado",
  health_urgency: "Urgência de saúde",
  resume: "Equipe vai retomar",
  closed_elsewhere: "Fechou por fora",
  gave_up: "Desistiu",
  handoff: "Passou para outro corretor",
  no_follow_up: "Sem continuidade, equipe avisada",
  declined: "Não quis responder",
  repeat_guard: "Encerrou sem repetir a pergunta",
  no_contact_offer: "Sem contato: desculpas e oferta de retorno",
  no_contact_close: "Sem contato: encerrou com desculpas",
};

function simulate(replies: string[], scenario: (typeof SCENARIOS)[Scenario], canHandoff: boolean) {
  const lines: Line[] = [{ from: "ia", text: renderPostSaleOpeningMessage(POST_SALE_WAHA_OPENING_DEFAULT, { nome: scenario.lead, assistente: "Sasá", empresa: "Âncora", corretor: scenario.broker }) }];
  let step = 0;
  let prior: PostSaleAnswersWithIntents = {};
  let last: PolicyTurn | null = null;
  for (const text of replies) {
    lines.push({ from: "cliente", text });
    const focus = autoRuleQuestionFocus("R1", step, prior);
    const answer = { ...detectAutoRuleKeywords(text, focus), comment: text };
    const turn = decidePostSaleTurn({ rule: "R1", step, prior, answer, reading: detectPostSaleIntents(text), text, names: { lead: scenario.lead, broker: scenario.broker, seed: "lab", canHandoff } });
    lines.push({ from: "ia", text: turn.text });
    last = turn;
    step = turn.step;
    prior = turn.answers;
    if (turn.status !== "answering") {
      if (turn.handoff) lines.push({ from: "sistema", text: `Lead volta para a fila sem ${scenario.broker}. A distribuição normal oferece para outro corretor do plantão e da fila. ${scenario.broker} recebe o aviso e a gestão recebe o alerta.` });
      break;
    }
  }
  return { lines, last, done: last ? last.status !== "answering" : false };
}

export function PostSaleConversationLab() {
  const [scenario, setScenario] = useState<Scenario>("toinha");
  const [canHandoff, setCanHandoff] = useState(true);
  const [typed, setTyped] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const base = SCENARIOS[scenario];
  const { lines, last, done } = useMemo(
    () => simulate(scenario === "livre" ? [...base.replies, ...typed] : base.replies, base, canHandoff),
    [scenario, typed, base, canHandoff],
  );
  const alerts = last ? postSaleAlertReasons({ outcome: last.outcome ?? null, rating: last.answers.rating ?? null, answers: last.answers }) : [];
  const choose = (next: Scenario) => { setScenario(next); setTyped([]); setDraft(""); };
  const send = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || done) return;
    setTyped((current) => [...current, text]);
    setDraft("");
  };

  return (
    <main className="arc-venancor mx-auto grid max-w-6xl items-start gap-ds-24 p-ds-24 font-ds-inter lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className={page.group} aria-labelledby="lab-post-sale-title">
        <header className={page.cardHead}>
          <h2 id="lab-post-sale-title" className={page.cardTitle}>Pós-venda R1: conversa</h2>
          <p className={page.cardDescription}>Regras reais, leitura por palavras-chave (o caminho sem IA). Nada é enviado.</p>
        </header>
        <nav className={page.countTabs} aria-label="Conversa de exemplo">
          {(Object.keys(SCENARIOS) as Scenario[]).map((id) => (
            <button key={id} type="button" className={page.countTab} data-active={scenario === id ? "true" : undefined} aria-pressed={scenario === id} onClick={() => choose(id)}>{SCENARIOS[id].label}</button>
          ))}
        </nav>
        <ol className="flex flex-col gap-ds-8" aria-label="Mensagens" aria-live="polite">
          {lines.map((line, index) => (
            <li key={index} className={line.from === "cliente" ? "flex justify-end" : line.from === "sistema" ? "flex justify-center" : "flex justify-start"}>
              <p className={`max-w-[85%] whitespace-pre-line rounded-ds-cards px-ds-12 py-ds-8 text-ds-body ${line.from === "cliente" ? "bg-ds-paper-mist text-ds-charcoal" : line.from === "sistema" ? "border border-ds-ash text-ds-caption text-ds-fog" : "border border-ds-ash text-ds-charcoal"}`}>
                {line.text}
              </p>
            </li>
          ))}
        </ol>
        {scenario === "livre" ? (
          <form onSubmit={send} className="flex gap-ds-8">
            <DsInputField aria-label="Resposta do cliente" placeholder={done ? "Conversa encerrada" : "Escreva como o cliente"} value={draft} onChange={(event) => setDraft(event.target.value)} disabled={done} className="min-w-0 flex-1" />
            <Button type="submit" disabled={done || !draft.trim()}>Enviar</Button>
          </form>
        ) : null}
      </section>
      <aside className="flex flex-col gap-ds-24">
        <section className={page.group} aria-labelledby="lab-post-sale-switch">
          <header className={page.cardHead}>
            <h2 id="lab-post-sale-switch" className={page.cardTitle}>Troca de corretor</h2>
            <p className={page.cardDescription}>Interruptor por empresa, desligado por padrão.</p>
          </header>
          <DsSegmentedControl aria-label="Troca de corretor" value={canHandoff ? "on" : "off"} onValueChange={(value) => setCanHandoff(value === "on")} options={[{ value: "on", label: "Ligada" }, { value: "off", label: "Desligada" }]} />
        </section>
        <section className={page.group} aria-labelledby="lab-post-sale-reading">
          <header className={page.cardHead}>
            <h2 id="lab-post-sale-reading" className={page.cardTitle}>O que a IA entendeu</h2>
          </header>
          <dl className="grid grid-cols-[auto_1fr] gap-x-ds-12 gap-y-ds-4 text-ds-body">
            <dt className="text-ds-fog">Contato</dt>
            <dd className="text-ds-charcoal">{last?.answers.contactStatus ? CONTACT_STATUS_LABELS[last.answers.contactStatus] : "Ainda não disse"}</dd>
            <dt className="text-ds-fog">Caminho</dt>
            <dd className="text-ds-charcoal">{last ? POLICY_LABELS[last.policy] : "Abertura"}</dd>
            <dt className="text-ds-fog">Repetiu</dt>
            <dd className="text-ds-charcoal tabular-nums">{last?.answers.questionRepeats ?? 0} de 1</dd>
            <dt className="text-ds-fog">Troca</dt>
            <dd className="text-ds-charcoal">{last?.answers.handoff ? last.answers.handoff.reason : "Não"}</dd>
          </dl>
          {alerts.length ? (
            <ul className="flex flex-col gap-ds-4 border-t border-ds-ash pt-ds-8" aria-label="Alertas da gestão">
              {alerts.map((reason) => <li key={reason} className="text-ds-caption text-ds-amber-ink">{postSaleAlertMessage(reason, last?.answers)}</li>)}
            </ul>
          ) : null}
        </section>
      </aside>
    </main>
  );
}
