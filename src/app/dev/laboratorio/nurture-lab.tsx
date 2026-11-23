"use client";

/**
 * Laboratório: Nutrição mensal (recuperação, fase 5). As regras reais (decideNurtureTouch) sobre 4 meses simulados
 * de um lead que saiu da fila de ligação sem atender. Nada é enviado. Junto, o A/B do S2 (as duas variantes do texto)
 * e a pergunta do Sasá "quem eu recupero hoje?" respondida pela lista da carteira.
 */
import { useMemo, useState } from "react";

import page from "@/components/lite/page/lite-page.module.css";
import { buildRecoveryText, pendingAskFor } from "@/features/lead-recovery/cadence-rules";
import { decideNurtureTouch, nextNurtureDate, NURTURE_TEMPLATE } from "@/features/lead-recovery/nurture-rules";
import { isRecoveryControl, parseRecoverySettings } from "@/features/lead-recovery/settings-core";
import { stepVariantText } from "@/features/lead-recovery/step-experiments";
import { recoverListOf } from "@/features/sasa/command-core";

type Scenario = "sem" | "responde" | "semTemplate" | "desligada";
const SCENARIOS: Array<{ id: Scenario; label: string }> = [
  { id: "sem", label: "Nunca responde" },
  { id: "responde", label: "Responde no 2º toque" },
  { id: "semTemplate", label: "Template não aprovado" },
  { id: "desligada", label: "Nutrição desligada" },
];
const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const LEAD_ID = Array.from({ length: 80 }, (_, index) => `lab-nutricao-${index}`).find((id) => !isRecoveryControl(id, 10))!;

function simulate(scenario: Scenario) {
  const settings = parseRecoverySettings(JSON.stringify({ enabled: true, nurture: scenario !== "desligada", legalReviewedAt: "2026-11-21T12:00:00Z" }));
  const start = new Date("2026-11-23T13:00:00Z");
  let state = { state: "nurture" as const, at: start, until: start as Date | null, touches: 0 };
  let inbound: Date | null = null;
  const lines: Array<{ at: Date; text: string; tone?: "success" | "warning" | "danger" }> = [{ at: start, text: "Saiu da fila de ligação: 3 tentativas sem atender. Entra na nutrição." }];
  for (let hours = 0; hours <= 24 * 120; hours += 1) {
    const now = new Date(start.getTime() + hours * 3_600_000);
    const decision = decideNurtureTouch({ now, settings, leadId: LEAD_ID, nurture: state, lastInboundAt: inbound, optedOut: false, hasBroker: false, approvedTemplates: scenario === "semTemplate" ? new Set() : new Set([NURTURE_TEMPLATE]) });
    if (decision.action === "wait") continue;
    if (decision.action === "stop") { lines.push({ at: now, text: decision.reason === "disabled" ? "Nada sai: a nutrição está desligada." : `Parou: ${decision.reason}`, tone: "warning" }); break; }
    if (decision.action === "replied") { lines.push({ at: now, text: "Respondeu: sai da nutrição e volta para a IA (conta como recuperado).", tone: "success" }); break; }
    if (decision.action === "finished") { lines.push({ at: now, text: "3 toques sem resposta: fim da nutrição. Nenhuma mensagem automática depois disso.", tone: "warning" }); break; }
    if (decision.action === "skip") {
      lines.push({ at: now, text: `${decision.step.toUpperCase()} pulado: template não aprovado. Tenta de novo em 30 dias.` });
      state = { ...state, touches: state.touches + 1, until: nextNurtureDate(now) };
      continue;
    }
    lines.push({ at: now, text: `${decision.step.toUpperCase()} enviado pela Meta: template ${decision.template} (reajuste anual e faixa de idade).`, tone: "success" });
    state = { ...state, touches: state.touches + 1, until: nextNurtureDate(now) };
    if (scenario === "responde" && state.touches === 2) {
      inbound = new Date(now.getTime() + 3 * 3_600_000);
      lines.push({ at: inbound, text: "Cliente: “Quero comparar”" });
    }
  }
  return lines;
}

const SASA_QUEUE = [
  { id: "a", name: "Ana Souza", status: "in_contact", arrivedAt: new Date(Date.now() - 5 * 86_400_000) },
  { id: "b", name: "Carlos Teixeira", status: "negotiation", arrivedAt: new Date(Date.now() - 3 * 86_400_000) },
  { id: "c", name: "Marina Alves", status: "quote_sent", arrivedAt: new Date(Date.now() - 2 * 86_400_000) },
  { id: "d", name: "Pedro Lima", status: "negotiation", arrivedAt: new Date(Date.now() - 86_400_000) },
];
const STATUS: Record<string, string> = { negotiation: "Em negociação", quote_sent: "Cotação enviada", in_contact: "Em atendimento", awaiting_reply: "Aguardando resposta" };

export function NurtureLab() {
  const [scenario, setScenario] = useState<Scenario>("sem");
  const lines = useMemo(() => simulate(scenario), [scenario]);
  const base = buildRecoveryText("s2", { leadName: "Andréia Deia", pendingAsk: pendingAskFor(["planType", "numberOfLives"]) });
  const recover = recoverListOf(SASA_QUEUE, new Set(["d"]));
  return (
    <main className="arc-venancor mx-auto grid max-w-6xl items-start gap-ds-24 p-ds-24 font-ds-inter lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className={page.group} aria-labelledby="lab-nurture-title">
        <header className={page.cardHead}>
          <h2 id="lab-nurture-title" className={page.cardTitle}>Nutrição mensal (simulação)</h2>
          <p className={page.cardDescription}>Um toque por mês, no máximo 3, só template de marketing pela Meta. Regras reais; nada é enviado.</p>
        </header>
        <nav className={page.countTabs} aria-label="Cenário da nutrição">
          {SCENARIOS.map((item) => (
            <button key={item.id} type="button" className={page.countTab} data-active={scenario === item.id ? "true" : undefined} aria-pressed={scenario === item.id} onClick={() => setScenario(item.id)}>{item.label}</button>
          ))}
        </nav>
        <ol className="flex flex-col" aria-label="Linha do tempo da nutrição">
          {lines.map((line, index) => (
            <li key={index} className="flex gap-ds-12 border-t border-ds-ash py-ds-8 first:border-t-0">
              <time className="w-24 shrink-0 font-ds-mono text-ds-caption text-ds-fog tabular-nums">{fmt.format(line.at)}</time>
              <span className={`min-w-0 text-ds-body ${line.tone === "success" ? "text-ds-forest-ink" : line.tone === "warning" ? "text-ds-amber-ink" : "text-ds-charcoal"}`}>{line.text}</span>
            </li>
          ))}
        </ol>
      </section>
      <aside className="flex flex-col gap-ds-24">
        <section className={page.group} aria-labelledby="lab-ab-title">
          <header className={page.cardHead}>
            <h2 id="lab-ab-title" className={page.cardTitle}>A/B do S2</h2>
            <p className={page.cardDescription}>50/50 até 50 envios por variante; depois, Thompson pela resposta em 24 h.</p>
          </header>
          {(["fechada", "aberta"] as const).map((variant) => (
            <div key={variant} className="rounded-ds-cards border border-ds-ash p-ds-12">
              <p className="text-ds-caption font-medium uppercase tracking-wide text-ds-fog">Pergunta {variant}</p>
              <p className="mt-ds-4 whitespace-pre-line text-ds-body text-ds-charcoal">{stepVariantText("s2", variant, base, "Andréia Deia")}</p>
            </div>
          ))}
        </section>
        <section className={page.group} aria-labelledby="lab-sasa-recover-title">
          <header className={page.cardHead}>
            <h2 id="lab-sasa-recover-title" className={page.cardTitle}>Sasá: “Quem eu recupero hoje?”</h2>
            <p className={page.cardDescription}>Leads da carteira parados em negociação e sem retorno marcado (o Pedro tem retorno e fica fora).</p>
          </header>
          <ol className="flex flex-col">
            {recover.map((lead) => (
              <li key={lead.leadId} className="flex items-center justify-between gap-ds-8 border-t border-ds-ash py-ds-8 first:border-t-0">
                <span className="text-ds-body font-medium text-ds-charcoal">{lead.name}</span>
                <span className="text-ds-caption text-ds-fog">{STATUS[lead.status] ?? lead.status} · sem retorno</span>
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </main>
  );
}
