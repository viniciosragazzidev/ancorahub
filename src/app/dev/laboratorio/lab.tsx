"use client";

/**
 * Laboratório de fluxos do corretor (15/11/2026). As telas são as reais (Início, Plantões, conquistas); só a
 * resposta do servidor é simulada pelo DevLabProvider. Mudou o componente real, o laboratório já mostra.
 * Painel no canto: fluxo, resposta do servidor, demora e "Recomeçar".
 */
import { useMemo, useState } from "react";

import { ChatHome } from "@/components/chat/chat-home";
import { TOUR_STORAGE_KEY } from "@/components/chat/tour/tour-steps";
import type { ThreadSummary } from "@/components/chat/types";
import { AchievementHost, announceAchievement } from "@/components/lite/celebration/achievement-host";
import { SaleCelebration } from "@/components/lite/celebration/sale-celebration";
import { BrokerDutyHub } from "@/features/broker-workspace/components/broker-duty-hub";
import type { DutyHubCurrent } from "@/features/broker-workspace/duty-hub";
import { WhatsAppHandoff } from "@/features/broker-workspace/whatsapp-handoff/whatsapp-handoff";
import { DevLabProvider, type DevLab } from "@/lib/dev-lab";

import styles from "./lab.module.css";

type Flow = "plantao" | "lead" | "conquistas";
type Outcome = "ok" | "falha" | "liberacao";

const FLOWS: { id: Flow; label: string }[] = [
  { id: "plantao", label: "Aceitar plantão" },
  { id: "lead", label: "Aceitar lead" },
  { id: "conquistas", label: "Conquistas" },
];
const DELAYS = [{ ms: 400, label: "Rápido" }, { ms: 1200, label: "Normal" }, { ms: 3000, label: "Lento" }];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
const HANDOFF_LEAD = { name: "Carla Mendes", wants: "Plano PME para a empresa dela, 6 vidas.", plan: "SulAmérica · PME", lives: "6 vidas", city: "Niterói" };

function thread(overrides: Partial<ThreadSummary>): ThreadSummary {
  return {
    id: "a", kind: "assistant", assistant: "ancora" as never, name: "Âncora", preview: "Sem avisos novos.", href: "/notificacoes",
    shape: "onigiri", hue: 220, waitingYou: false, updatedAt: new Date().toISOString(), ...overrides,
  } as ThreadSummary;
}

export function FlowLab() {
  const [flow, setFlow] = useState<Flow>("plantao");
  const [outcome, setOutcome] = useState<Outcome>("ok");
  const [delay, setDelay] = useState(1200);
  const [mode, setMode] = useState<"online" | "presencial">("online");
  const [run, setRun] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [handoff, setHandoff] = useState<string | null>(null);
  const [sale, setSale] = useState(0);
  // As boas-vindas e o tour cobririam o fluxo: no laboratório ficam como já vistos.
  useState(() => { try { window.localStorage.setItem("ancora:lite-welcome:2026-10-chat", "1"); window.localStorage.setItem(TOUR_STORAGE_KEY, "skipped"); } catch { /* ignore */ } return null; });

  const lab = useMemo<DevLab>(() => ({
    acceptLead: async () => {
      await wait(delay);
      return outcome === "falha" ? { success: false, error: "Outro corretor aceitou este lead primeiro." } : { success: true, whatsappUrl: "https://exemplo.invalid/" };
    },
    afterLeadAccepted: (_leadId, url) => setHandoff(url ?? "https://exemplo.invalid/"),
    confirmPresence: async () => {
      await wait(delay);
      if (outcome === "falha") return { ok: false, error: "Não consegui confirmar agora. Tente de novo." };
      return { ok: true, awaitingRelease: outcome === "liberacao" && mode === "presencial" };
    },
    presenceGate: async () => ({ required: false, connected: true }),
  }), [delay, outcome, mode]);

  const duty: DutyHubCurrent = {
    state: "active",
    coveredOccurrenceIds: [],
    shifts: [{
      key: `lab-${run}`, scheduleName: "TESTE", dateLabel: "Hoje", timeLabel: "09:00 às 19:00", place: mode === "presencial" ? "Unidade Centro" : null,
      modality: mode === "presencial" ? "Presencial" : "Online",
      situation: { label: "Confirme sua presença", tone: "warning" },
      hint: mode === "presencial" ? "Quando chegar à unidade, tire uma foto do local para começar a receber leads." : "Confirme sua presença para começar a receber leads.",
      href: "/dev/laboratorio",
      ask: { assignmentId: `lab-${run}`, scheduleName: "TESTE", branchName: mode === "presencial" ? "Unidade Centro" : null, mode, startsAt: inMinutes(-30), endsAt: inMinutes(300), status: "pending", photoId: null },
    }],
  };

  const restart = () => { setRun((value) => value + 1); setHandoff(null); };

  return (
    <DevLabProvider value={lab}>
      <AchievementHost />
      <div key={`${flow}-${run}-${mode}`} className={styles.stage}>
        {flow === "plantao" ? (
          <main className="arc-venancor"><BrokerDutyHub current={duty} calendar={null} calendarState="disabled" /></main>
        ) : flow === "lead" ? (
          <ChatHome
            viewerName="Vinicios Ragazzi"
            nowIso={new Date().toISOString()}
            canQuote
            showWhatsAppStatus={false}
            assistants={[thread({})]}
            leads={[thread({ id: "l1", kind: "lead", leadId: "l1", name: "Carla Mendes", preview: "Oferta de lead: aceite em até 4 min.", waitingYou: true, href: "/dev/laboratorio", initials: "CM", shape: "logo", hue: null } as Partial<ThreadSummary>)]}
            summary={{
              receivedToday: 3, acceptedToday: 2, inServiceNow: 4, slaAtRiskNow: 0, duty: { title: "De plantão: TESTE", detail: "09:00 às 19:00", href: "/dev/laboratorio" }, goal: null,
              next: { label: "Aceitar Carla", detail: "Oferta de lead esperando você.", href: "/dev/laboratorio", urgent: true, acceptLeadId: "l1" },
              now: { title: "Agora", emptyText: "Você está em dia.", items: [{ id: "offer-l1", title: "Carla Mendes", detail: "Plano PME, 6 vidas. Oferta para você.", actionLabel: "Aceitar e chamar no WhatsApp", href: "/dev/laboratorio", acceptLeadId: "l1", expiresAt: inMinutes(4), tone: "urgent" }] },
            }}
          />
        ) : (
          <main className={`arc-venancor ${styles.buttons}`}>
            <h1>Conquistas</h1>
            <button type="button" onClick={() => announceAchievement({ kind: "duty", key: `d${Date.now()}`, scheduleName: "TESTE", until: "19:00", mode })}>Presença confirmada</button>
            <button type="button" onClick={() => announceAchievement({ kind: "whatsapp", key: `w${Date.now()}`, phoneSuffix: "4321" })}>WhatsApp conectado</button>
            <button type="button" onClick={() => setSale((value) => value + 1)}>Venda registrada</button>
          </main>
        )}
      </div>

      {handoff ? <WhatsAppHandoff lead={HANDOFF_LEAD} whatsappUrl={handoff} onClose={() => setHandoff(null)} /> : null}
      {sale ? <SaleCelebration open celebrationKey={`lab-sale-${sale}`} stats={[{ label: "Valor mensal", value: "R$ 3.480" }, { label: "Vigência", value: "12 meses" }]} onClose={() => setSale(0)} /> : null}

      <aside className={`arc-venancor ${styles.panel}`} data-open={panelOpen || undefined} aria-label="Laboratório de fluxos">
        <button type="button" className={styles.toggle} onClick={() => setPanelOpen((value) => !value)} aria-expanded={panelOpen}>
          🧪 Laboratório {panelOpen ? "▾" : "▸"}
        </button>
        {panelOpen ? (
          <div className={styles.body}>
            <fieldset><legend>Fluxo</legend>
              {FLOWS.map((item) => <button key={item.id} type="button" aria-pressed={flow === item.id} onClick={() => { setFlow(item.id); setHandoff(null); }}>{item.label}</button>)}
            </fieldset>
            <fieldset><legend>Servidor responde</legend>
              <button type="button" aria-pressed={outcome === "ok"} onClick={() => setOutcome("ok")}>Sucesso</button>
              <button type="button" aria-pressed={outcome === "falha"} onClick={() => setOutcome("falha")}>Falha</button>
              <button type="button" aria-pressed={outcome === "liberacao"} onClick={() => setOutcome("liberacao")} title="Presencial: a foto vai para o diretor liberar">Aguardar liberação</button>
            </fieldset>
            <fieldset><legend>Demora</legend>
              {DELAYS.map((item) => <button key={item.ms} type="button" aria-pressed={delay === item.ms} onClick={() => setDelay(item.ms)}>{item.label}</button>)}
            </fieldset>
            <fieldset><legend>Plantão</legend>
              <button type="button" aria-pressed={mode === "online"} onClick={() => setMode("online")}>Online</button>
              <button type="button" aria-pressed={mode === "presencial"} onClick={() => setMode("presencial")}>Presencial</button>
            </fieldset>
            <button type="button" className={styles.restart} onClick={restart}>Recomeçar</button>
            <p className={styles.note}>Telas reais, servidor simulado. As comemorações respeitam o limite do dia: em Configurações › Acessibilidade dá para desligar.</p>
          </div>
        ) : null}
      </aside>
    </DevLabProvider>
  );
}
