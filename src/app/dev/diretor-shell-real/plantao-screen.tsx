
/** ?tela=plantao: a página de um plantão 1:1 (27/11/2026) com dados de exemplo, na moldura real. ?historico=1 mostra uma ocorrência encerrada. */

import { PlantaoPagina1a1 } from "@/app/(dashboard)/leads/distribuicao/plantao/_components/plantao-pagina-1a1-view";
import type { BrokerOccurrence1a1Props } from "@/app/(dashboard)/leads/distribuicao/plantao/_components/broker-occurrence-1a1";
import type { PlantaoLeadRow } from "@/app/(dashboard)/leads/distribuicao/plantao/_components/plantao-pagina-1a1";
import type { LeadWorkspaceItem } from "@/features/leads/components/lead-workspace-types";

const SCHEDULE = "00000000-0000-4000-8000-0000000000aa";
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const base = `/dev/diretor-shell-real?tela=plantao`;

function broker(index: number, name: string, extra: Partial<BrokerOccurrence1a1Props>): BrokerOccurrence1a1Props {
  return {
    scheduleId: SCHEDULE, leadsSince: "plantao", assignmentId: `as-${index}`, brokerId: `br-${index}`, brokerName: name, phone: "(21) 99000-0000",
    internalCode: String(102 + index * 7), branchName: ["Matriz 20º Andar", "Centro", "Nova Iguaçu", "Matriz 7º Andar", "Matriz 20º Andar"][index], availabilityStatus: "Disponível",
    presenceEnabled: true, presenceStatus: "confirmed", confirmedAt: minutesAgo(300), releasedByName: null, presenceReleaseNote: null, notificationErrorCode: null,
    paused: false, absent: false, attendanceMode: "presencial", scheduleAttendanceMode: "presencial", onlineOverride: false, canSetAttendanceMode: true,
    onSitePending: false, onSiteReleaseOpen: true, presencePhotoId: null, photoMinutesAgo: null, canAssignLeads: true, canSwap: true, swapNotice: null,
    liveStatus: "ready", nextEventAt: null, activeLeads: 2, capacity: 8, crossesCut: true, leadsMorning: 1, leadsAfternoon: 1, blockedReason: null,
    wholeDay: false, turn: null, preconfirm: null, ...extra,
  };
}

const active = [
  broker(0, "Vitória Augusto", { liveStatus: "offer_pending", activeLeads: 3, leadsMorning: 2, leadsAfternoon: 1, turn: { role: "current", position: null } }),
  broker(1, "Raiana Nunes", { turn: { role: "next", position: 1 } }),
  broker(2, "Sara Soares", { activeLeads: 4, leadsMorning: 2, leadsAfternoon: 2, turn: { role: null, position: 2 } }),
  broker(3, "Juliana Portela", { presenceStatus: "pending", onSitePending: true, presencePhotoId: "photo-1", photoMinutesAgo: 4, liveStatus: "paused", activeLeads: 0, leadsMorning: 0, leadsAfternoon: 0, blockedReason: null, preconfirm: { targetAssignmentId: "as-x", targetScheduleName: "Adesão Tarde" } }),
];
const absent = [broker(4, "Edinaldo Luiz", { absent: true, presenceStatus: "pending", liveStatus: "blocked", activeLeads: 0, leadsMorning: 0, leadsAfternoon: 0, blockedReason: "Falta registrada neste plantão" })];

function lead(id: number, name: string, extra: Partial<PlantaoLeadRow> & { qualificationStatus?: string; status?: string; corretorId?: string | null }): PlantaoLeadRow {
  const { qualificationStatus = "warm", status = "new", corretorId = null, ...rest } = extra;
  return {
    lead: { id: `00000000-0000-4000-8000-00000000010${id}`, nome: name, telefone: "(21) 99104-2210", status, qualificationStatus, corretorId, corretorNome: rest.brokerName ?? null } as unknown as LeadWorkspaceItem,
    groupKey: "g", groupLabel: "g", createdAt: minutesAgo(30 + id * 7), assignedAt: null, brokerName: null, queueName: "Fila Adesão", distributionLabel: "Aguardando corretor",
    distributionTone: "outline", whatsappLabel: null, returnedUnaccepted: false, coldHeld: false, whatsapp: false, ...rest,
  };
}

const groups = [
  { key: "ordem", label: "Ordem de distribuição · quentes, mornos e frios", leads: [
    lead(1, "Marcos Teixeira", { qualificationStatus: "cold", returnedUnaccepted: true, whatsapp: true, distributionLabel: "Devolvido", distributionTone: "warning" }),
    lead(2, "Rita de Cássia França", { qualificationStatus: "", distributionLabel: "Aguardando corretor" }),
  ] },
  { key: "manha", label: "Distribuídos de manhã", leads: [
    lead(3, "Ana Ribeiro", { qualificationStatus: "hot", whatsapp: true, brokerName: "Vitória Augusto", corretorId: "br-0", assignedAt: minutesAgo(20), distributionLabel: "Oferta enviada", distributionTone: "info" }),
    lead(4, "Paula Rezende", { qualificationStatus: "warm", whatsapp: true, status: "in_contact", brokerName: "Sara Soares", corretorId: "br-2", assignedAt: minutesAgo(60), distributionLabel: "Atribuído", distributionTone: "success" }),
    lead(5, "Cristiane Fortes", { qualificationStatus: "hot", status: "quote_sent", brokerName: "Raiana Nunes", corretorId: "br-1", assignedAt: minutesAgo(140), distributionLabel: "Atribuído", distributionTone: "success" }),
  ] },
];

/** Montada no servidor, como a página real (27/11/2026): no cliente a prévia escondia que os estilos não chegavam. */
export function PlantaoShellScreen({ search }: { search: Record<string, string | string[] | undefined> }) {
  const params = { get: (key: string) => { const value = search[key]; return typeof value === "string" ? value : null; } };
  const history = params?.get("historico") === "1";
  const custom = params?.get("desde") === "custom";
  const customValue = params?.get("desdeEm") ?? null;
  const header = {
    state: history ? { label: "Terminado", tone: "neutral" as const, live: false } : { label: "Em andamento", tone: "good" as const, live: true },
    typeName: "Adesão", typeHue: 30, recurrence: "↻ Toda sexta", modality: "Presencial", title: "Adesão Online",
    dayLabel: "Sexta, 27/11 · 09:00 às 18:00", branchLabel: "Todas as unidades", queueLabel: "Fila Adesão",
  };
  const occurrences = { items: [
    { key: "agora", label: "Hoje, 27/11", href: base, current: !history },
    { key: "20", label: "20/11", href: `${base}&historico=1`, current: history },
    { key: "13", label: "13/11", href: `${base}&historico=1`, current: false },
    { key: "06", label: "06/11", href: `${base}&historico=1`, current: false },
  ] };
  if (history) {
    return (
      <PlantaoPagina1a1
        backHref="/dev/diretor-shell-real?tela=plantoes"
        header={header}
        actions={{ scheduleId: SCHEDULE, canExport: true, reportDate: "2026-11-20", escalar: null }}
        invalidDateMessage={null}
        occurrences={{ ...occurrences, dateDefault: "2026-11-20" }}
        stats={[
          { label: "Leads atribuídos", value: 21, detail: "Aceites e atribuições registradas" },
          { label: "Ofertas enviadas", value: 26, detail: "21 aceitas · 3 recusadas · 2 expiradas" },
          { label: "Presenças confirmadas", value: "4/5", detail: "Confirmações registradas na data" },
        ]}
        history={{
          scheduleId: SCHEDULE, dutyDate: "2026-11-20", rosterCount: 5,
          brokers: [{ brokerId: "br-0", brokerName: "Vitória Augusto", branchName: "Matriz 20º Andar", onRoster: true, leads: 7 }, { brokerId: "br-1", brokerName: "Raiana Nunes", branchName: "Centro", onRoster: true, leads: 6 }, { brokerId: "br-9", brokerName: "Bruno Cardoso", branchName: "Centro", onRoster: false, leads: 1 }],
          distributions: [
            { id: "d1", leadName: "Débora Lins", brokerName: "Vitória Augusto", assignedAt: minutesAgo(10_000), kind: "Oferta aceita", exact: true },
            { id: "d2", leadName: "Carlos Mendes", brokerName: "Raiana Nunes", assignedAt: minutesAgo(10_050), kind: "Atribuição manual", exact: false },
          ],
          truncated: false,
        }}
        managerNote={false}
      />
    );
  }
  return (
    <PlantaoPagina1a1
      backHref="/dev/diretor-shell-real?tela=plantoes"
      header={header}
      actions={{ scheduleId: SCHEDULE, canExport: true, escalar: { scheduleId: SCHEDULE, scheduleName: "Adesão Online", date: "2026-11-27", brokers: [] } }}
      invalidDateMessage={null}
      occurrences={occurrences}
      stats={[
        { label: "Cobertura", value: "4/3", detail: "Escala completa", shortDetail: "completa" },
        { label: "Filas vinculadas", shortLabel: "Filas", value: 1, detail: "Fila Adesão" },
        { label: "Leads no plantão", shortLabel: "Leads", value: 23, detail: "18 distribuídos · 5 aguardando", shortDetail: "5 aguardando" },
      ]}
      escala={{
        title: "Confirmação da escala", shortTitle: "Escala", badge: "3/4 confirmados", badgeGood: false, sub: "3 de 4 prontos para receber o próximo lead agora.",
        turn: { scheduleName: "Adesão Online", previous: { id: "br-2", name: "Sara Soares", offeredAt: minutesAgo(9), outcome: "accepted" }, current: { id: "br-0", name: "Vitória Augusto", offeredAt: minutesAgo(2) }, nextName: "Raiana Nunes" },
        autoRefresh: false,
        startIntervalText: null,
        rotationText: "Rodízio: cada um tem sua vez, na ordem em que chegou. Quem recebe vai para o fim; lead expirado ou recusado gasta a vez e conta como pulo. Para passar alguém na frente, arraste o cartão pela alça.",
        noneEligible: false,
        sections: [{ key: "todos", label: null, count: 5, groups: [
          { key: "active", label: "Ativos", cards: active, sortable: { scheduleId: SCHEDULE, dutyDate: "2026-11-27", order: ["br-0", "br-1", "br-2", "br-3"], queue: ["br-1", "br-2"] } },
          { key: "absent", label: "Faltaram", cards: absent, sortable: null },
        ] }],
        emptyText: null,
        pending: { scheduleId: SCHEDULE, entries: [{ entryId: "p1", id: "pb-1", name: "Bruno Cardoso", internalCode: "131", branchName: "Centro" }], candidates: [] },
      }}
      leads={{
        count: 23,
        sub: "Leads das filas vinculadas desde o início desta ocorrência (27/11 09:00).",
        filters: [
          { key: "aguardando", label: "Aguardando distribuição", count: 5, href: base, active: true },
          { key: "distribuidos", label: "Distribuídos", count: 18, href: `${base}&situacao=distribuidos`, active: false },
        ],
        since: {
          choices: [
            { value: "plantao", label: "Janela do plantão", href: base, active: !custom },
            { value: "hoje", label: "Hoje", href: base, active: false },
            { value: "ontem", label: "Ontem 19:00", href: base, active: false },
            { value: "sexta", label: "Sexta 19:00", href: base, active: false },
          ],
          customActive: custom && Boolean(customValue),
          customValue,
          customError: custom && !customValue ? "Escolha o dia e a hora." : null,
          customBaseHref: base,
          cut: { scheduleId: SCHEDULE, cutAt: "19:00" },
        },
        queueTabs: [],
        channelTabs: [
          { key: "todos", label: "Todos", count: 5, href: base, active: true },
          { key: "formulario", label: "Formulário", count: 2, href: base, active: false },
          { key: "whatsapp", label: "WhatsApp", count: 3, href: base, active: false },
        ],
        groups,
        empty: null,
        drawer: { brokers: [], branches: [], contextRole: "director", contextJobTitle: null, contextBranchId: null, manualAssignmentChoiceEnabled: true, slaFirstContactMinutes: 15, slaStagnantDays: 3 },
      }}
      managerNote={false}
    />
  );
}
