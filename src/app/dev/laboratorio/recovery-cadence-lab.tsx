"use client";

/**
 * Laboratório: Cadência de recuperação (fase 3). Duas partes reais:
 *   1) a configuração (o mesmo painel da Qualificação turbo; salvar é simulado);
 *   2) as regras da cadência (decideRecoveryTouch) rodando sobre 8 dias simulados de um lead que parou no meio,
 *      com o cenário escolhido: sem resposta, responde depois do S3, limite 131049 no S4 ou pede SAIR.
 * Nada é enviado: o "envio" só entra na linha do tempo simulada.
 */
import { useMemo, useState } from "react";

import page from "@/components/lite/page/lite-page.module.css";
import { decideRecoveryTouch, buildRecoveryText, pendingAskFor, type RecoveryTouchState } from "@/features/lead-recovery/cadence-rules";
import { RecoverySettingsLite } from "@/features/lead-recovery/components/recovery-settings-lite";
import { isRecoveryControl, parseRecoverySettings, type RecoverySettings } from "@/features/lead-recovery/settings-core";

type Scenario = "silencio" | "responde" | "limite" | "sair" | "semTemplate" | "dec155";
const SCENARIOS: Array<{ id: Scenario; label: string }> = [
  { id: "silencio", label: "Nunca mais responde" },
  { id: "responde", label: "Responde depois do S3" },
  { id: "limite", label: "131049 no S4" },
  { id: "sair", label: "Pede SAIR no S2" },
  { id: "semTemplate", label: "Templates não aprovados" },
  { id: "dec155", label: "Marketing sem a exceção (DEC-155)" },
];

const fmt = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const REASON: Record<string, string> = {
  disabled: "recuperação ou segmento desligado", legal_pending: "falta a conferência jurídica", control: "lead no grupo de controle", replied: "o cliente respondeu: volta para a IA",
  opted_out: "pediu SAIR: não contatar", closed: "lead encerrado", assigned: "recebeu corretor", broker_contacted: "corretor fez contato", human: "pessoa no atendimento", meta_limit: "2º erro 131049: para",
  step_disabled: "passo desligado", template_not_approved: "template não aprovado", marketing_blocked: "template de Marketing barrado pela DEC-155 (só Utility na qualificação)", window_closed: "janela de 24 h fechada e sem WAHA", no_channel: "sem canal válido", stale: "passou da hora",
};

/** Lead fora do controle de 10%, para a simulação mostrar a cadência. */
const LEAD_ID = Array.from({ length: 80 }, (_, index) => `lab-cadencia-${index}`).find((id) => !isRecoveryControl(id, 10))!;

function simulate(settings: RecoverySettings, scenario: Scenario) {
  // Quinta-feira 19/11/2026, 11:00 em São Paulo: a IA perguntou as idades e o cliente parou.
  const start = new Date("2026-11-19T14:00:00Z");
  const lastInbound = new Date(start.getTime() - 3 * 60_000);
  const touches: RecoveryTouchState[] = [{ step: "s1", status: "sent", attempt: 1, errorCode: null, at: new Date(start.getTime() + 7 * 60_000) }];
  const lines: Array<{ at: Date; text: string; tone?: "success" | "warning" | "danger" }> = [
    { at: start, text: "IA: “Quantos anos tem quem vai usar o plano?” (cliente parou aqui)" },
    { at: touches[0].at, text: "S1 · follow-up de silêncio (já existe hoje)" },
  ];
  let inbound: Date | null = lastInbound;
  let optOut: Date | null = null;
  let sent = 1;
  let lastAutomatic: Date | null = touches[0].at;
  const templates = new Set(["anc_s4_cotacao", "anc_s5_ligacao", "anc_s6_despedida"]);
  const approved = scenario === "semTemplate" || scenario === "dec155" ? new Set<string>() : templates;
  const marketing = scenario === "dec155" ? templates : new Set<string>();
  for (let minutes = 30; minutes <= 8 * 24 * 60; minutes += 30) {
    const now = new Date(start.getTime() + minutes * 60_000);
    const decision = decideRecoveryTouch({
      now, settings, segment: "stopped_midway", leadId: LEAD_ID,
      lead: { status: "new", qualificationStatus: "cold", corretorId: null, firstContactAt: null, recoveryState: null },
      conversation: { status: "WAITING_CUSTOMER", automationState: "AI_ACTIVE", optOutAt: optOut, wrongNumberAt: null },
      startAt: start, lastInboundAt: inbound, lastMetaInboundAt: inbound, conversationChannel: "meta", wahaAvailable: false,
      touches, automaticSentSinceStart: sent, lastAutomaticAt: lastAutomatic, approvedTemplates: approved, marketingTemplates: marketing,
    });
    if (decision.action === "wait") continue;
    if (decision.action === "stop") { lines.push({ at: now, text: `Parou: ${REASON[decision.reason] ?? decision.reason}`, tone: decision.reason === "replied" ? "success" : "warning" }); break; }
    if (decision.action === "finished") { lines.push({ at: now, text: decision.next === "call_queue" ? "Fim da cadência: vai para a fila de ligação (Call Âncora)" : "Fim da cadência (fila de ligação desligada)", tone: "warning" }); break; }
    if (decision.action === "skip") {
      touches.push({ step: decision.step.id, status: "skipped", attempt: 1, errorCode: null, at: now });
      lines.push({ at: now, text: `${decision.step.id.toUpperCase()} pulado: ${REASON[decision.reason] ?? decision.reason}` });
      continue;
    }
    const failed131049 = scenario === "limite" && decision.step.id === "s4";
    touches.push({ step: decision.step.id, status: failed131049 ? "failed" : "sent", attempt: decision.attempt, errorCode: failed131049 ? "131049" : null, at: now });
    if (failed131049) { lines.push({ at: now, text: `${decision.step.id.toUpperCase()} pela Meta: barrado pelo limite de marketing (131049), espera 24 h`, tone: "danger" }); continue; }
    sent += 1;
    lastAutomatic = now;
    const preview = decision.step.kind === "free" ? buildRecoveryText(decision.step.id, { leadName: "Andréia Deia", pendingAsk: pendingAskFor(["planType", "numberOfLives"]) }).split("\n")[0] : `template ${decision.step.template}`;
    lines.push({ at: now, text: `${decision.step.id.toUpperCase()} enviado pela ${decision.channel === "meta" ? "Meta" : "WAHA"}: ${preview}`, tone: "success" });
    if (scenario === "sair" && decision.step.id === "s2") { optOut = new Date(now.getTime() + 20 * 60_000); lines.push({ at: optOut, text: "Cliente: “SAIR”" }); }
    if (scenario === "responde" && decision.step.id === "s3") { inbound = new Date(now.getTime() + 40 * 60_000); lines.push({ at: inbound, text: "Cliente: “Tenho 34 e meu marido 36”" }); }
  }
  return lines;
}

export function RecoveryCadenceLab() {
  const [settings, setSettings] = useState(() => parseRecoverySettings(JSON.stringify({ enabled: true, stoppedMidway: true, callQueue: true, legalReviewedAt: "2026-11-21T12:00:00Z" })));
  const [scenario, setScenario] = useState<Scenario>("silencio");
  const lines = useMemo(() => simulate(settings, scenario), [settings, scenario]);
  return (
    <main className="arc-venancor mx-auto grid max-w-6xl items-start gap-ds-24 p-ds-24 font-ds-inter lg:grid-cols-[minmax(0,1fr)_420px]">
      <section className={page.group} aria-labelledby="lab-cadence-title">
        <header className={page.cardHead}>
          <h2 id="lab-cadence-title" className={page.cardTitle}>Cadência de recuperação (simulação)</h2>
          <p className={page.cardDescription}>Lead que parou no meio, quinta às 11h. As regras são as reais; nada é enviado. Troque o cenário ou a configuração ao lado.</p>
        </header>
        <nav className={page.countTabs} aria-label="Cenário">
          {SCENARIOS.map((item) => (
            <button key={item.id} type="button" className={page.countTab} data-active={scenario === item.id ? "true" : undefined} aria-pressed={scenario === item.id} onClick={() => setScenario(item.id)}>{item.label}</button>
          ))}
        </nav>
        <ol className="flex flex-col" aria-label="Linha do tempo simulada">
          {lines.map((line, index) => (
            <li key={index} className="flex gap-ds-12 border-t border-ds-ash py-ds-8 first:border-t-0">
              <time className="w-28 shrink-0 font-ds-mono text-ds-caption text-ds-fog tabular-nums">{fmt.format(line.at)}</time>
              <span className={`min-w-0 text-ds-body ${line.tone === "success" ? "text-ds-forest-ink" : line.tone === "warning" ? "text-ds-amber-ink" : line.tone === "danger" ? "text-ds-rose-ink" : "text-ds-charcoal"}`}>{line.text}</span>
            </li>
          ))}
        </ol>
      </section>
      <aside className={page.group} aria-label="Configuração da recuperação">
        <RecoverySettingsLite key={JSON.stringify(settings)} initial={settings} canEdit />
        <SettingsSync onChange={setSettings} />
      </aside>
    </main>
  );
}

/** Recebe o que o painel "salvou" no laboratório (via DevLab) e refaz a simulação. */
function SettingsSync({ onChange }: { onChange: (settings: RecoverySettings) => void }) {
  useMemo(() => { labSettingsListener = onChange; }, [onChange]);
  return null;
}

let labSettingsListener: ((settings: RecoverySettings) => void) | null = null;

export function labRecoverySettings(delay: number, failing: boolean) {
  return async (settings: RecoverySettings) => {
    await new Promise((resolve) => setTimeout(resolve, delay));
    if (failing) return { ok: false as const, error: "Não deu para salvar a recuperação agora." };
    const saved = parseRecoverySettings(JSON.stringify(settings));
    window.setTimeout(() => labSettingsListener?.(saved), 0);
    return { ok: true as const, settings: saved };
  };
}
