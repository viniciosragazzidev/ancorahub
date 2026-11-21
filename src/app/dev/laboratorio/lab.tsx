"use client";

/**
 * Laboratório de fluxos do corretor (15/11/2026). As telas são as reais (Início, Plantões, conquistas); só a
 * resposta do servidor é simulada pelo DevLabProvider. Mudou o componente real, o laboratório já mostra.
 * Painel no canto: fluxo, resposta do servidor, demora e "Recomeçar".
 * "Movimento" (18/11/2026): vitrine dos componentes compartilhados com os interruptores "Menos animação" e "Kill switch".
 */
import { useEffect, useMemo, useRef, useState } from "react";

import { AssistantChat } from "@/components/chat/assistant-chat";
import { ChatHome } from "@/components/chat/chat-home";
import { SasaVoiceButton } from "@/components/chat/sasa-voice-button";
import { newClientMessageId } from "@/components/chat/user-send-core";
import { sasaQueue } from "@/features/sasa/offline-queue";
import { buildAncoraScript } from "@/features/broker-workspace/chat/assistant-scripts";
import { TOUR_STORAGE_KEY } from "@/components/chat/tour/tour-steps";
import type { ThreadSummary } from "@/components/chat/types";
import { AchievementHost, announceAchievement } from "@/components/lite/celebration/achievement-host";
import { SaleCelebration } from "@/components/lite/celebration/sale-celebration";
import { BrokerDutyHub } from "@/features/broker-workspace/components/broker-duty-hub";
import type { DutyHubCurrent } from "@/features/broker-workspace/duty-hub";
import { WhatsAppHandoff } from "@/features/broker-workspace/whatsapp-handoff/whatsapp-handoff";
import { DevLabProvider, type DevLab } from "@/lib/dev-lab";
import { InterfaceMotionProvider } from "@/components/motion/interface-motion-provider";
import { TeamListManager } from "@/features/supervisor-workspace/lead-import/team-list-manager";
import { SaleChat, type SaleChatServices } from "@/features/post-sale/components/sale-chat";
import type { SaleCatalog } from "@/features/post-sale/conversation-sale-core";
import { CallAncoraWorkspace } from "@/features/call-ancora/components/call-ancora-workspace";

import styles from "./lab.module.css";
import { MotionShowcase } from "./motion-showcase";
import { LeadHoverLab } from "./lead-hover-lab";
import { createLabSasa, LAB_SASA_SPEECH, labSasaOpenBlock, labSasaPhrasesBlock, labSasaQuestionsBlock, labSasaWorld } from "./sasa-lab";
import type { SaleSpokenDraft } from "@/features/sasa/drafts";

type Flow = "plantao" | "lead" | "venda" | "sasa" | "botao" | "lista" | "conquistas" | "movimento" | "callAncora" | "leadHover";
type Outcome = "ok" | "falha" | "liberacao";

const FLOWS: { id: Flow; label: string }[] = [
  { id: "plantao", label: "Aceitar plantão" },
  { id: "lead", label: "Aceitar lead" },
  { id: "venda", label: "Registrar venda" },
  { id: "sasa", label: "Sasá: pedidos por texto e voz" },
  { id: "botao", label: "Botão da Sasá" },
  { id: "lista", label: "Lista da equipe (supervisor)" },
  { id: "conquistas", label: "Conquistas" },
  { id: "movimento", label: "Movimento (componentes)" },
  { id: "callAncora", label: "Call Âncora (celular simulado)" },
  { id: "leadHover", label: "Hover card do lead (desktop)" },
];
const DELAYS = [{ ms: 400, label: "Rápido" }, { ms: 1200, label: "Normal" }, { ms: 3000, label: "Lento" }];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
/** Telefone que o laboratório trata como "já está no sistema". */
const LAB_KNOWN_PHONE = "5521999990000";
const LAB_TEAM = [
  { id: "b1", name: "Ana Paula", availability: "available" },
  { id: "b2", name: "Bruno Lima", availability: "available" },
  { id: "b3", name: "Carla Dias", availability: "paused" },
  { id: "b4", name: "Débora Nunes", availability: "available" },
  { id: "b5", name: "Eduardo Reis", availability: "available" },
  { id: "b6", name: "Fábio Melo", availability: "paused" },
];
/** "Lista importada" de exemplo: 6 esperando, 4 com corretores (2 já responderam). */
const LAB_LIST = ["Ana Teste", "Bia Teste", "Caio Teste", "Davi Teste", "Eva Teste", "Fabio Teste", "Gil Teste", "Hana Teste", "Iago Teste", "Júlia Teste"].map((name, index) => ({
  id: `lab-list-${index}`,
  name,
  phone: `55219876500${String(index).padStart(2, "0")}`,
  status: index < 6 ? "new" : "in_contact",
  brokerId: index < 6 ? null : LAB_TEAM[index % 2].id,
  brokerName: index < 6 ? null : LAB_TEAM[index % 2].name,
  replied: index >= 8,
  createdAt: new Date().toISOString(),
  assignedAt: null,
}));
/** Catálogo de exemplo do Registrar venda em conversa. */
const LAB_SALE_CATALOG: SaleCatalog = {
  carriers: [
    { id: "amil", name: "Amil", plans: [{ id: "amil-s380", name: "Amil S380", type: "familiar" }, { id: "amil-s450", name: "Amil S450", type: "familiar" }, { id: "amil-pme", name: "Amil PME One", type: "pme" }] },
    { id: "bradesco", name: "Bradesco Saúde", plans: [{ id: "bradesco-top", name: "Bradesco Top Nacional", type: "individual" }, { id: "bradesco-efetivo", name: "Bradesco Efetivo", type: "pme" }] },
    { id: "sulamerica", name: "SulAmérica", plans: [{ id: "sula-exato", name: "SulAmérica Exato", type: "familiar" }, { id: "sula-direto", name: "SulAmérica Direto", type: "pme" }] },
  ],
};
const LAB_SALE_LEAD = { id: "lab-venda", name: "Carlos Teixeira", initials: "CT", stageLabel: "Em negociação", monthlyValue: 1290 };
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
  const [lessMotion, setLessMotion] = useState(false);
  const [killSwitch, setKillSwitch] = useState(false);
  // "Menos animação" é a mesma marca que Configurações › Acessibilidade põe no <html>; volta ao valor anterior ao sair.
  useEffect(() => {
    if (!lessMotion) return;
    const root = document.documentElement;
    const previous = root.dataset.reduceMotion;
    root.dataset.reduceMotion = "1";
    return () => { if (previous === undefined) delete root.dataset.reduceMotion; else root.dataset.reduceMotion = previous; };
  }, [lessMotion]);
  // As boas-vindas e o tour cobririam o fluxo: no laboratório ficam como já vistos.
  useState(() => { try { window.localStorage.setItem("ancora:lite-welcome:2026-10-chat", "1"); window.localStorage.setItem(TOUR_STORAGE_KEY, "skipped"); } catch { /* ignore */ } return null; });

  // Sasá agêntica: um corretor de mentira que as ações simuladas mudam; "Recomeçar" volta ao início.
  const sasaState = useRef({ world: labSasaWorld(), closed: [] as ReturnType<typeof labSasaWorld>["returns"], heard: 0, offline: false, nextSpeech: null as string | null });
  // Fase 4: "Fechou a venda" no botão cai no fluxo Registrar venda já preenchido.
  const [saleDraft, setSaleDraft] = useState<SaleSpokenDraft | null>(null);
  const [nextSpeech, setNextSpeech] = useState<keyof typeof LAB_SASA_SPEECH | null>(null);
  const chooseSpeech = (key: keyof typeof LAB_SASA_SPEECH | null) => { setNextSpeech(key); sasaState.current.nextSpeech = key ? LAB_SASA_SPEECH[key] : null; };
  // Botão da Sasá (fase 3): "Sem internet" faz o envio falhar como sem rede; voltar a internet manda a fila.
  const [offline, setOffline] = useState(false);
  const setInternet = (value: boolean) => {
    sasaState.current.offline = !value;
    setOffline(!value);
    if (value) window.setTimeout(() => window.dispatchEvent(new Event("online")), 50);
  };
  const queueOldAudio = async () => {
    await sasaQueue.add({ id: newClientMessageId(), audio: new Blob(["lab"], { type: "audio/webm" }), seconds: 3, recordedAt: new Date(Date.now() - 40 * 60_000).toISOString() });
    if (!sasaState.current.offline) window.dispatchEvent(new Event("online"));
  };
  const lab = useMemo<DevLab>(() => ({
    sasa: {
      ...createLabSasa(sasaState.current, { delay, outcome }),
      open: (open) => {
        setNextSpeech(null);
        if (open.kind === "sale") { setSaleDraft(open.draft); setFlow("venda"); }
      },
    },
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
    sale: {
      // Simula a IA lendo o contrato: familiar da Amil com titular e 2 dependentes, sem a vigência (em "falha", não lê nada).
      readContract: async () => {
        await wait(delay + 800);
        if (outcome === "falha") return { ok: false, error: "Não consegui ler esse contrato. Tente uma foto mais nítida ou responda as perguntas." };
        return {
          ok: true,
          file: { filename: "contrato-carlos.pdf", fileUrl: "/api/documents/download?key=lab" },
          reading: {
            planType: "familiar",
            holder: { name: "Carlos Eduardo Teixeira", birthDate: "1988-03-14", age: null, cpf: null, relationship: "titular" },
            dependents: [
              { name: "Juliana Teixeira", birthDate: "1991-07-02", age: null, cpf: null, relationship: "conjuge" },
              { name: "Pedro Teixeira", birthDate: "2017-05-20", age: null, cpf: null, relationship: "filho" },
            ],
            carrierName: "AMIL ASSISTÊNCIA MÉDICA",
            planName: "Amil S380",
            monthlyValue: 1890.42,
            coverageStartDate: null,
            policyNumber: "PRP-2026-118734",
            paymentMethod: "boleto",
            contractTermMonths: 12,
          },
        };
      },
      register: async () => {
        await wait(delay);
        return outcome === "falha" ? { error: "Não foi possível registrar a venda agora." } : { success: true, saleId: "lab-" + Date.now() };
      },
    } satisfies SaleChatServices,
    teamList: {
      // Simula a IA: devolve o mapa do jeito que a leitura automática faria (ou nada, em "falha").
      structure: async (request) => {
        await wait(delay);
        if (outcome === "falha" || request.kind !== "tabela") return { ok: true, data: null };
        return { ok: true, data: { kind: "tabela", header: null, name: 0, phone: 1, email: null } };
      },
      review: async (phones) => {
        await wait(delay);
        return { ok: true, data: { known: phones.filter((phone) => phone === LAB_KNOWN_PHONE), weekLeft: 5000 } };
      },
      importContacts: async (input) => {
        await wait(delay);
        if (outcome === "falha") return { ok: false, error: "Não consegui importar agora." };
        return { ok: true, data: { imported: input.contacts.length, duplicates: 0 } };
      },
      distribute: async (input) => {
        await wait(delay);
        if (outcome === "falha") return { ok: false, error: "Não consegui distribuir agora. Os leads continuam aqui." };
        const distributed = Object.values(input.counts).reduce((sum, value) => sum + value, 0);
        return { ok: true, data: { distributed, left: 0, perBroker: input.counts } };
      },
    },
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

  const restart = () => { setRun((value) => value + 1); setHandoff(null); sasaState.current.world = labSasaWorld(); sasaState.current.closed = []; sasaState.current.heard = 0; setSaleDraft(null); chooseSpeech(null); };

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
        ) : flow === "venda" ? (
          <SaleChat lead={LAB_SALE_LEAD} catalog={LAB_SALE_CATALOG} services={lab.sale!} backHref="/dev/laboratorio" doneHref="/dev/laboratorio" spokenDraft={saleDraft} />
        ) : flow === "sasa" ? (
          <div className="arc-venancor h-dvh">
            <AssistantChat
              identity={{ name: "Sasá", shape: "sasa", hue: 175 }}
              script={(() => { const script = buildAncoraScript({ now: new Date() }); return { ...script, blocks: [...script.blocks, labSasaPhrasesBlock(), labSasaQuestionsBlock(), labSasaOpenBlock()] }; })()}
              instant
              agentId="ancora"
              canWrite
            />
          </div>
        ) : flow === "botao" ? (
          <>
            <ChatHome
              viewerName="Vinicios Ragazzi"
              nowIso={new Date().toISOString()}
              canQuote
              showWhatsAppStatus={false}
              assistants={[thread({ id: "a-sasa", assistant: "ancora" as never, name: "Sasá", preview: "Peça o que precisar, por texto ou áudio.", shape: "sasa", hue: 175, href: "/dev/laboratorio" })]}
              leads={[
                thread({ id: "l-ana", kind: "lead", leadId: "lab-ana", name: "Ana Souza", preview: "Cotação enviada.", href: "/dev/laboratorio", initials: "AS", shape: "logo", hue: null } as Partial<ThreadSummary>),
                thread({ id: "l-carlos-m", kind: "lead", leadId: "lab-carlos-m", name: "Carlos Mendes", preview: "Respondeu e espera você.", waitingYou: true, href: "/dev/laboratorio", initials: "CM", shape: "logo", hue: null } as Partial<ThreadSummary>),
                thread({ id: "l-pedro", kind: "lead", leadId: "lab-pedro", name: "Pedro Lima", preview: "Retorno hoje.", href: "/dev/laboratorio", initials: "PL", shape: "logo", hue: null } as Partial<ThreadSummary>),
              ]}
              summary={{
                receivedToday: 3, acceptedToday: 2, inServiceNow: 4, slaAtRiskNow: 1, duty: { title: "De plantão: TESTE", detail: "09:00 às 19:00", href: "/dev/laboratorio" }, goal: null,
                next: { label: "Responder Carlos", detail: "Ele respondeu e espera você.", href: "/dev/laboratorio", urgent: false },
              }}
            />
            <SasaVoiceButton pathname="/dashboard" chat={false} />
          </>
        ) : flow === "lista" ? (
          <TeamListManager rows={LAB_LIST} totals={{ all: LAB_LIST.length, pending: LAB_LIST.filter((row) => !row.brokerId).length, distributed: LAB_LIST.filter((row) => row.brokerId).length, replied: LAB_LIST.filter((row) => row.replied).length }} team={LAB_TEAM} switcher={null} />
        ) : flow === "movimento" ? (
          <InterfaceMotionProvider enabled={!killSwitch}>
            <MotionShowcase delay={delay} failing={outcome === "falha"} />
          </InterfaceMotionProvider>
        ) : flow === "leadHover" ? (
          <LeadHoverLab />
        ) : flow === "callAncora" ? (
          <CallAncoraWorkspace brokerFirstName="Vinicios" />
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
            {flow === "botao" ? (
              <>
              <fieldset><legend>Próxima fala</legend>
                <button type="button" aria-pressed={nextSpeech === null} onClick={() => chooseSpeech(null)}>Sequência</button>
                <button type="button" aria-pressed={nextSpeech === "venda"} onClick={() => chooseSpeech("venda")}>Fechou a venda</button>
                <button type="button" aria-pressed={nextSpeech === "disse"} onClick={() => chooseSpeech("disse")}>O cliente disse</button>
                <button type="button" aria-pressed={nextSpeech === "cotacao"} onClick={() => chooseSpeech("cotacao")}>Cotação</button>
                <button type="button" aria-pressed={nextSpeech === "passos"} onClick={() => chooseSpeech("passos")}>Dois passos</button>
                <button type="button" aria-pressed={nextSpeech === "aceitar"} onClick={() => chooseSpeech("aceitar")}>Aceitar lead</button>
                <button type="button" aria-pressed={nextSpeech === "perdeu"} onClick={() => chooseSpeech("perdeu")}>Perdeu</button>
                <button type="button" aria-pressed={nextSpeech === "mensagem"} onClick={() => chooseSpeech("mensagem")}>Mensagem</button>
              </fieldset>
              <fieldset><legend>Internet</legend>
                <button type="button" aria-pressed={!offline} onClick={() => setInternet(true)}>Com internet</button>
                <button type="button" aria-pressed={offline} onClick={() => setInternet(false)}>Sem internet</button>
                <button type="button" onClick={() => void queueOldAudio()} title="Um áudio gravado há 40 min, sem internet: pede confirmação">Áudio de 40 min na fila</button>
              </fieldset>
              </>
            ) : null}
            <fieldset><legend>Plantão</legend>
              <button type="button" aria-pressed={mode === "online"} onClick={() => setMode("online")}>Online</button>
              <button type="button" aria-pressed={mode === "presencial"} onClick={() => setMode("presencial")}>Presencial</button>
            </fieldset>
            <fieldset><legend>Movimento</legend>
              <button type="button" aria-pressed={lessMotion} onClick={() => setLessMotion((value) => !value)}>Menos animação</button>
              <button type="button" aria-pressed={killSwitch} onClick={() => setKillSwitch((value) => !value)}>Kill switch</button>
            </fieldset>
            <button type="button" className={styles.restart} onClick={restart}>Recomeçar</button>
            <p className={styles.note}>Telas reais, servidor simulado. As comemorações respeitam o limite do dia: em Configurações › Acessibilidade dá para desligar. Movimento reduzido do sistema: DevTools › Rendering › prefers-reduced-motion.</p>
          </div>
        ) : null}
      </aside>
    </DevLabProvider>
  );
}
